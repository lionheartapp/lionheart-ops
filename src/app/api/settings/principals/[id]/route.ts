import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

type RouteParams = {
  params: Promise<{
    id: string
  }>
}

const isValidPhone = (value: string) => {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

const splitName = (value: string) => {
  const normalized = value.trim().replace(/\s+/g, ' ')
  const parts = normalized.split(' ').filter(Boolean)
  const firstName = parts[0] || ''
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : firstName
  return { firstName, lastName }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    const body = await req.json()

    await assertCan(userContext.userId, PERMISSIONS.USERS_UPDATE)

    const principalName = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const jobTitle = typeof body.jobTitle === 'string' ? body.jobTitle.trim() : 'Principal'

    if (!principalName) {
      return NextResponse.json(fail('BAD_REQUEST', 'Principal name is required'), { status: 400 })
    }

    if (!email) {
      return NextResponse.json(fail('BAD_REQUEST', 'Principal email is required'), { status: 400 })
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Principal email must be valid'), { status: 400 })
    }

    if (phone && !isValidPhone(phone)) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Principal phone must be a valid phone number'),
        { status: 400 }
      )
    }

    const existing = await prisma.user.findFirst({
      where: {
        id,
        organizationId: orgId,
      },
      select: {
        id: true,
        email: true,
      },
    })

    if (!existing) {
      return NextResponse.json(fail('NOT_FOUND', 'Principal not found'), { status: 404 })
    }

    if (email !== existing.email) {
      const duplicate = await prisma.user.findUnique({
        where: {
          organizationId_email: {
            organizationId: orgId,
            email,
          },
        },
        select: { id: true },
      })

      if (duplicate) {
        return NextResponse.json(fail('CONFLICT', 'A user with this email already exists'), { status: 409 })
      }
    }

    const { firstName, lastName } = splitName(principalName)

    const updated = await prisma.user.update({
      where: {
        organizationId_email: {
          organizationId: orgId,
          email: existing.email,
        },
      },
      data: {
        email,
        firstName,
        lastName,
        name: `${firstName} ${lastName}`.trim(),
        phone: phone || null,
        jobTitle: jobTitle || 'Principal',
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
        id: updated.id,
        name: `${updated.firstName || ''} ${updated.lastName || ''}`.trim(),
        email: updated.email,
        phone: updated.phone,
        jobTitle: updated.jobTitle || '',
      })
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }

    console.error('Failed to update principal:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to update principal'), { status: 500 })
  }
}
