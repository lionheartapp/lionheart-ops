import { describe, it, expect } from 'vitest'
import {
  CreateTemplateInputSchema,
  CreateFromTemplateInputSchema,
} from '@/lib/types/event-template'

// ── CreateTemplateInputSchema ────────────────────────────────────────────────

describe('CreateTemplateInputSchema', () => {
  it('accepts valid input', () => {
    const result = CreateTemplateInputSchema.safeParse({
      name: 'Camp Retreat Template',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = CreateTemplateInputSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects name over 200 characters', () => {
    const result = CreateTemplateInputSchema.safeParse({ name: 'A'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('accepts optional description and eventType', () => {
    const result = CreateTemplateInputSchema.safeParse({
      name: 'Template',
      description: 'A description',
      eventType: 'CAMP',
    })
    expect(result.success).toBe(true)
  })

  it('accepts name at 200 char boundary', () => {
    const result = CreateTemplateInputSchema.safeParse({ name: 'A'.repeat(200) })
    expect(result.success).toBe(true)
  })
})

// ── CreateFromTemplateInputSchema ────────────────────────────────────────────

describe('CreateFromTemplateInputSchema', () => {
  it('accepts valid input', () => {
    const result = CreateFromTemplateInputSchema.safeParse({
      title: 'Spring Camp 2026',
      startsAt: '2026-06-01T08:00:00.000Z',
      endsAt: '2026-06-03T17:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty title', () => {
    const result = CreateFromTemplateInputSchema.safeParse({
      title: '',
      startsAt: '2026-06-01T08:00:00.000Z',
      endsAt: '2026-06-03T17:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid datetime format', () => {
    const result = CreateFromTemplateInputSchema.safeParse({
      title: 'Test',
      startsAt: 'not-a-date',
      endsAt: '2026-06-03T17:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional locationText', () => {
    const result = CreateFromTemplateInputSchema.safeParse({
      title: 'Test Event',
      startsAt: '2026-06-01T08:00:00.000Z',
      endsAt: '2026-06-03T17:00:00.000Z',
      locationText: 'Main Campus',
    })
    expect(result.success).toBe(true)
  })

  it('rejects title over 300 characters', () => {
    const result = CreateFromTemplateInputSchema.safeParse({
      title: 'A'.repeat(301),
      startsAt: '2026-06-01T08:00:00.000Z',
      endsAt: '2026-06-03T17:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })
})
