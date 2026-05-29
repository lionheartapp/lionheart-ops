import { NextResponse } from 'next/server'
import { fail } from '@/lib/api-response'

type CodedError = Error & { code?: string }

export function inventoryErrorResponse(error: unknown) {
  const err = error as CodedError
  if (!err?.code) throw error

  if (err.code === 'NOT_FOUND') {
    return NextResponse.json(fail('NOT_FOUND', err.message), { status: 404 })
  }

  if (err.code === 'INSUFFICIENT_STOCK' || err.code === 'ALREADY_CHECKED_IN') {
    return NextResponse.json(fail(err.code, err.message), { status: 409 })
  }

  throw error
}
