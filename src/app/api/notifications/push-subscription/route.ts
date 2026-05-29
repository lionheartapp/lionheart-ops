/**
 * POST/DELETE /api/notifications/push-subscription
 *
 * Register or remove a Web Push subscription for the current user.
 * Unlike /api/messaging/push-subscription, this is NOT gated behind messaging —
 * push notifications work for all notification types (tickets, events, approvals, etc.).
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api/with-auth'
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

// @authOnly Push subscriptions are stored only against the signed-in user.
// POST — register a push subscription
export const POST = withAuth<z.infer<typeof SubscribeSchema>>(
  async ({ ctx, body }) => {
    const { endpoint, keys } = body

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
  async ({ ctx, body }) => {
    const { endpoint } = body

    await prisma.pushSubscription.deleteMany({
      where: { userId: ctx.userId, endpoint },
    })

    return NextResponse.json(ok({ unsubscribed: true }))
  },
  { schema: UnsubscribeSchema },
)
