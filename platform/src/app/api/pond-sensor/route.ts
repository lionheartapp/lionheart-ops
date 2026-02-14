import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { corsHeaders } from '@/lib/cors'

/** POST: Receive IoT probe data or manual entry. GET: Latest readings. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      pH?: number
      turbidity?: number
      temperature?: number
      dissolvedOxygen?: number
      alkalinity?: number
      source?: 'sensor' | 'manual'
      notes?: string
    }
    const pH = typeof body.pH === 'number' ? body.pH : parseFloat(String(body.pH))
    const turbidity =
      typeof body.turbidity === 'number' ? body.turbidity : parseFloat(String(body.turbidity))
    const temperature =
      typeof body.temperature === 'number'
        ? body.temperature
        : parseFloat(String(body.temperature))
    const dissolvedOxygen = body.dissolvedOxygen != null ? parseFloat(String(body.dissolvedOxygen)) : undefined
    const alkalinity = body.alkalinity != null ? parseFloat(String(body.alkalinity)) : undefined

    if (isNaN(pH) || isNaN(turbidity) || isNaN(temperature)) {
      return NextResponse.json(
        { error: 'pH, turbidity, and temperature required (numbers)' },
        { status: 400, headers: corsHeaders }
      )
    }

    const log = await prisma.pondLog.create({
      data: {
        pH,
        turbidity,
        temperature,
        dissolvedOxygen: isNaN(dissolvedOxygen) ? undefined : dissolvedOxygen,
        alkalinity: isNaN(alkalinity) ? undefined : alkalinity,
        source: body.source || 'manual',
        notes: body.notes,
      },
    })
    return NextResponse.json(log, { headers: corsHeaders })
  } catch (err) {
    console.error('Pond sensor error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}


export async function GET() {
  try {
    const logs = await prisma.pondLog.findMany({
      take: 1,
      orderBy: { createdAt: 'desc' },
    })
    const latest = logs[0]
    return NextResponse.json(
      latest ?? { pH: null, turbidity: null, temperature: null, createdAt: null },
      { headers: corsHeaders }
    )
  } catch {
    // Demo fallback when DB unavailable
    return NextResponse.json(
      {
        pH: 7.2,
        turbidity: 25,
        temperature: 18,
        source: 'manual',
        createdAt: new Date().toISOString(),
      },
      { headers: corsHeaders }
    )
  }
}
