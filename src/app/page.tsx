'use client'
import { useState } from 'react'

export default function Page() {
  const [answer, setAnswer] = useState<string>()
  const [error, setError]   = useState<string>()

  function startListening() {
    setError(undefined)
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return setError('SpeechRecognition not supported')
    const r = new SR()
    r.lang            = 'en-US'
    r.interimResults  = false
    r.maxAlternatives = 1

    r.onresult = (event: any) => {
      console.log('🗣️ Speech event:', event)
      ;(async () => {
        try {
          const transcript = Array.from(event.results)
            .map((res: any) => res[0].transcript)
            .join('')
            .trim()
          console.log('📝 Transcript:', transcript)

          const res = await fetch('/api/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: transcript }),
          })
          console.log('🔍 API status:', res.status)
          const text = await res.text()
          if (!res.ok) {
            console.error('🚨 API error body:', text)
            throw new Error('HTTP ' + res.status + ' – ' + (text||'(empty)'))
          }
          const data = JSON.parse(text)
          const ai = data.answer || ''
          console.log('🤖 Bot replied:', ai)

          setAnswer(ai)
          speechSynthesis.speak(new SpeechSynthesisUtterance(ai))
        } catch (err: any) {
          console.error('❌ Error in onresult:', err)
          setError(err.message || 'Something went wrong')
          setAnswer(undefined)
        }
      })()
    }

    r.onerror = (e: any) => {
      console.error('🎙️ SpeechRecognition error:', e.error||e.message)
      setError(e.error||e.message)
    }

    r.start()
  }

  return (
    <div style={{
      display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',
      height:'100vh',gap:24
    }}>
      <button
        onClick={startListening}
        style={{padding:'1rem 2rem',fontSize:'1.25rem'}}
      >
        🎤 Speak Now
      </button>
      {error  && <p style={{color:'red'}}>{error}</p>}
      {answer && (
        <div style={{
          padding:16,border:'1px solid #ddd',borderRadius:8
        }}>
          <p>{answer}</p>
        </div>
      )}
    </div>
  )
}
