import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { corsHeaders } from '@/lib/cors'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

function extractDomain(url: string): string | null {
  try {
    const u = url.startsWith('http') ? url : `https://${url}`
    return new URL(u).origin
  } catch {
    return null
  }
}

/**
 * POST /api/setup/extract-brand
 * Body: { url: string } - school website URL (e.g. https://schoolname.edu)
 * Returns { primaryColor?, secondaryColor?, logoUrl? } extracted via AI from the page.
 */
export async function POST(req: NextRequest) {
  if (!openai) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured' },
      { status: 503, headers: corsHeaders }
    )
  }

  try {
    const body = (await req.json()) as { url?: string }
    const raw = body.url?.trim()
    if (!raw) {
      return NextResponse.json({ error: 'Missing url' }, { status: 400, headers: corsHeaders })
    }

    const baseUrl = extractDomain(raw)
    if (!baseUrl) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400, headers: corsHeaders })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(baseUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Lionheart/1.0)',
      },
      redirect: 'follow',
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return NextResponse.json(
        { error: `Could not fetch page: ${res.status}` },
        { status: 400, headers: corsHeaders }
      )
    }

    const html = await res.text()
    const excerpt = html.slice(0, 60000)

    const prompt = `Analyze this school or organization website HTML and extract this site's actual brand colors and logo.

Return a JSON object with these keys (use null for anything you cannot confidently determine):
- primaryColor: hex color (e.g. "#1a3a5c") — the main brand color from this site's header, nav, buttons, or theme. Use THIS site's colors only, not generic blue/orange.
- secondaryColor: hex color (e.g. "#c4a006") — accent color from this site if present; otherwise null.
- logoUrl: absolute URL to the main logo image (from img src, og:image, or link[rel="icon"]).

Rules:
- Extract colors that appear on THIS website (headers, footer, buttons, CSS variables). Do not substitute generic brand colors.
- Prefer theme-color meta, :root/--primary colors, and repeated UI colors.
- If you find only one dominant color, use it as primary and leave secondary null.
- logoUrl must be absolute (e.g. https://example.com/logo.png).
- Return ONLY valid JSON, no markdown.

HTML excerpt (first ~60k chars):\n${excerpt}`
    const chatRes = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    })

    const rawOut = chatRes.choices?.[0]?.message?.content?.trim()
    if (!rawOut) {
      return NextResponse.json(
        { error: 'No response from AI' },
        { status: 502, headers: corsHeaders }
      )
    }

    const parsed = JSON.parse(rawOut) as {
      primaryColor?: string | null
      secondaryColor?: string | null
      logoUrl?: string | null
    }

    const result: { primaryColor?: string; secondaryColor?: string; logoUrl?: string } = {}
    if (parsed.primaryColor && /^#[0-9a-fA-F]{3,8}$/.test(String(parsed.primaryColor))) {
      result.primaryColor = String(parsed.primaryColor)
    }
    if (parsed.secondaryColor && /^#[0-9a-fA-F]{3,8}$/.test(String(parsed.secondaryColor))) {
      result.secondaryColor = String(parsed.secondaryColor)
    }
    if (parsed.logoUrl && typeof parsed.logoUrl === 'string' && parsed.logoUrl.startsWith('http')) {
      result.logoUrl = parsed.logoUrl
    }

    return NextResponse.json(result, { headers: corsHeaders })
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Request timed out' },
          { status: 408, headers: corsHeaders }
        )
      }
      console.error('extract-brand error:', err.message)
    }
    return NextResponse.json(
      { error: 'Failed to extract brand from website' },
      { status: 500, headers: corsHeaders }
    )
  }
}
