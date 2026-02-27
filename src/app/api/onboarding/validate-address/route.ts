/**
 * Address Validation API
 *
 * POST /api/onboarding/validate-address
 * Validates and formats a physical address using Google Address Validation API.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getUserContext } from '@/lib/request-context'
import { ok, fail } from '@/lib/api-response'
import { validateAddress } from '@/lib/services/addressValidationService'

const ValidateAddressSchema = z.object({
  address: z.string().min(5, 'Address is too short').max(400),
})

export async function POST(req: NextRequest) {
  try {
    await getUserContext(req) // verify auth

    const body = await req.json()
    const validation = ValidateAddressSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request', validation.error.issues),
        { status: 400 }
      )
    }

    const result = await validateAddress(validation.data.address)

    if (!result) {
      return NextResponse.json(
        fail('VALIDATION_UNAVAILABLE', 'Address validation is temporarily unavailable'),
        { status: 503 }
      )
    }

    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Missing or invalid authorization')) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    console.error('Address validation error:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to validate address'), { status: 500 })
  }
}
