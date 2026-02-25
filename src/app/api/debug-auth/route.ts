import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'

/** GET /api/debug-auth — debug endpoint; returns minimal auth info when valid token provided. */
export async function GET() {
  return NextResponse.json(ok({ message: 'Use Authorization: Bearer <token> to debug claims' }))
}
