import { NextResponse } from 'next/server'
import { fail } from '@/lib/api-response'

export async function GET() {
  return NextResponse.json(fail('NOT_IMPLEMENTED', 'Inventory API not implemented'), { status: 501 })
}
