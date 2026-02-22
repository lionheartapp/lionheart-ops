import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg } from '@/lib/orgContext'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

/** Match identified part to KnowledgeBase entries */
async function matchToManual(partName: string) {
  if (!partName?.trim()) return null
  const name = partName.trim().toLowerCase()
  const entries = await prisma.knowledgeBaseEntry.findMany()
  for (const e of entries) {
    if (e.partName.toLowerCase().includes(name) || name.includes(e.partName.toLowerCase()))
      return e
    if (e.keywords.some((k) => k.toLowerCase().includes(name) || name.includes(k.toLowerCase())))
      return e
  }
  return null
}

export async function POST(req: NextRequest) {
  if (!openai) {
    return NextResponse.json(
      { error: 'OpenAI API key not configured. Add OPENAI_API_KEY to .env' },
      { status: 503 }
    )
  }
  try {
    return await withOrg(req, prismaBase, async () => {
    const formData = await req.formData()
    const file = formData.get('image') as File | null
    if (!file) return NextResponse.json({ error: 'Missing image' }, { status: 400 })

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
              text: `Identify the broken or malfunctioning part/equipment in this photo. Return ONLY a JSON object:
{"partName": "Short descriptive name of the part or equipment", "condition": "Brief description of the issue"}

Be specific (e.g. "Projector lamp", "HVAC air filter", "Document camera lens", "Smartboard power supply").`,
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
    if (!raw) return NextResponse.json({ error: 'No response from Vision API' }, { status: 502 })

    const parsed = JSON.parse(raw) as { partName?: string; condition?: string }
    const partName = (parsed.partName || 'Unknown part').trim()

    // Link to KnowledgeBase manual
    const manualEntry = await matchToManual(partName)

    // If no match, ask AI for 3-step repair
    let repairSteps: string[] = manualEntry?.repairSteps || []
    if (repairSteps.length === 0) {
      const repairRes = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `Provide a 3-step repair summary for: "${partName}". Condition: ${parsed.condition || 'unknown'}. Return JSON: {"steps": ["Step 1", "Step 2", "Step 3"]}`,
          },
        ],
        response_format: { type: 'json_object' },
      })
      const repairRaw = repairRes.choices?.[0]?.message?.content?.trim()
      if (repairRaw) {
        try {
          const r = JSON.parse(repairRaw) as { steps?: string[] }
          repairSteps = Array.isArray(r.steps) ? r.steps : []
        } catch {
          repairSteps = []
        }
      }
    }

    return NextResponse.json({
      partName,
      condition: parsed.condition,
      manualUrl: manualEntry?.manualUrl ?? null,
      manualLinked: !!manualEntry,
      repairSteps,
    })
    })
  } catch (err) {
    console.error('Visual assist error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Visual assist failed' },
      { status: 500 }
    )
  }
}
