import { describe, expect, it } from 'vitest'
import {
  estimateFixtureCost,
  estimateFlooringSquareFeet,
  estimatePaintGallons,
  getRepairDecision,
} from '@/lib/maintenance-tools'

describe('maintenance tools', () => {
  it('recommends replacement review when repair cost and repeat attempts are high', () => {
    const result = getRepairDecision({
      repairCost: 1000,
      replacementCost: 1800,
      repeatAttempts: 3,
      ageYears: 12,
      expectedLifeYears: 15,
      downtimeDays: 1,
    })

    expect(result.decision).toBe('REPLACE')
    expect(result.ratio).toBeCloseTo(0.56, 2)
  })

  it('keeps repair reasonable for low cost, newer assets', () => {
    const result = getRepairDecision({
      repairCost: 150,
      replacementCost: 2000,
      repeatAttempts: 1,
      ageYears: 3,
      expectedLifeYears: 15,
      downtimeDays: 0,
    })

    expect(result.decision).toBe('REPAIR')
  })

  it('estimates paint gallons with coats and waste', () => {
    expect(
      estimatePaintGallons({
        squareFeet: 1200,
        coats: 2,
        coveragePerGallon: 350,
        wastePct: 10,
      })
    ).toBeCloseTo(7.54, 2)
  })

  it('estimates flooring square footage with waste', () => {
    expect(
      estimateFlooringSquareFeet({
        lengthFt: 30,
        widthFt: 20,
        wastePct: 12,
      })
    ).toBeCloseTo(672, 2)
  })

  it('estimates fixture cost with contingency', () => {
    expect(
      estimateFixtureCost({
        quantity: 8,
        unitCost: 42,
        contingencyPct: 10,
      })
    ).toBeCloseTo(369.6, 1)
  })
})
