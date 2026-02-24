import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma as prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

// GET - Search for principals by name
export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    // Check permission
    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_READ)

    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q') || ''

    const users = await prisma.user.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        jobTitle: true,
      },
      take: 10,
    })

    return NextResponse.json(
      ok({
        data: users.map((u) => ({
          id: u.id,
          name: `${u.firstName} ${u.lastName}`.trim(),
          email: u.email,
          phone: u.phone,
          jobTitle: u.jobTitle,
        })),
      })
    )
  } catch (err) {
    console.error('Failed to search principals:', err)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to search principals'),
      { status: 500 }
    )
  }
}

// POST - Create a new principal (user)
export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    const body = await req.json()

    // Check permission
    await assertCan(userContext.userId, PERMISSIONS.USERS_INVITE)

    const principalName = String(body.name || '').trim()
    const phone = String(body.phone || '').trim() || null
    const phoneExt = String(body.phoneExt || '').trim() || null

    if (!principalName) {
      return NextResponse.json(
        fail('BAD_REQUEST', 'Principal name is required'),
        { status: 400 }
      )
    }

    // Split name into first and last
    const [firstName, ...lastNameParts] = principalName.split(' ')
    const lastName = lastNameParts.join(' ') || firstName

    // Generate email from name (for now, we'll use a placeholder that can be updated later)
    const email = `principal-${Date.now()}@temp.local`

    // Check if email already exists (shouldn't happen with our temp email)
    const existing = await prisma.user.findUnique({
      where: {
        organizationId_email: {
          organizationId: orgId,
          email,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        fail('CONFLICT', 'Principal already exists'),
        { status: 409 }
      )
    }

    // Get a basic role for the principal (e.g., "Staff" or similar)
    // For now, we'll try to find a role, but if it doesn't exist, we'll use the first available role
    let roleId = null
    const roles = await prisma.role.findMany({
      where: { organizationId: orgId },
      select: { id: true },
      take: 1,
    })
    if (roles.length > 0) {
      roleId = roles[0].id
    }

    if (!roleId) {
      return NextResponse.json(
        fail('BAD_REQUEST', 'No roles available in organization'),
        { status: 400 }
      )
    }

    // Create the user
    const user = await prisma.user.create({
      data: {
        organizationId: orgId,
        email,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        phone: phone || null,
        jobTitle: 'Principal',
        passwordHash: '', // Will need to be set later
        roleId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        jobTitle: true,
      },
    })

    return NextResponse.json(
      ok({
        data: {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`.trim(),
          email: user.email,
          phone: user.phone,
          jobTitle: user.jobTitle,
        },
      }),
      { status: 201 }
    )
  } catch (err) {
    console.error('Failed to create principal:', err)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to create principal'),
      { status: 500 }
    )
  }
}
