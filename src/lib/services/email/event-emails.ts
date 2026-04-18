/** Event-related emails: update, approved, rejected, cancelled, invite */

import { sendBrandedEmail, getAppUrl, type SendEmailResult } from './transport'
import { logger } from '@/lib/logger'

const log = logger.child({ service: 'eventEmails' })

type EventNotifyEmailInput = {
  to: string
  eventTitle: string
  orgName: string
  appUrl?: string
  eventLink?: string
}

type EventUpdateEmailInput = {
  eventTitle: string
  eventStart: string
  eventEnd: string
  attendeeEmails: string[]
  updatedByName: string
  orgName: string
  appUrl?: string
  eventLink?: string
}

type EventApprovedEmailInput = EventNotifyEmailInput & { channelName: string }
type EventRejectedEmailInput = EventNotifyEmailInput & { reason?: string }
type EventInviteEmailInput = EventNotifyEmailInput & { eventDate?: string; eventTime?: string; eventId?: string }

export async function sendEventUpdateEmails(input: EventUpdateEmailInput): Promise<void> {
  if (input.attendeeEmails.length === 0) return

  const startDate = new Date(input.eventStart)
  const endDate = new Date(input.eventEnd)
  const dateStr = startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const startStr = startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const endStr = endDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  const vars = {
    eventTitle: input.eventTitle,
    eventDate: dateStr,
    eventTime: `${startStr} – ${endStr}`,
    updatedByName: input.updatedByName,
    orgName: input.orgName,
    appUrl: input.appUrl || getAppUrl(),
    eventLink: input.eventLink || getAppUrl(),
  }

  for (const email of input.attendeeEmails) {
    sendBrandedEmail('event_updated', email, vars).catch((err) => {
      log.error({ err: String(err) }, 'Failed to send event update email')
    })
  }
}

export async function sendEventApprovedEmail(input: EventApprovedEmailInput): Promise<SendEmailResult> {
  return sendBrandedEmail('event_approved', input.to, {
    eventTitle: input.eventTitle,
    channelName: input.channelName,
    orgName: input.orgName,
    appUrl: input.appUrl || getAppUrl(),
    eventLink: input.eventLink || getAppUrl(),
  })
}

export async function sendEventRejectedEmail(input: EventRejectedEmailInput): Promise<SendEmailResult> {
  return sendBrandedEmail('event_rejected', input.to, {
    eventTitle: input.eventTitle,
    reason: input.reason,
    orgName: input.orgName,
    appUrl: input.appUrl || getAppUrl(),
    eventLink: input.eventLink || getAppUrl(),
  })
}

export async function sendEventCancelledEmail(input: EventNotifyEmailInput): Promise<SendEmailResult> {
  return sendBrandedEmail('event_cancelled', input.to, {
    eventTitle: input.eventTitle,
    orgName: input.orgName,
    appUrl: input.appUrl || getAppUrl(),
    eventLink: input.eventLink || getAppUrl(),
  })
}

export async function sendEventInviteEmail(input: EventInviteEmailInput): Promise<SendEmailResult> {
  return sendBrandedEmail('event_invite', input.to, {
    eventTitle: input.eventTitle,
    eventDate: input.eventDate,
    eventTime: input.eventTime,
    eventId: input.eventId,
    orgName: input.orgName,
    appUrl: input.appUrl || getAppUrl(),
    eventLink: input.eventLink || getAppUrl(),
  })
}
