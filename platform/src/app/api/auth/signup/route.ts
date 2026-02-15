import { NextRequest, NextResponse } from 'next/server'
import { prismaBase } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { corsHeaders } from '@/lib/cors'

/** Create new tenant (Organization) + admin User. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      schoolName?: string
      name?: string
      email?: string
      password?: string
    }
    const schoolName = body.schoolName?.trim()
    const name = body.name?.trim()
    const email = body.email?.trim()?.toLowerCase()
    const password = body.password

    if (!schoolName || !name || !email) {
      return NextResponse.json(
        { error: 'Missing schoolName, name, or email' },
        { status: 400, headers: corsHeaders }
      )
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400, headers: corsHeaders }
      )
    }

    const existingUser = await prismaBase.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409, headers: corsHeaders }
      )
    }

    const slug = schoolName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'school'

    const slugExists = await prismaBase.organization.findUnique({ where: { slug } })
    const uniqueSlug = slugExists ? `${slug}-${Date.now().toString(36)}` : slug

    const emailDomain = email.split('@')[1] || ''
    const org = await prismaBase.organization.create({
      data: {
        name: schoolName,
        slug: uniqueSlug,
        plan: 'CORE',
        settings: {
          modules: {
            core: true,
            waterManagement: false,
            visualCampus: { enabled: true },
            advancedInventory: false,
          },
          allowedDomains: emailDomain ? [emailDomain] : [],
        },
      },
    })

    const passwordHash = await hashPassword(password)

    // First user of the org gets SUPER_ADMIN (can manage subscription, see everything)
    const user = await prismaBase.user.create({
      data: {
        email,
        name,
        passwordHash,
        organizationId: org.id,
        role: 'SUPER_ADMIN',
        canSubmitEvents: true,
      },
    })

    return NextResponse.json(
      { orgId: org.id, userId: user.id, slug: org.slug, orgName: org.name, userName: user.name ?? name, userEmail: user.email },
      { headers: corsHeaders }
    )
  } catch (err) {
    console.error('Signup error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Signup failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}
