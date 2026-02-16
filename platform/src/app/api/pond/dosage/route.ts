import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/cors'

/** Legacy: Forward to aquatics/dosage for backward compatibility. */
export async function GET(req: NextRequest) {
  const base = new URL(req.url).origin
  const fwd = await fetch(`${base}/api/aquatics/dosage?${new URL(req.url).searchParams}`, {
    headers: req.headers,
  })
  const data = await fwd.json().catch(() => ({}))
  return NextResponse.json(data, { status: fwd.status, headers: corsHeaders })
}
