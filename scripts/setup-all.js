param(
  [string]$OpenAiKey     = $(Read-Host -Prompt "Enter your OpenAI secret key (sk-... without 'proj')"),
  [string]$WeatherApiKey = $(Read-Host -Prompt "Enter your OpenWeatherMap API key"),
  [string]$EmailPass     = $(Read-Host -AsSecureString -Prompt "Enter app-specific password for willie.mayes@gmail.com")
)

# Clean up old scripts
Write-Host "Removing redundant setup scripts..."
Get-ChildItem -Path "$PSScriptRoot" -Filter "*.ps1" |
  Where-Object { $_.Name -notlike 'setup-all.ps1' } |
  ForEach-Object { Remove-Item $_.FullName -Force; Write-Host "✔ Removed $_.Name" }
Remove-Item -Path "$PSScriptRoot\patch-page.js" -ErrorAction SilentlyContinue; Write-Host "✔ Removed patch-page.js if existed"

# Constants
$EmailHost  = 'imap.gmail.com'
$EmailPort  = 993
$EmailUser  = 'willie.mayes@gmail.com'
$SmtpHost   = 'smtp.gmail.com'
$SmtpPort   = 465
$SmtpSecure = $true

# Move to project root
$projectRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location $projectRoot

# Helper to write files and ensure directories
function Write-File {
  param([string]$Path, [string[]]$Content)
  $dir = Split-Path $Path
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $Content | Out-File -FilePath $Path -Encoding utf8
  Write-Host "✔ Created $Path"
}

# 1) Write .env.local
$envLines = @(
  "OPENAI_API_KEY=$OpenAiKey",
  "WEATHER_API_KEY=$WeatherApiKey",
  "EMAIL_HOST=$EmailHost",
  "EMAIL_PORT=$EmailPort",
  "EMAIL_USER=$EmailUser",
  "EMAIL_PASS=$(ConvertFrom-SecureString $EmailPass -AsPlainText)",
  "SMTP_HOST=$SmtpHost",
  "SMTP_PORT=$SmtpPort",
  "SMTP_SECURE=$SmtpSecure",
  "SMTP_USER=$EmailUser",
  "SMTP_PASS=$(ConvertFrom-SecureString $EmailPass -AsPlainText)"
)
Write-File ".env.local" $envLines

# 2) Install dependencies
Write-Host "Installing npm dependencies..."
npm install openai imap-simple mailparser nodemailer react-speech-recognition --save
Write-Host "✔ Dependencies installed"

# 3a) Scaffold /api/ask
$askContent = @"
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(req: Request) {
  const { question } = await req.json()
  if (!question) return NextResponse.json({ error: 'No question' }, { status: 400 })
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  const chat   = await client.chat.completions.create({ model: 'gpt-4o-mini', messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user',   content: question }
  ] })
  return NextResponse.json({ answer: chat.choices[0].message?.content || '' })
}
"@
Write-File "src/app/api/ask/route.ts" $askContent

