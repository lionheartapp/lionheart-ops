import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { safeName } from '@/lib/sanitize'

export const GET = withAuth(async ({ orgId }) => {
  const district = await prisma.district.findFirst({
    where: { organizationId: orgId, deletedAt: null },
    orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      phone: true,
      email: true,
      contactName: true,
      contactTitle: true,
      logoUrl: true,
      _count: { select: { users: true, buildings: true } },
    },
  })

  if (!district) {
    return NextResponse.json(fail('NOT_FOUND', 'No district found'), { status: 404 })
  }

  return NextResponse.json(ok(district))
}, { permission: PERMISSIONS.SETTINGS_READ })

const CreateDistrictSchema = z.object({
  name: safeName({ max: 160 }),
  address: z.string().trim().max(300).optional().nullable(),
})

export const POST = withAuth<z.infer<typeof CreateDistrictSchema>>(async ({ orgId, body }) => {
  // Only allow one district per org for now
  const existing = await prisma.district.findFirst({
    where: { organizationId: orgId, deletedAt: null },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json(fail('CONFLICT', 'A district already exists'), { status: 409 })
  }

  const district = await prisma.district.create({
    data: {
      organizationId: orgId,
      name: body.name,
      address: body.address || null,
      isDefault: true,
    },
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      phone: true,
      email: true,
      contactName: true,
      contactTitle: true,
      logoUrl: true,
      _count: { select: { users: true, buildings: true } },
    },
  })

  return NextResponse.json(ok(district), { status: 201 })
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: CreateDistrictSchema })
