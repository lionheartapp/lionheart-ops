import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { corsHeaders } from '@/lib/cors'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

/** Extract Vendor, Date, Total from receipt image using Vision API */
export async function POST(req: Request) {
  if (!openai) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured. Add OPENAI_API_KEY to .env' },
      { status: 503, headers: corsHeaders }
    )
  }
  try {
    const formData = await req.formData()
    const file = formData.get('image') as File | null
    if (!file) return NextResponse.json({ error: 'Missing image' }, { status: 400, headers: corsHeaders })

    const buf = Buffer.from(await file.arrayBuffer())
    const base64 = buf.toString('base64')
    const mime = file.type || 'image/jpeg'

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract receipt data. Return ONLY valid JSON:
{"vendor": "Store or vendor name", "date": "YYYY-MM-DD", "total": number}

Use the date on the receipt. Total should be the final amount (number only, no currency symbol). If a field is unreadable, use null.`,
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mime};base64,${base64}` },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    })

    const raw = response.choices?.[0]?.message?.content?.trim()
    if (!raw) return NextResponse.json({ error: 'No OCR result' }, { status: 502, headers: corsHeaders })

    const parsed = JSON.parse(raw) as { vendor?: string; date?: string; total?: number }
    return NextResponse.json(
      { vendor: parsed.vendor || '', date: parsed.date || '', total: typeof parsed.total === 'number' ? parsed.total : 0 },
      { headers: corsHeaders }
    )
  } catch (err) {
    console.error('Receipt OCR error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'OCR failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}
