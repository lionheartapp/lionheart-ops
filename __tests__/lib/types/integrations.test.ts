import { describe, it, expect } from 'vitest'
import {
  TwilioConfigInputSchema,
  SMSInputSchema,
  BulkSMSInputSchema,
} from '@/lib/types/integrations'

// ── TwilioConfigInputSchema ──────────────────────────────────────────────────

describe('TwilioConfigInputSchema', () => {
  it('accepts valid config', () => {
    const result = TwilioConfigInputSchema.safeParse({
      accountSid: 'AC1234567890abcdef',
      authToken: 'token123',
      phoneNumber: '+15555551234',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty accountSid', () => {
    const result = TwilioConfigInputSchema.safeParse({
      accountSid: '',
      authToken: 'token',
      phoneNumber: '+15555551234',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid phone number format', () => {
    const result = TwilioConfigInputSchema.safeParse({
      accountSid: 'AC123',
      authToken: 'token',
      phoneNumber: '555-123-4567',
    })
    expect(result.success).toBe(false)
  })

  it('accepts E.164 format with country code', () => {
    const result = TwilioConfigInputSchema.safeParse({
      accountSid: 'AC123',
      authToken: 'token',
      phoneNumber: '+447911123456',
    })
    expect(result.success).toBe(true)
  })
})

// ── SMSInputSchema ───────────────────────────────────────────────────────────

describe('SMSInputSchema', () => {
  it('accepts valid SMS input', () => {
    const result = SMSInputSchema.safeParse({
      to: '+15555551234',
      body: 'Hello from Lionheart',
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-E.164 phone', () => {
    const result = SMSInputSchema.safeParse({
      to: '5551234567',
      body: 'Hello',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty body', () => {
    const result = SMSInputSchema.safeParse({
      to: '+15555551234',
      body: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects body over 1600 characters', () => {
    const result = SMSInputSchema.safeParse({
      to: '+15555551234',
      body: 'A'.repeat(1601),
    })
    expect(result.success).toBe(false)
  })

  it('accepts body at 1600 char boundary', () => {
    const result = SMSInputSchema.safeParse({
      to: '+15555551234',
      body: 'A'.repeat(1600),
    })
    expect(result.success).toBe(true)
  })
})

// ── BulkSMSInputSchema ──────────────────────────────────────────────────────

describe('BulkSMSInputSchema', () => {
  it('accepts valid bulk SMS input', () => {
    const result = BulkSMSInputSchema.safeParse({
      recipients: [
        { to: '+15555551234', body: 'Hello' },
        { to: '+15555559876', body: 'World' },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty recipients array', () => {
    const result = BulkSMSInputSchema.safeParse({ recipients: [] })
    expect(result.success).toBe(false)
  })

  it('rejects more than 100 recipients', () => {
    const recipients = Array.from({ length: 101 }, (_, i) => ({
      to: `+1555555${String(i).padStart(4, '0')}`,
      body: 'Test',
    }))
    const result = BulkSMSInputSchema.safeParse({ recipients })
    expect(result.success).toBe(false)
  })

  it('accepts exactly 100 recipients', () => {
    const recipients = Array.from({ length: 100 }, (_, i) => ({
      to: `+1555555${String(i).padStart(4, '0')}`,
      body: 'Test',
    }))
    const result = BulkSMSInputSchema.safeParse({ recipients })
    expect(result.success).toBe(true)
  })
})
