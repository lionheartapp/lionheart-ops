import { describe, expect, it } from 'vitest'
import {
  analyzeFrequencyPlan,
  mhzToHz,
  parseScanContent,
  recommendFrequencies,
} from '@/lib/services/avRfService'

const profile = {
  minFrequencyHz: mhzToHz(540),
  maxFrequencyHz: mhzToHz(550),
  minSpacingHz: 250_000,
  intermodSpacingHz: 25_000,
  channelStepHz: 25_000,
}

function assignment(id: string, label: string, mhz: number | null, isLocked = false) {
  return {
    id,
    label,
    frequencyHz: mhz ? mhzToHz(mhz) : null,
    isLocked,
    device: { profile },
  }
}

describe('avRfService RF engine', () => {
  it('parses scan frequency and signal pairs', () => {
    const result = parseScanContent('540.000,-92\n540.025,-80\n')

    expect(result.errors).toEqual([])
    expect(result.points).toEqual([
      { frequencyHz: 540_000_000, signalDbm: -92 },
      { frequencyHz: 540_025_000, signalDbm: -80 },
    ])
  })

  it('rejects scan headers with row-level errors', () => {
    const result = parseScanContent('frequency,level\n540.000,-92\n')

    expect(result.errors[0]).toEqual({
      row: 1,
      message: 'Frequency and signal strength must be numbers. Remove headers before uploading.',
    })
  })

  it('flags same-frequency and minimum-spacing conflicts', () => {
    const result = analyzeFrequencyPlan([
      assignment('a', 'Host', 542.125),
      assignment('b', 'Podium', 542.125),
      assignment('c', 'Backup', 542.2),
    ], [])

    expect(result.conflicts.some((c) => c.type === 'SAME_FREQUENCY')).toBe(true)
    expect(result.conflicts.some((c) => c.type === 'MIN_SPACING')).toBe(true)
    expect(result.riskLevel).toBe('HIGH')
  })

  it('flags 3rd-order intermod conflicts', () => {
    const result = analyzeFrequencyPlan([
      assignment('a', 'A', 542),
      assignment('b', 'B', 543),
      assignment('c', 'C', 541),
    ], [])

    expect(result.conflicts.some((c) => c.type === 'INTERMOD_3RD')).toBe(true)
  })

  it('flags 5th-order intermod warnings', () => {
    const result = analyzeFrequencyPlan([
      assignment('a', 'A', 542),
      assignment('b', 'B', 543),
      assignment('c', 'C', 540),
    ], [])

    expect(result.conflicts.some((c) => c.type === 'INTERMOD_5TH')).toBe(true)
  })

  it('applies exclusion ranges and suggests clean unlocked frequencies', () => {
    const exclusions = [{
      label: 'Noisy scan range',
      startHz: mhzToHz(540),
      endHz: mhzToHz(541),
      severity: 'WARNING' as const,
      reason: 'Above threshold',
    }]
    const assignments = [
      assignment('locked', 'Locked mic', 542, true),
      assignment('open', 'Open mic', null),
    ]

    const analysis = analyzeFrequencyPlan([assignment('a', 'A', 540.5)], exclusions)
    const recs = recommendFrequencies(assignments, exclusions)

    expect(analysis.conflicts.some((c) => c.type === 'EXCLUSION')).toBe(true)
    expect(recs[0].assignmentId).toBe('open')
    expect(recs[0].frequencyHz).toBeGreaterThan(mhzToHz(541))
  })
})

