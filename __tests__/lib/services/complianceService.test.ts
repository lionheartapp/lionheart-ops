/**
 * Tests for `populateComplianceCalendar` — asserts the batched query
 * pattern used to fix the prior N+1 timeout. Specifically:
 *
 *   - Uses a single `findMany` to pre-load configs
 *   - Uses a single `createMany` to backfill missing configs
 *   - Uses a single `findMany` to pre-load existing records
 *   - Uses a single `createMany` to insert all new records
 *   - Never invokes the broken `upsert({ where: { id: 'non-existent-id' } })`
 *   - Is idempotent: repeat invocations don't duplicate records
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  complianceDomainConfig: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
  complianceRecord: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({
  rawPrisma: {
    complianceDomainConfig: mocks.complianceDomainConfig,
    complianceRecord: mocks.complianceRecord,
  },
  prisma: {
    complianceDomainConfig: mocks.complianceDomainConfig,
    complianceRecord: mocks.complianceRecord,
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}))

vi.mock('@/lib/services/notificationService', () => ({
  createNotification: vi.fn(),
}))

vi.mock('@/lib/services/emailService', () => ({
  sendComplianceReminderEmail: vi.fn(),
}))

vi.mock('@/lib/services/maintenanceTicketService', () => ({
  generateTicketNumber: vi.fn(),
  CATEGORY_TO_SPECIALTY: {},
}))

import { populateComplianceCalendar } from '@/lib/services/complianceService'
import { COMPLIANCE_DOMAINS, COMPLIANCE_DOMAIN_DEFAULTS } from '@/lib/types/compliance'

const ORG_ID = 'org-1'
const START = new Date('2026-08-01T00:00:00Z')
const END = new Date('2027-07-31T00:00:00Z')

beforeEach(() => {
  mocks.complianceDomainConfig.findMany.mockReset()
  mocks.complianceDomainConfig.createMany.mockReset()
  mocks.complianceRecord.findMany.mockReset()
  mocks.complianceRecord.createMany.mockReset()
  // Safe default — if `createMany` is reached unexpectedly, it returns 0 instead of undefined
  mocks.complianceRecord.createMany.mockResolvedValue({ count: 0 })
  mocks.complianceDomainConfig.createMany.mockResolvedValue({ count: 0 })
})

/**
 * Replicates the service's internal `computeDueDates` to pre-populate
 * "existing records" that exactly match what the service will want to create.
 * Must stay in sync with `computeDueDates` in complianceService.ts.
 */
function computeExpectedDueDates(
  startDate: Date,
  endDate: Date,
  month: number,
  day: number
): Date[] {
  const dates: Date[] = []
  const startYear = startDate.getFullYear()
  const endYear = endDate.getFullYear()
  for (let year = startYear; year <= endYear; year++) {
    const dueDate = new Date(year, month - 1, day)
    if (dueDate >= startDate && dueDate <= endDate) {
      dates.push(dueDate)
    }
  }
  return dates
}

describe('populateComplianceCalendar', () => {
  it('creates default configs and records on first run (empty DB)', async () => {
    // 1st findMany call: no configs exist
    mocks.complianceDomainConfig.findMany.mockResolvedValueOnce([])
    // createMany: backfill missing configs
    mocks.complianceDomainConfig.createMany.mockResolvedValueOnce({ count: COMPLIANCE_DOMAINS.length })
    // 2nd findMany call: return newly created configs
    mocks.complianceDomainConfig.findMany.mockResolvedValueOnce(
      COMPLIANCE_DOMAINS.map((domain, i) => ({
        id: `cfg-${i}`,
        organizationId: ORG_ID,
        schoolId: null,
        domain,
        isEnabled: true,
        customDeadlineMonth: null,
        customDeadlineDay: null,
        notes: null,
      })),
    )
    // findMany for existing records: empty
    mocks.complianceRecord.findMany.mockResolvedValueOnce([])
    // createMany: inserts new records
    mocks.complianceRecord.createMany.mockResolvedValueOnce({ count: 10 })

    const count = await populateComplianceCalendar(ORG_ID, START, END)

    expect(count).toBe(10)
    expect(mocks.complianceDomainConfig.findMany).toHaveBeenCalledTimes(2)
    expect(mocks.complianceDomainConfig.createMany).toHaveBeenCalledTimes(1)
    // Assert single findMany for records (no N+1)
    expect(mocks.complianceRecord.findMany).toHaveBeenCalledTimes(1)
    // Assert single createMany for records (no per-domain loop)
    expect(mocks.complianceRecord.createMany).toHaveBeenCalledTimes(1)
  })

  it('skips config backfill if all configs already exist', async () => {
    mocks.complianceDomainConfig.findMany.mockResolvedValueOnce(
      COMPLIANCE_DOMAINS.map((domain, i) => ({
        id: `cfg-${i}`,
        organizationId: ORG_ID,
        schoolId: null,
        domain,
        isEnabled: true,
        customDeadlineMonth: null,
        customDeadlineDay: null,
        notes: null,
      })),
    )
    mocks.complianceRecord.findMany.mockResolvedValueOnce([])
    mocks.complianceRecord.createMany.mockResolvedValueOnce({ count: 10 })

    await populateComplianceCalendar(ORG_ID, START, END)

    expect(mocks.complianceDomainConfig.createMany).not.toHaveBeenCalled()
    // Only the initial findMany — no second fetch needed
    expect(mocks.complianceDomainConfig.findMany).toHaveBeenCalledTimes(1)
  })

  it('is idempotent: zero records created when all already exist', async () => {
    const configs = COMPLIANCE_DOMAINS.map((domain, i) => ({
      id: `cfg-${i}`,
      organizationId: ORG_ID,
      schoolId: null,
      domain,
      isEnabled: true,
      customDeadlineMonth: null,
      customDeadlineDay: null,
      notes: null,
    }))
    mocks.complianceDomainConfig.findMany.mockResolvedValueOnce(configs)

    // Pre-existing records for every due date the service will compute —
    // so de-dup via existingKey short-circuits and `toCreate.length === 0`.
    const existingRecords = configs.flatMap((c) => {
      const meta = COMPLIANCE_DOMAIN_DEFAULTS[c.domain]
      const dueDates = computeExpectedDueDates(START, END, meta.defaultMonth, meta.defaultDay)
      return dueDates.map((dueDate) => ({
        domainConfigId: c.id,
        dueDate,
        outcome: 'PENDING' as const,
      }))
    })
    mocks.complianceRecord.findMany.mockResolvedValueOnce(existingRecords)

    const count = await populateComplianceCalendar(ORG_ID, START, END)

    // All due dates already exist — nothing to create, createMany short-circuits
    expect(count).toBe(0)
    expect(mocks.complianceRecord.createMany).not.toHaveBeenCalled()
  })

  it('skips disabled configs', async () => {
    mocks.complianceDomainConfig.findMany.mockResolvedValueOnce(
      COMPLIANCE_DOMAINS.map((domain, i) => ({
        id: `cfg-${i}`,
        organizationId: ORG_ID,
        schoolId: null,
        domain,
        isEnabled: false, // all disabled
        customDeadlineMonth: null,
        customDeadlineDay: null,
        notes: null,
      })),
    )

    const count = await populateComplianceCalendar(ORG_ID, START, END)

    expect(count).toBe(0)
    // No record queries when nothing to process
    expect(mocks.complianceRecord.findMany).not.toHaveBeenCalled()
    expect(mocks.complianceRecord.createMany).not.toHaveBeenCalled()
  })
})
