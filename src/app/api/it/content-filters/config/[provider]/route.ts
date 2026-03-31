import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { upsertFilterConfig } from '@/lib/services/itContentFilterService'

const VALID_PROVIDERS = ['GOGUARDIAN', 'SECURLY', 'LIGHTSPEED', 'BARK']

export const PUT = withAuth(async ({ req, orgId, params }) => {
  const providerUpper = params.provider.toUpperCase()

  if (!VALID_PROVIDERS.includes(providerUpper)) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}`),
      { status: 400 }
    )
  }

  const body = await req.json()
  const { isEnabled, webhookSecret, apiKey, settings } = body as {
    isEnabled?: boolean
    webhookSecret?: string
    apiKey?: string
    settings?: Record<string, unknown>
  }

  const config = await upsertFilterConfig(orgId, providerUpper, {
    isEnabled,
    webhookSecret,
    apiKey,
    settings,
  })
  return NextResponse.json(ok(config))
}, { permission: PERMISSIONS.IT_FILTERS_CONFIGURE })
