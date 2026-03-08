import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { upsertFilterConfig } from '@/lib/services/itContentFilterService'

const VALID_PROVIDERS = ['GOGUARDIAN', 'SECURLY', 'LIGHTSPEED', 'BARK']

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_FILTERS_CONFIGURE)

    const { provider } = await params
    const providerUpper = provider.toUpperCase()

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

    return await runWithOrgContext(orgId, async () => {
      const config = await upsertFilterConfig(orgId, providerUpper, {
        isEnabled,
        webhookSecret,
        apiKey,
        settings,
      })
      return NextResponse.json(ok(config))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to update filter config:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
