import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getProvisioningConfig, updateProvisioningConfig, UpdateConfigSchema } from '@/lib/services/itProvisioningService'

export const GET = withAuth(async () => {
  const config = await getProvisioningConfig()
  return NextResponse.json(ok(config))
}, { permission: PERMISSIONS.IT_PROVISIONING_MANAGE })

export const PATCH = withAuth(async ({ body }) => {
  const config = await updateProvisioningConfig(body)
  return NextResponse.json(ok(config))
}, { permission: PERMISSIONS.IT_PROVISIONING_MANAGE, schema: UpdateConfigSchema })
