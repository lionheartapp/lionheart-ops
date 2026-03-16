/**
 * Twilio SMS Integration Service
 *
 * Handles SMS sending for day-of updates and deadline reminders.
 * Credentials are stored per-org in IntegrationCredential.
 * All functions gracefully return null if credentials are not configured.
 */

import Twilio from 'twilio'
import { rawPrisma } from '@/lib/db'
import type { SMSResult, BulkSMSResult } from '@/lib/types/integrations'

// ─── Availability check ──────────────────────────────────────────────────────

/**
 * Checks whether the org has an active Twilio IntegrationCredential.
 */
export async function isAvailable(organizationId: string): Promise<boolean> {
  const cred = await rawPrisma.integrationCredential.findFirst({
    where: { organizationId, provider: 'twilio', isActive: true },
    select: { id: true, config: true },
  })

  if (!cred) return false
  const config = cred.config as Record<string, string> | null
  return !!(config?.accountSid && config?.authToken && config?.phoneNumber)
}

// ─── Get Twilio client for org ────────────────────────────────────────────────

async function getTwilioClient(
  organizationId: string
): Promise<{ client: Twilio.Twilio; fromNumber: string; credentialId: string } | null> {
  const cred = await rawPrisma.integrationCredential.findFirst({
    where: { organizationId, provider: 'twilio', isActive: true },
  })

  if (!cred) return null
  const config = cred.config as Record<string, string> | null
  if (!config?.accountSid || !config?.authToken || !config?.phoneNumber) return null

  return {
    client: Twilio(config.accountSid, config.authToken),
    fromNumber: config.phoneNumber,
    credentialId: cred.id,
  }
}

// ─── Send SMS ────────────────────────────────────────────────────────────────

/**
 * Sends an SMS to a single recipient.
 * Returns the message SID and status, or null if Twilio is not configured.
 */
export async function sendSMS(
  organizationId: string,
  to: string,
  body: string
): Promise<SMSResult | null> {
  const twilioContext = await getTwilioClient(organizationId)
  if (!twilioContext) return null

  const { client, fromNumber, credentialId } = twilioContext

  try {
    const message = await client.messages.create({
      from: fromNumber,
      to,
      body,
    })

    // Log the send
    await rawPrisma.integrationSyncLog.create({
      data: {
        organizationId,
        credentialId,
        provider: 'twilio',
        action: 'send_sms',
        status: 'success',
        recordsProcessed: 1,
        recordsFailed: 0,
        metadata: { sid: message.sid, to, status: message.status },
      },
    })

    return { sid: message.sid, status: message.status, to }
  } catch (error) {
    await rawPrisma.integrationSyncLog.create({
      data: {
        organizationId,
        credentialId,
        provider: 'twilio',
        action: 'send_sms',
        status: 'failed',
        recordsProcessed: 0,
        recordsFailed: 1,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: { to },
      },
    })
    return null
  }
}

// ─── Send bulk SMS ───────────────────────────────────────────────────────────

/**
 * Sends SMS to multiple recipients with a 1-second rate limit between sends.
 * Uses Promise.allSettled to collect partial results.
 */
export async function sendBulkSMS(
  organizationId: string,
  recipients: Array<{ to: string; body: string }>
): Promise<BulkSMSResult> {
  const result: BulkSMSResult = { sent: 0, failed: 0, results: [] }

  const twilioContext = await getTwilioClient(organizationId)
  if (!twilioContext) {
    result.failed = recipients.length
    result.results = recipients.map((r) => ({
      to: r.to,
      status: 'failed',
      error: 'Twilio not configured',
    }))
    return result
  }

  const { client, fromNumber, credentialId } = twilioContext

  // Send with rate limiting — 1 per second to respect Twilio rate limits
  for (let i = 0; i < recipients.length; i++) {
    const { to, body } = recipients[i]

    try {
      const message = await client.messages.create({ from: fromNumber, to, body })
      result.sent++
      result.results.push({ to, sid: message.sid, status: message.status })
    } catch (error) {
      result.failed++
      result.results.push({
        to,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    // Rate limit: wait 1 second between sends (except after the last one)
    if (i < recipients.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  // Log summary
  await rawPrisma.integrationSyncLog.create({
    data: {
      organizationId,
      credentialId,
      provider: 'twilio',
      action: 'send_bulk_sms',
      status: result.failed === 0 ? 'success' : result.sent > 0 ? 'partial' : 'failed',
      recordsProcessed: result.sent,
      recordsFailed: result.failed,
      metadata: { total: recipients.length, sent: result.sent, failed: result.failed },
    },
  })

  return result
}

// ─── Delivery status ─────────────────────────────────────────────────────────

/**
 * Checks the delivery status of a Twilio message by SID.
 */
export async function getDeliveryStatus(
  organizationId: string,
  messageSid: string
): Promise<{ sid: string; status: string; errorCode?: number | null } | null> {
  const twilioContext = await getTwilioClient(organizationId)
  if (!twilioContext) return null

  try {
    const message = await twilioContext.client.messages(messageSid).fetch()
    return { sid: message.sid, status: message.status, errorCode: message.errorCode }
  } catch {
    return null
  }
}

// ─── Save credentials ────────────────────────────────────────────────────────

/**
 * Saves Twilio credentials for an org. Upserts the IntegrationCredential row.
 */
export async function saveCredentials(
  organizationId: string,
  accountSid: string,
  authToken: string,
  phoneNumber: string
): Promise<void> {
  await rawPrisma.integrationCredential.upsert({
    where: {
      organizationId_provider_userId: {
        organizationId,
        provider: 'twilio',
        userId: null as unknown as string,
      },
    },
    create: {
      organizationId,
      provider: 'twilio',
      userId: null,
      config: { accountSid, authToken, phoneNumber },
      isActive: true,
    },
    update: {
      config: { accountSid, authToken, phoneNumber },
      isActive: true,
      updatedAt: new Date(),
    },
  })
}

// ─── Disconnect ──────────────────────────────────────────────────────────────

export async function disconnect(organizationId: string): Promise<void> {
  await rawPrisma.integrationCredential.updateMany({
    where: { organizationId, provider: 'twilio' },
    data: { isActive: false, updatedAt: new Date() },
  })
}
