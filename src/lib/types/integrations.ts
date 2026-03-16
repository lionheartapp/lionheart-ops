import { z } from 'zod'

// ─── Provider types ─────────────────────────────────────────────────────────

export type IntegrationProvider =
  | 'planning_center'
  | 'google_calendar'
  | 'twilio'

export interface IntegrationStatus {
  provider: IntegrationProvider
  isConnected: boolean
  lastSyncAt?: string | null
  /** Per-user display name (Google Calendar) */
  userName?: string | null
  /** Org name or account identifier (PCO, Twilio) */
  orgName?: string | null
  /** Phone number for Twilio */
  phoneNumber?: string | null
  /** Whether the integration is available (env vars set) */
  isAvailable: boolean
}

// ─── Zod input schemas ───────────────────────────────────────────────────────

export const TwilioConfigInputSchema = z.object({
  accountSid: z.string().min(1, 'Account SID is required'),
  authToken: z.string().min(1, 'Auth Token is required'),
  phoneNumber: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format (e.g. +15555551234)'),
})

export type TwilioConfigInput = z.infer<typeof TwilioConfigInputSchema>

export const SMSInputSchema = z.object({
  to: z
    .string()
    .min(1, 'Recipient phone number is required')
    .regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format (e.g. +15555551234)'),
  body: z.string().min(1, 'Message body is required').max(1600, 'SMS body too long'),
})

export type SMSInput = z.infer<typeof SMSInputSchema>

export const BulkSMSInputSchema = z.object({
  recipients: z
    .array(
      z.object({
        to: z.string().regex(/^\+[1-9]\d{1,14}$/),
        body: z.string().min(1).max(1600),
      })
    )
    .min(1, 'At least one recipient is required')
    .max(100, 'Cannot send to more than 100 recipients at once'),
})

export type BulkSMSInput = z.infer<typeof BulkSMSInputSchema>

// ─── Planning Center sync result types ──────────────────────────────────────

export interface PCOSyncResult {
  matched: number
  unmatched: number
  errors: number
  details?: string[]
}

// ─── Google Calendar types ───────────────────────────────────────────────────

export interface GoogleCalendarEvent {
  googleEventId: string
  htmlLink?: string
}

// ─── Twilio send result ──────────────────────────────────────────────────────

export interface SMSResult {
  sid: string
  status: string
  to: string
}

export interface BulkSMSResult {
  sent: number
  failed: number
  results: Array<{ to: string; sid?: string; status: string; error?: string }>
}