# 3b) Scaffold /api/weather
$weatherContent = @"
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const city = new URL(req.url).searchParams.get('city') || 'New York'
  const res  = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${process.env.WEATHER_API_KEY}&units=imperial`
  )
  const d = await res.json()
  const summary = `${d.name}: ${d.weather[0].description}, ${Math.round(d.main.temp)}°F, humidity ${d.main.humidity}%`
  return NextResponse.json({ summary })
}
"@
Write-File "src/app/api/weather/route.ts" $weatherContent

# 3c) Scaffold /api/emails GET + purge Trash
$emailsGet = @"
import { NextResponse } from 'next/server'
import imaps from 'imap-simple'

export async function GET() {
  const conn = await imaps.connect({ imap: {
    user: process.env.EMAIL_USER!, password: process.env.EMAIL_PASS!, host: process.env.EMAIL_HOST!, port: Number(process.env.EMAIL_PORT!), tls: true
  }})
  await conn.openBox('INBOX')
  const msgs = await conn.search(['UNSEEN'], { bodies: ['HEADER.FIELDS (FROM SUBJECT DATE)'], markSeen: true })
  const emails = msgs.map(m => { const h = m.parts[0].body; return { from: h.from[0], subject: h.subject[0], date: h.date[0] } })
  await conn.openBox('[Gmail]/Trash')
  const trash = await conn.search(['ALL'], { bodies: [] })
  const uids = trash.map(t => t.attributes.uid)
  if (uids.length) { await conn.addFlags(uids, '\Deleted'); await conn.expunge() }
  await conn.end()
  return NextResponse.json({ emails })
}
"@
Write-File "src/app/api/emails/route.ts" $emailsGet

# 3d) Scaffold /api/emails/send POST
$emailsSend = @"
import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: Request) {
  const { to, subject, text } = await req.json()
  const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST!, port: Number(process.env.SMTP_PORT!), secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! } })
  await transporter.sendMail({ from: process.env.SMTP_USER!, to, subject, text })
  return NextResponse.json({ ok: true })
}
"@
Write-File "src/app/api/emails/send/route.ts" $emailsSend

# 4) Overwrite src/app/page.tsx with full UI + Stop + Play
$pagePath = "src/app/page.tsx"
$pageContent = @"
'use client'
import { useState, useRef, useEffect } from 'react'

export default function Page() {
  const [ans, setAns] = useState<string>()
  const [err, setErr] = useState<string>()
  const recRef = useRef<any>()

  const stopAll = () => { recRef.current?.stop(); window.speechSynthesis.cancel() }
  const speak = (text: string) => { const synth=window.speechSynthesis, u=new SpeechSynthesisUtterance(text), v=synth.getVoices().find(v=>/female/i.test(v.name))||synth.getVoices()[0]; if(v)u.voice=v; synth.speak(u) }

  const startListening = () => {
    setErr(undefined)
    const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition
    if(!SR) return setErr('SpeechRecognition not supported')
    const r=new SR(); recRef.current=r; r.lang='en-US';r.interimResults=false;r.maxAlternatives=1;
    r.onresult=async e=>{
      const q=e.results[0][0].transcript.trim().toLowerCase(); let reply=''
      try{
        if(q.includes('what time')) reply='Time is '+new Date().toLocaleTimeString()
        else if(q.includes('weather')){const city=q.match(/weather in ([a-z ]+)/)?.[1]||'New York'; const res=await fetch(`/api/weather?city=${encodeURIComponent(city)}`); reply=(await res.json()).summary}
        else if(q.includes('read unseen emails')){const {emails}=await(await fetch('/api/emails')).json(); reply=emails.length?emails.map((e,i)=>`Email ${i+1} from ${e.from}: ${e.subject}`).join('. '):'No unread'}
        else if(/reply to email (\d+)/.test(q)){const idx=+q.match(/reply to email (\d+)/)[1]-1; const em=await(await fetch('/api/emails')).json(); const to=em.emails[idx]?.from; const sub='Re: '+em.emails[idx]?.subject; const content=prompt('Reply:')||''; await fetch('/api/emails/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,subject:sub,text:content})}); reply='Reply sent.'}
        else if(q.includes('play music')){new Audio('https://example.com/sample.mp3').play(); reply='Playing music.'}
        else if(/search for (.+)/.test(q)){const term=q.match(/search for (.+)/)[1];window.open(`https://google.com/search?q=${encodeURIComponent(term)}`,'_blank'); reply=`Searching ${term}`}
        else {const {answer}=await(await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q})})).json(); reply=answer}
        setAns(reply); speak(reply)
      } catch(e:any){ setErr(e.message); speak(e.message) }
    }
    r.onerror=e=>setErr(e.error||e.message)
    r.start()
  }
  useEffect(()=>window.speechSynthesis.getVoices(),[])
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',gap:24}}>
      <div style={{display:'flex',gap:'1rem'}}>
        <button onClick={startListening} style={{padding:'1rem 2rem',fontSize:'1.25rem'}}>🎤 Speak Now</button>
        <button onClick={stopAll} style={{padding:'1rem 2rem',fontSize:'1.25rem',backgroundColor:'#e74c3c',color:'white',border:'none',borderRadius:4}}>🛑 Stop</button>
      </div>
      {err&&<p style={{color:'red'}}>{err}</p>}
      {ans&&<div style={{padding:16,border:'1px solid #ddd',borderRadius:8,maxWidth:600,textAlign:'center'}}><p>{ans}</p></div>}
    </div>
  )
}
"@
Write-File $pagePath $pageContent

# 5) Update package.json scripts
$pkg=Get-Content 'package.json' -Raw|ConvertFrom-Json
$pkg.scripts['dev']='next dev'; $pkg.scripts['build']='next build'; $pkg.scripts['start']='next start'
$pkg|ConvertTo-Json -Depth 5|Out-File 'package.json' -Encoding utf8
Write-Host "✔ package.json updated"

Write-Host "🎉 Full setup complete—email, stop button, female voice, music! Run 'npm run dev'."
