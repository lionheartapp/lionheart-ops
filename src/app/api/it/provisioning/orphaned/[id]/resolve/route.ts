import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { resolveOrphanedAccount, ResolveOrphanedSchema } from '@/lib/services/itProvisioningService'

export const POST = withAuth(async ({ ctx, params, body }) => {
  const result = await resolveOrphanedAccount(params.id, body.action, ctx.userId, body.notes)
  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.IT_PROVISIONING_MANAGE, schema: ResolveOrphanedSchema })
