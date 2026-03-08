/**
 * POST /api/it/student-password/reset — reset password using token
 *
 * No authentication required. Validates the token and sets the new password.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import * as bcrypt from 'bcryptjs'
import { resetPassword } from '@/lib/services/itStudentPasswordService'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, newPassword } = body as {
      token: string
      newPassword: string
    }

    if (!token || !newPassword) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'token and newPassword are required'),
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Password must be at least 8 characters'),
        { status: 400 }
      )
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 10)

    // Reset the password (validates token, marks used, updates user)
    const result = await resetPassword(token, passwordHash)

    return NextResponse.json(ok({
      success: result.success,
    }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid or expired token')) {
      return NextResponse.json(
        fail('INVALID_TOKEN', 'Invalid or expired reset token'),
        { status: 400 }
      )
    }
    console.error('[POST /api/it/student-password/reset]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
