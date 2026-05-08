/**
 * POST/DELETE /api/messaging/push-subscription
 *
 * Register or remove a Web Push subscription for the current user (D-07, D-09).
 * Push endpoints MUST be HTTPS per the Web Push protocol.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api/with-auth'
import { assertMessagingEnabled } from '@/lib/api/messaging-gate'
import { ok, fail } from '@/lib/api-response'
import { prisma } from '@/lib/db'

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

const UnsubscribeSchema = z.object({
  endpoint: z.string().url(),
})

// POST — register a push subscription
export const POST = withAuth<z.infer<typeof SubscribeSchema>>(
  async ({ ctx, orgId, body }) => {
    const blocked = await assertMessagingEnabled(orgId)
    if (blocked) return blocked

    const { endpoint, keys } = body

    // Web Push protocol requires HTTPS endpoints
    if (!endpoint.startsWith('https://')) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Push endpoint must use HTTPS'),
        { status: 400 },
      )
    }

    await prisma.pushSubscription.upsert({
      where: { userId_endpoint: { userId: ctx.userId, endpoint } },
      create: {
        userId: ctx.userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      } as any,
      update: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    })

    return NextResponse.json(ok({ subscribed: true }))
  },
  { schema: SubscribeSchema },
)

// DELETE — remove a push subscription
export const DELETE = withAuth<z.infer<typeof UnsubscribeSchema>>(
  async ({ ctx, orgId, body }) => {
    const blocked = await assertMessagingEnabled(orgId)
    if (blocked) return blocked

    const { endpoint } = body

    await prisma.pushSubscription.deleteMany({
      where: { userId: ctx.userId, endpoint },
    })

    return NextResponse.json(ok({ unsubscribed: true }))
  },
  { schema: UnsubscribeSchema },
)
