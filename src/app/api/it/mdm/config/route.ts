/**
 * GET /api/it/mdm/config — get MDM configuration
 * PUT /api/it/mdm/config — set MDM configuration
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getConfig, setConfig } from '@/lib/services/itMdmService'

export const GET = withAuth(async () => {
  const config = await getConfig()
  return NextResponse.json(ok(config))
}, { permission: PERMISSIONS.IT_MDM_CONFIGURE })

export const PUT = withAuth(async ({ req }) => {
  const body = await req.json()
  const { provider, credentials } = body as {
    provider: string
    credentials: Record<string, string>
  }

  if (!provider) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'provider is required'),
      { status: 400 }
    )
  }

  const result = await setConfig(provider as 'jamf' | 'mosyle', credentials || {})
  return NextResponse.json(ok(result))
}, { permission: PERMISSIONS.IT_MDM_CONFIGURE })
