import { NextRequest, NextResponse } from 'next/server'
import { prismaBase } from '@/lib/prisma'
import { verifyPassword, createToken } from '@/lib/auth'
import { corsHeaders } from '@/lib/cors'

/** Login with email + password. Returns JWT for Bearer auth. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; password?: string }
    const email = body.email?.trim()?.toLowerCase()
    const password = body.password

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Missing email or password' },
        { status: 400, headers: corsHeaders }
      )
    }

    const user = await prismaBase.user.findUnique({
      where: { email },
      include: { organization: true },
    })

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401, headers: corsHeaders }
      )
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401, headers: corsHeaders }
      )
    }

    const token = await createToken({
      userId: user.id,
      email: user.email,
      orgId: user.organizationId,
    })

    return NextResponse.json(
      {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          orgId: user.organizationId,
          orgName: user.organization?.name,
        },
      },
      { headers: corsHeaders }
    )
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Login failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}
