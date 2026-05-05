import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'

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
