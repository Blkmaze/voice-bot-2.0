import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const city = url.searchParams.get('city') || 'New York'
    const key  = process.env.WEATHER_API_KEY?.trim()

    if (!key) {
      return NextResponse.json(
        { error: 'WEATHER_API_KEY not configured' },
        { status: 500 }
      )
    }

    const apiUrl =
      'https://api.openweathermap.org/data/2.5/weather?q=' +
      encodeURIComponent(city) +
      '&appid=' + key +
      '&units=imperial'

    const weatherRes = await fetch(apiUrl)
    if (!weatherRes.ok) {
      return NextResponse.json(
        { error: weatherRes.statusText },
        { status: weatherRes.status }
      )
    }

    const data = await weatherRes.json()
    const summary =
      data.name + ': ' +
      data.weather[0].description + ', temp ' +
      Math.round(data.main.temp) + '\u00B0F, humidity ' +
      data.main.humidity + '%'

    return NextResponse.json({ summary })
  } catch (err: any) {
    console.error('Weather route error:', err)
    return NextResponse.json(
      { error: err.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
