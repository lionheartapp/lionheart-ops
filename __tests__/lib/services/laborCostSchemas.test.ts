import { describe, it, expect } from 'vitest'
import {
  CreateLaborEntrySchema,
  UpdateLaborEntrySchema,
  CreateCostEntrySchema,
  UpdateCostEntrySchema,
} from '@/lib/services/laborCostService'

describe('CreateLaborEntrySchema', () => {
  it('parses valid input', () => {
    const input = {
      technicianId: 'tech-1',
      startTime: '2026-04-07T09:00:00Z',
      endTime: '2026-04-07T10:00:00Z',
      durationMinutes: 60,
      notes: 'Replaced filter',
    }
    expect(() => CreateLaborEntrySchema.parse(input)).not.toThrow()
  })

  it('requires technicianId', () => {
    expect(() =>
      CreateLaborEntrySchema.parse({ startTime: '2026-04-07T09:00:00Z' })
    ).toThrow()
  })

  it('requires non-empty technicianId', () => {
    expect(() =>
      CreateLaborEntrySchema.parse({ technicianId: '', startTime: '2026-04-07T09:00:00Z' })
    ).toThrow()
  })

  it('requires valid datetime for startTime', () => {
    expect(() =>
      CreateLaborEntrySchema.parse({ technicianId: 'tech-1', startTime: 'not-a-date' })
    ).toThrow()
  })

  it('endTime and durationMinutes are optional', () => {
    const input = { technicianId: 'tech-1', startTime: '2026-04-07T09:00:00Z' }
    const result = CreateLaborEntrySchema.parse(input)
    expect(result.endTime).toBeUndefined()
    expect(result.durationMinutes).toBeUndefined()
  })

  it('rejects negative durationMinutes', () => {
    expect(() =>
      CreateLaborEntrySchema.parse({
        technicianId: 'tech-1',
        startTime: '2026-04-07T09:00:00Z',
        durationMinutes: -5,
      })
    ).toThrow()
  })

  it('rejects zero durationMinutes', () => {
    expect(() =>
      CreateLaborEntrySchema.parse({
        technicianId: 'tech-1',
        startTime: '2026-04-07T09:00:00Z',
        durationMinutes: 0,
      })
    ).toThrow()
  })
})

describe('UpdateLaborEntrySchema', () => {
  it('parses valid partial update', () => {
    expect(() =>
      UpdateLaborEntrySchema.parse({ durationMinutes: 90 })
    ).not.toThrow()
  })

  it('allows notes-only update', () => {
    const result = UpdateLaborEntrySchema.parse({ notes: 'Updated notes' })
    expect(result.notes).toBe('Updated notes')
  })

  it('allows empty object (all fields optional)', () => {
    expect(() => UpdateLaborEntrySchema.parse({})).not.toThrow()
  })
})

describe('CreateCostEntrySchema', () => {
  it('parses valid input', () => {
    const input = {
      vendor: 'HVAC Supply Co',
      description: 'Air filter replacement',
      amount: 125.50,
      receiptUrl: 'https://storage.example.com/receipt.pdf',
    }
    expect(() => CreateCostEntrySchema.parse(input)).not.toThrow()
  })

  it('requires vendor', () => {
    expect(() =>
      CreateCostEntrySchema.parse({ description: 'desc', amount: 10 })
    ).toThrow()
  })

  it('requires positive amount', () => {
    expect(() =>
      CreateCostEntrySchema.parse({ vendor: 'v', description: 'd', amount: -5 })
    ).toThrow()
  })

  it('requires valid URL for receiptUrl', () => {
    expect(() =>
      CreateCostEntrySchema.parse({
        vendor: 'v',
        description: 'd',
        amount: 10,
        receiptUrl: 'not-a-url',
      })
    ).toThrow()
  })

  it('receiptUrl is optional', () => {
    const result = CreateCostEntrySchema.parse({
      vendor: 'v',
      description: 'd',
      amount: 10,
    })
    expect(result.receiptUrl).toBeUndefined()
  })
})

describe('UpdateCostEntrySchema', () => {
  it('parses valid partial update', () => {
    expect(() =>
      UpdateCostEntrySchema.parse({ amount: 200 })
    ).not.toThrow()
  })

  it('allows receiptUrl to be null (remove receipt)', () => {
    const result = UpdateCostEntrySchema.parse({ receiptUrl: null })
    expect(result.receiptUrl).toBeNull()
  })

  it('allows empty object', () => {
    expect(() => UpdateCostEntrySchema.parse({})).not.toThrow()
  })
})
