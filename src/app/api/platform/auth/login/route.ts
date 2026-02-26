import { compare } from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { signPlatformAuthToken } from '@/lib/auth/platform-auth'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; password?: string }
    const email = body.email?.trim().toLowerCase()
    const password = body.password

    if (!email || !password) {
      return NextResponse.json(fail('BAD_REQUEST', 'email and password are required'), { status: 400 })
    }

    const admin = await rawPrisma.platformAdmin.findUnique({
      where: { email },
    })

    if (!admin) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Invalid credentials'), { status: 401 })
    }

    const valid = await compare(password, admin.passwordHash)
    if (!valid) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Invalid credentials'), { status: 401 })
    }

    const token = await signPlatformAuthToken({
      adminId: admin.id,
      email: admin.email,
    })

    // Update last login time (fire and forget)
    void rawPrisma.platformAdmin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    })

    return NextResponse.json(
      ok({
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
      })
    )
  } catch (error) {
    console.error('[POST /api/platform/auth/login]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
