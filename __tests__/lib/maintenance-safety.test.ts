import { describe, expect, it } from 'vitest'
import { getMaintenanceSafetyGuidance } from '@/lib/maintenance-safety'

describe('maintenance safety guidance', () => {
  it('returns category-specific PPE and stop conditions for electrical work', () => {
    const guidance = getMaintenanceSafetyGuidance('ELECTRICAL')

    expect(guidance.label).toBe('Electrical safety')
    expect(guidance.ppe).toContain('Insulated gloves rated for the task')
    expect(guidance.stopConditions.join(' ')).toMatch(/energized/i)
  })

  it('returns biohazard cleanup guidance with sanitation steps', () => {
    const guidance = getMaintenanceSafetyGuidance('CUSTODIAL_BIOHAZARD')

    expect(guidance.ppe).toContain('Biohazard waste bags')
    expect(guidance.steps.join(' ')).toMatch(/disinfectant/i)
    expect(guidance.note).toMatch(/bloodborne pathogen/i)
  })

  it('returns chemical and wildlife guardrails for grounds work', () => {
    const guidance = getMaintenanceSafetyGuidance('GROUNDS')

    expect(guidance.steps.join(' ')).toMatch(/product label/i)
    expect(guidance.stopConditions.join(' ')).toMatch(/wildlife|fish|runoff/i)
  })

  it('falls back to general guidance for unknown categories', () => {
    const guidance = getMaintenanceSafetyGuidance('NOT_A_CATEGORY')

    expect(guidance.label).toBe('General task safety')
    expect(guidance.stopConditions.join(' ')).toMatch(/hazard is unclear/i)
  })
})
