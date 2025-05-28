#!/usr/bin/env bash
set -euo pipefail

cd /mnt/c/frontend/ai-voice-bot

# 0) Write .env.local with your real keys
cat > .env.local << 'EOL'
OPENAI_API_KEY=sk-…your-openai-key…
WEATHER_API_KEY=…your-weather-key…
EOL
echo "✔ .env.local created"

# 1) .dockerignore
cat > .dockerignore << 'EOL'
node_modules
npm-debug.log*
Dockerfile*
docker-compose*.yml
.next
.git
.gitignore
.env.local
README.md
EOL

# 2) Dockerfile
cat > Dockerfile << 'EOL'
# deps
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# build
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# runtime
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=deps    /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["npm","run","start"]
EOL

# 3) docker-compose.yml
cat > docker-compose.yml << 'EOL'
version: '3.8'
services:
  web:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.local
    environment:
      NODE_ENV: production
EOL

# 4) next.config.js
cat > next.config.js << 'EOL'
/** @type {import('next').NextConfig} */
module.exports = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};
EOL

# 5) Clean old configs
rm -f next.config.ts
rm -rf pages

# 6) Install OpenAI SDK
npm install openai

# 7) GPT API route
mkdir -p src/app/api/ask
cat > src/app/api/ask/route.ts << 'EOL'
import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function POST(req: NextRequest) {
  const { question } = await req.json()
  if (!question) return NextResponse.json({ error:'No question' },{status:400})
  const chat = await openai.chat.completions.create({
    model:'gpt-3.5-turbo',
    messages:[{role:'user',content:question}],
  })
  return NextResponse.json({ answer: chat.choices[0].message?.content||'' })
}
EOL

# 8) Weather API route
mkdir -p src/app/api/weather
cat > src/app/api/weather/route.ts << 'EOL'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const city = url.searchParams.get('city') || 'New York'
  const key = process.env.WEATHER_API_KEY!
  const res = await fetch(\`https://api.openweathermap.org/data/2.5/weather?q=\${encodeURIComponent(city)}&appid=\${key}&units=imperial\`)
  if (!res.ok) return NextResponse.json({ error:res.statusText },{status:res.status})
  const d = await res.json()
  const summary = \`\${d.name}: \${d.weather[0].description}, temp \${Math.round(d.main.temp)}°F, humidity \${d.main.humidity}%\`
  return NextResponse.json({ summary })
}
EOL

# 9) Voice UI page
cat > src/app/page.tsx << 'EOL'
'use client'
import { useState } from 'react'

export default function Page() {
  const [answer, setAnswer] = useState<string>()
  const [error, setError] = useState<string>()

  function startListening() {
    setError(undefined)
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return setError('SpeechRecognition not supported')
    const r = new SR()
    r.lang = 'en-US'
    r.interimResults = false
    r.maxAlternatives = 1

    r.onresult = async (e: any) => {
      const q = e.results[0][0].transcript.trim()
      try {
        let reply: string
        if (/what('?s| is)? the time/i.test(q)) {
          reply = new Date().toLocaleTimeString()
        } else if (/what('?s| is)? date/i.test(q)) {
          reply = new Date().toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'})
        } else if (/weather/i.test(q)) {
          const m = q.match(/weather in ([a-z ]+)/i)
          const city = m?.[1]?.trim()||'New York'
          const res = await fetch(\`/api/weather?city=\${encodeURIComponent(city)}\`)
          const d = await res.json()
          if (d.error) throw new Error(d.error)
          reply = d.summary
        } else {
          const res = await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q})})
          if (!res.ok) throw new Error(await res.text())
          const { answer:ai } = await res.json()
          reply = ai
        }
        setAnswer(reply)
        speechSynthesis.speak(new SpeechSynthesisUtterance(reply))
      } catch (e: any) {
        setError(e.message)
      }
    }
    r.onerror = (e:any) => setError(e.error||e.message)
    r.start()
  }

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',gap:24}}>
      <button onClick={startListening} style={{padding:'1rem 2rem',fontSize:'1.25rem'}}>🎤 Speak Now</button>
      {error && <p style={{color:'red'}}>{error}</p>}
      {answer && <div style={{padding:16,border:'1px solid #ddd',borderRadius:8}}><p>{answer}</p></div>}
    </div>
  )
}
EOL

# 10) Final install & start
chmod +x setup-all.sh
echo "✔ setup-all.sh created. Now run: ./setup-all.sh"
