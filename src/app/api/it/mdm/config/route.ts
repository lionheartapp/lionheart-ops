/**
 * GET /api/it/mdm/config — get MDM configuration
 * PUT /api/it/mdm/config — set MDM configuration
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getConfig, setConfig } from '@/lib/services/itMdmService'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_MDM_CONFIGURE)

    const config = await runWithOrgContext(orgId, () => getConfig())

    return NextResponse.json(ok(config))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/it/mdm/config]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_MDM_CONFIGURE)

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

    const result = await runWithOrgContext(orgId, () =>
      setConfig(provider as 'jamf' | 'mosyle', credentials || {})
    )

    return NextResponse.json(ok(result))
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
    }
    console.error('[PUT /api/it/mdm/config]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
