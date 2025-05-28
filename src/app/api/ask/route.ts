import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(req: Request) {
  console.log('[/api/ask] 🚀 POST received')
  const raw = process.env.OPENAI_API_KEY
  console.log('[/api/ask] raw OPENAI_API_KEY:', JSON.stringify(raw))
  if (!raw) return NextResponse.json({ error: 'Missing API key' }, { status: 500 })
  const key = raw.trim().replace(/^"+|"+$/g, '')
  console.log('[/api/ask] using API key prefix:', key.slice(0,7) + '…')
  let openai
  try {
    openai = new OpenAI({ apiKey: key })
  } catch (e) {
    console.error('[/api/ask] Invalid API key:', e)
    return NextResponse.json({ error: 'Invalid API key' }, { status: 500 })
  }
  try {
    const { question } = await req.json()
    console.log('[/api/ask] Question:', question)
    if (!question) return NextResponse.json({ error: 'No question provided' }, { status: 400 })
    const chat = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: question }
      ]
    })
    const answer = chat.choices?.[0]?.message?.content ?? 'No answer.'
    console.log('[/api/ask] Answer:', answer)
    return NextResponse.json({ answer })
  } catch (err) {
    console.error('[/api/ask] ERROR during request:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
