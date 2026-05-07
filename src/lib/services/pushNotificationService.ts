/**
 * Push Notification Service (NOTIF-03)
 *
 * Sends web push notifications via the web-push library.
 * VAPID credentials are read from environment variables.
 * Expired/invalid subscriptions are auto-cleaned on 404/410 responses.
 *
 * Push payloads are intentionally generic — title + channel name only,
 * no message content. The user must open the app and authenticate to
 * read actual messages. (T-28-08 mitigation)
 */

import webpush from 'web-push'
import { rawPrisma } from '@/lib/db'
import { logger } from '@/lib/logger'

const log = logger.child({ service: 'pushNotification' })

// ─── VAPID Configuration ──────────────────────────────────────────────

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:no-reply@lionheartapp.com'

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

// ─── Types ────────────────────────────────────────────────────────────

interface PushSubscriptionKeys {
  endpoint: string
  p256dh: string
  auth: string
}

interface PushPayload {
  title: string
  body: string
  url: string
  icon?: string
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Send a push notification to a single subscription.
 * Returns true on success, false on failure. Never throws — push is best-effort.
 */
export async function sendPushNotification(
  subscription: PushSubscriptionKeys,
  payload: PushPayload
): Promise<boolean> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    log.warn('VAPID keys not configured — skipping push notification')
    return false
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload)
    )
    return true
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode
    // 404 or 410 = subscription expired or unsubscribed — clean it up (T-28-10)
    if (statusCode === 404 || statusCode === 410) {
      log.info({ endpoint: subscription.endpoint }, 'Removing expired push subscription')
      try {
        await rawPrisma.pushSubscription.deleteMany({
          where: { endpoint: subscription.endpoint },
        })
      } catch (deleteErr) {
        log.error({ err: deleteErr }, 'Failed to delete expired push subscription')
      }
    } else {
      log.error({ err, endpoint: subscription.endpoint }, 'Push notification failed')
    }
    return false
  }
}

/**
 * Send a push notification to all subscriptions for a given user.
 * Returns the count of successfully delivered notifications.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<number> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return 0
  }

  try {
    const subscriptions = await rawPrisma.pushSubscription.findMany({
      where: { userId },
      select: { endpoint: true, p256dh: true, auth: true },
    })

    if (subscriptions.length === 0) return 0

    const results = await Promise.allSettled(
      subscriptions.map((sub) => sendPushNotification(sub, payload))
    )

    return results.filter(
      (r) => r.status === 'fulfilled' && r.value === true
    ).length
  } catch (err) {
    log.error({ err, userId }, 'Failed to send push notifications to user')
    return 0
  }
}
