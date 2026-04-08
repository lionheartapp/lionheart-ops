import { describe, it, expect } from 'vitest'
import {
  COMPLIANCE_DOMAIN_DEFAULTS,
  COMPLIANCE_DOMAINS,
} from '@/lib/types/compliance'

describe('COMPLIANCE_DOMAINS', () => {
  it('has 10 compliance domains', () => {
    expect(COMPLIANCE_DOMAINS).toHaveLength(10)
  })

  it('includes expected domains', () => {
    expect(COMPLIANCE_DOMAINS).toContain('AHERA')
    expect(COMPLIANCE_DOMAINS).toContain('FIRE_SAFETY')
    expect(COMPLIANCE_DOMAINS).toContain('ADA')
    expect(COMPLIANCE_DOMAINS).toContain('IPM')
  })

  it('has no duplicates', () => {
    const unique = new Set(COMPLIANCE_DOMAINS)
    expect(unique.size).toBe(COMPLIANCE_DOMAINS.length)
  })
})

describe('COMPLIANCE_DOMAIN_DEFAULTS', () => {
  it('has a config for every domain', () => {
    for (const domain of COMPLIANCE_DOMAINS) {
      expect(COMPLIANCE_DOMAIN_DEFAULTS[domain]).toBeDefined()
    }
  })

  it('every config has required fields', () => {
    for (const [domain, meta] of Object.entries(COMPLIANCE_DOMAIN_DEFAULTS)) {
      expect(meta.label, `${domain}.label`).toBeTruthy()
      expect(meta.description, `${domain}.description`).toBeTruthy()
      expect(meta.defaultMonth, `${domain}.defaultMonth`).toBeGreaterThanOrEqual(1)
      expect(meta.defaultMonth, `${domain}.defaultMonth`).toBeLessThanOrEqual(12)
      expect(meta.defaultDay, `${domain}.defaultDay`).toBeGreaterThanOrEqual(1)
      expect(meta.defaultDay, `${domain}.defaultDay`).toBeLessThanOrEqual(31)
      expect(meta.frequencyYears, `${domain}.frequencyYears`).toBeGreaterThan(0)
      expect(meta.category, `${domain}.category`).toBeTruthy()
    }
  })

  it('LEAD_WATER has 3-year frequency', () => {
    expect(COMPLIANCE_DOMAIN_DEFAULTS.LEAD_WATER.frequencyYears).toBe(3)
  })

  it('RADON has 5-year frequency', () => {
    expect(COMPLIANCE_DOMAIN_DEFAULTS.RADON.frequencyYears).toBe(5)
  })

  it('most domains are annual (1-year frequency)', () => {
    const annual = Object.values(COMPLIANCE_DOMAIN_DEFAULTS).filter(
      (m) => m.frequencyYears === 1,
    )
    expect(annual.length).toBeGreaterThanOrEqual(7)
  })
})
