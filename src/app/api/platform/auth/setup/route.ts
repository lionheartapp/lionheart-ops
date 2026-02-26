import { hash } from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { fail, ok } from '@/lib/api-response'
import { signPlatformAuthToken } from '@/lib/auth/platform-auth'

/**
 * One-time setup: Create the first platform super-admin.
 * Only works if no platform admins exist yet.
 */
export async function POST(req: NextRequest) {
  try {
    // Check if any platform admin already exists
    const existingCount = await rawPrisma.platformAdmin.count()
    if (existingCount > 0) {
      return NextResponse.json(
        fail('FORBIDDEN', 'Platform admin already exists. Use the admin panel to manage admins.'),
        { status: 403 }
      )
    }

    const body = (await req.json()) as { email?: string; password?: string; name?: string }
    const email = body.email?.trim().toLowerCase()
    const password = body.password
    const name = body.name?.trim()

    if (!email || !password) {
      return NextResponse.json(fail('BAD_REQUEST', 'email and password are required'), { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json(fail('BAD_REQUEST', 'Password must be at least 8 characters'), { status: 400 })
    }

    const passwordHash = await hash(password, 12)

    const admin = await rawPrisma.platformAdmin.create({
      data: {
        email,
        passwordHash,
        name: name || null,
        role: 'SUPER_ADMIN',
      },
    })

    const token = await signPlatformAuthToken({
      adminId: admin.id,
      email: admin.email,
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
      }),
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/platform/auth/setup]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
