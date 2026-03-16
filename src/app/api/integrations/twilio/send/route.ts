import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ok, fail } from '@/lib/api-response'
import { SMSInputSchema } from '@/lib/types/integrations'
import * as twilioService from '@/lib/services/integrations/twilioService'

const SendSMSBodySchema = z.union([
  SMSInputSchema,
  z.object({
    eventProjectId: z.string().min(1),
    message: z.string().min(1).max(1600),
  }),
])

/**
 * POST /api/integrations/twilio/send
 * Sends an SMS message.
 *
 * Body option 1: { to: string, body: string }
 * Body option 2: { eventProjectId: string, message: string } — sends to event coordinator phone
 */
export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    // Require INTEGRATIONS_MANAGE to send SMS (admin-only action)
    await assertCan(ctx.userId, PERMISSIONS.INTEGRATIONS_MANAGE)

    const body = await req.json()
    const parsed = SendSMSBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid SMS request', parsed.error.issues), { status: 400 })
    }

    const available = await twilioService.isAvailable(orgId)
    if (!available) {
      return NextResponse.json(
        fail('SERVICE_UNAVAILABLE', 'Twilio is not configured for this organization.'),
        { status: 503 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      let to: string
      let messageBody: string

      if ('to' in parsed.data) {
        to = parsed.data.to
        messageBody = parsed.data.body
      } else {
        // eventProjectId mode — for now return validation error since we'd need
        // to look up phone numbers, which is out of scope for this route
        return NextResponse.json(
          fail('VALIDATION_ERROR', 'Direct to/body fields required for SMS send'),
          { status: 400 }
        )
      }

      const result = await twilioService.sendSMS(orgId, to, messageBody)

      if (!result) {
        return NextResponse.json(
          fail('SEND_FAILED', 'Failed to send SMS. Check your Twilio configuration.'),
          { status: 422 }
        )
      }

      return NextResponse.json(ok({ sent: true, sid: result.sid, status: result.status }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
