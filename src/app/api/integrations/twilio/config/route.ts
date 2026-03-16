import { NextRequest, NextResponse } from 'next/server'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ok, fail } from '@/lib/api-response'
import { prisma } from '@/lib/db'
import { TwilioConfigInputSchema } from '@/lib/types/integrations'
import * as twilioService from '@/lib/services/integrations/twilioService'

/**
 * GET /api/integrations/twilio/config
 * Returns the current Twilio configuration status for the org.
 */
export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.INTEGRATIONS_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      const cred = await (prisma as any).integrationCredential.findFirst({
        where: { organizationId: orgId, provider: 'twilio', isActive: true },
        select: { id: true, config: true, lastSyncAt: true, createdAt: true },
      })

      if (!cred) {
        return NextResponse.json(ok({ isConfigured: false }))
      }

      const config = cred.config as Record<string, string> | null
      return NextResponse.json(ok({
        isConfigured: !!(config?.accountSid && config?.phoneNumber),
        phoneNumber: config?.phoneNumber || null,
        // Never return the authToken
        lastSyncAt: cred.lastSyncAt,
      }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

/**
 * POST /api/integrations/twilio/config
 * Saves Twilio credentials (accountSid, authToken, phoneNumber).
 */
export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.INTEGRATIONS_MANAGE)

    const body = await req.json()
    const parsed = TwilioConfigInputSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid Twilio configuration', parsed.error.issues), { status: 400 })
    }

    await twilioService.saveCredentials(
      orgId,
      parsed.data.accountSid,
      parsed.data.authToken,
      parsed.data.phoneNumber
    )

    return NextResponse.json(ok({ configured: true, phoneNumber: parsed.data.phoneNumber }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

/**
 * DELETE /api/integrations/twilio/config
 * Removes the Twilio configuration for the org.
 */
export async function DELETE(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.INTEGRATIONS_MANAGE)

    await twilioService.disconnect(orgId)
    return NextResponse.json(ok({ removed: true }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
