import { describe, expect, it } from 'vitest'
import {
  computeDose,
  computeVolumeGallons,
} from '@/components/maintenance/calculators/PondCareDosageCalculator'

describe('PondCareDosageCalculator math', () => {
  it('uses manual gallons directly', () => {
    expect(
      computeVolumeGallons({
        shape: 'MANUAL',
        manualGallons: 10000,
        lengthFt: NaN,
        widthFt: NaN,
        diameterFt: NaN,
        acres: NaN,
        avgDepthFt: NaN,
      })
    ).toBe(10000)
  })

  it('estimates rectangular pond gallons from length, width, and average depth', () => {
    const gallons = computeVolumeGallons({
      shape: 'RECTANGLE',
      manualGallons: NaN,
      lengthFt: 100,
      widthFt: 50,
      diameterFt: NaN,
      acres: NaN,
      avgDepthFt: 4,
    })

    expect(Math.round(gallons ?? 0)).toBe(149610)
  })

  it('estimates circular pond gallons from diameter and average depth', () => {
    const gallons = computeVolumeGallons({
      shape: 'CIRCLE',
      manualGallons: NaN,
      lengthFt: NaN,
      widthFt: NaN,
      diameterFt: 40,
      acres: NaN,
      avgDepthFt: 5,
    })

    expect(Math.round(gallons ?? 0)).toBe(47001)
  })

  it('estimates acre-foot volume', () => {
    const gallons = computeVolumeGallons({
      shape: 'ACRE',
      manualGallons: NaN,
      lengthFt: NaN,
      widthFt: NaN,
      diameterFt: NaN,
      acres: 0.5,
      avgDepthFt: 6,
    })

    expect(gallons).toBe(977553)
  })

  it('returns null for missing or invalid measurements', () => {
    expect(
      computeVolumeGallons({
        shape: 'RECTANGLE',
        manualGallons: NaN,
        lengthFt: 100,
        widthFt: 0,
        diameterFt: NaN,
        acres: NaN,
        avgDepthFt: 4,
      })
    ).toBeNull()
  })

  it('computes product dose from target ppm, volume, and concentration', () => {
    const dose = computeDose(1, 10000, 47.5)

    expect(dose).not.toBeNull()
    expect(dose?.mL).toBeCloseTo(79.68, 2)
    expect(dose?.oz).toBeCloseTo(2.69, 2)
    expect(dose?.tbsp).toBeCloseTo(5.39, 2)
  })

  it('rejects impossible dose inputs', () => {
    expect(computeDose(1, 10000, 0)).toBeNull()
    expect(computeDose(1, 10000, 101)).toBeNull()
    expect(computeDose(0, 10000, 47.5)).toBeNull()
  })
})
