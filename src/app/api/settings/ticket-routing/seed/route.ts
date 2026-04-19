import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { seedRoutingDefaults } from '@/lib/services/ticketRoutingService'

export const POST = withAuth(async ({ orgId }) => {
  await seedRoutingDefaults(orgId)
  return NextResponse.json(ok({ seeded: true }))
}, { permission: PERMISSIONS.SETTINGS_UPDATE })
