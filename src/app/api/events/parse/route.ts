import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

const PARSE_SYSTEM = `You extract event request details from natural language. Return ONLY valid JSON:
{"name": "Event Name" or null, "date": "YYYY-MM-DD" or null, "startTime": "HH:MM" 24hr or null, "endTime": "HH:MM" or null, "location": "Room/Building name" or null, "chairsRequested": number or null, "tablesRequested": number or null, "description": "..." or null}

Rules:
- date: "tomorrow", "next Friday", "March 15", "3/15" → YYYY-MM-DD. Use current year if not specified.
- startTime: "5pm"→"17:00", "9am"→"09:00", "noon"→"12:00"
- location: Match to common rooms: Gym, Cafeteria, Auditorium, Library, Elementary Room 101, etc.
- chairsRequested/tablesRequested: Extract numbers from "50 chairs", "10 tables"
- Return null for any field not mentioned.`

export async function POST(req: Request) {
  if (!openai) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured. Add OPENAI_API_KEY to .env' },
      { status: 503 }
    )
  }
  try {
    const { text } = (await req.json()) as { text?: string }
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 })
    }

    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const year = now.getFullYear()

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `${PARSE_SYSTEM}\n\nToday is ${todayStr} (year ${year}).`,
        },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
    })

    const raw = response.choices?.[0]?.message?.content?.trim()
    if (!raw) return NextResponse.json({ error: 'No response from AI' }, { status: 502 })

    const parsed = JSON.parse(raw) as Record<string, unknown>
    const result: Record<string, unknown> = {}
    if (parsed.name && typeof parsed.name === 'string') result.name = parsed.name.trim()
    if (parsed.date && typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date))
      result.date = parsed.date
    if (parsed.startTime && typeof parsed.startTime === 'string' && /^\d{1,2}:\d{2}$/.test(parsed.startTime))
      result.startTime = parsed.startTime
    if (parsed.endTime && typeof parsed.endTime === 'string' && /^\d{1,2}:\d{2}$/.test(parsed.endTime))
      result.endTime = parsed.endTime
    if (parsed.location && typeof parsed.location === 'string') result.location = parsed.location.trim()
    if (typeof parsed.chairsRequested === 'number' && parsed.chairsRequested >= 0)
      result.chairsRequested = parsed.chairsRequested
    if (typeof parsed.tablesRequested === 'number' && parsed.tablesRequested >= 0)
      result.tablesRequested = parsed.tablesRequested
    if (parsed.description && typeof parsed.description === 'string')
      result.description = parsed.description.trim()

    return NextResponse.json(result)
  } catch (err) {
    console.error('Parse event error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Parse failed' },
      { status: 500 }
    )
  }
}
