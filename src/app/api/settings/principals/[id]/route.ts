import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'

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

export const PATCH = withAuth<unknown, { id: string }>(async ({ req, orgId, params }) => {
  const body = await req.json()

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
      id: params.id,
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
}, { permission: PERMISSIONS.USERS_UPDATE })
