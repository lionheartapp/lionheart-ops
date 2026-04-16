/**
 * Route-handler tests for the academic calendar dynamic [id] routes.
 *
 * These tests exercise the `classifyServiceError` wiring by throwing
 * representative service errors (Prisma P2025, P2002, generic "not found",
 * permission denied) and verifying the route returns the correct HTTP status
 * without leaking 5xx. Protects the error-classification pipeline going
 * forward.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DeepMockProxy } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'
import {
  createMockState,
  setupRouteMocks,
  resetMocks,
  makePutRequest,
  makeDeleteRequest,
} from '../helpers/route-test-helpers'

// ── Mock hoisting ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({ prisma: null as unknown as DeepMockProxy<PrismaClient> }))

setupRouteMocks(mocks)

// Mock the academic service functions used by the routes
vi.mock('@/lib/services/academicCalendarService', () => ({
  updateAcademicYear: vi.fn(),
  deleteAcademicYear: vi.fn(),
  updateTerm: vi.fn(),
  deleteTerm: vi.fn(),
  updateBellSchedule: vi.fn(),
  deleteBellSchedule: vi.fn(),
  getBellScheduleById: vi.fn(),
  updateSpecialDay: vi.fn(),
  deleteSpecialDay: vi.fn(),
}))

import * as academicService from '@/lib/services/academicCalendarService'
import { PUT as PutYear, DELETE as DeleteYear } from '@/app/api/academic/years/[id]/route'
import { PUT as PutTerm, DELETE as DeleteTerm } from '@/app/api/academic/terms/[id]/route'
import { PUT as PutBell, DELETE as DeleteBell, GET as GetBell } from '@/app/api/academic/bell-schedules/[id]/route'
import { PUT as PutSpecial, DELETE as DeleteSpecial } from '@/app/api/academic/special-days/[id]/route'

const paramsFor = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  resetMocks(mocks)
  vi.mocked(academicService.updateAcademicYear).mockReset()
  vi.mocked(academicService.deleteAcademicYear).mockReset()
  vi.mocked(academicService.updateTerm).mockReset()
  vi.mocked(academicService.deleteTerm).mockReset()
  vi.mocked(academicService.updateBellSchedule).mockReset()
  vi.mocked(academicService.deleteBellSchedule).mockReset()
  vi.mocked(academicService.getBellScheduleById).mockReset()
  vi.mocked(academicService.updateSpecialDay).mockReset()
  vi.mocked(academicService.deleteSpecialDay).mockReset()
})

// ── Fixtures ─────────────────────────────────────────────────────────────────

function prismaNotFound(): Error {
  return Object.assign(new Error('Record to update not found.'), { code: 'P2025' })
}

function prismaUnique(field: string): Error {
  return Object.assign(new Error('Unique constraint failed'), {
    code: 'P2002',
    meta: { target: [field] },
  })
}

// ── Academic Years ───────────────────────────────────────────────────────────

describe('PUT /api/academic/years/[id]', () => {
  it('returns 200 on success', async () => {
    vi.mocked(academicService.updateAcademicYear).mockResolvedValue({ id: 'y1', name: '2026-27' } as never)

    const req = makePutRequest('/api/academic/years/y1', { name: '2026-27' })
    const res = await PutYear(req, paramsFor('y1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.data.name).toBe('2026-27')
  })

  it('returns 404 when service throws Prisma P2025', async () => {
    vi.mocked(academicService.updateAcademicYear).mockRejectedValue(prismaNotFound())

    const req = makePutRequest('/api/academic/years/missing', { name: '2026-27' })
    const res = await PutYear(req, paramsFor('missing'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('returns 404 when service throws "not found" message', async () => {
    vi.mocked(academicService.updateAcademicYear).mockRejectedValue(new Error('Academic year not found'))

    const req = makePutRequest('/api/academic/years/missing', { name: 'x' })
    const res = await PutYear(req, paramsFor('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 409 when service throws Prisma P2002 (unique conflict)', async () => {
    vi.mocked(academicService.updateAcademicYear).mockRejectedValue(prismaUnique('name'))

    const req = makePutRequest('/api/academic/years/y1', { name: 'existing' })
    const res = await PutYear(req, paramsFor('y1'))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('CONFLICT')
    expect(body.error.message).toContain('name')
  })

  it('returns 400 on Zod validation error (empty name)', async () => {
    const req = makePutRequest('/api/academic/years/y1', { name: '' })
    const res = await PutYear(req, paramsFor('y1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 500 on unexpected error', async () => {
    vi.mocked(academicService.updateAcademicYear).mockRejectedValue(new Error('Database connection lost'))

    const req = makePutRequest('/api/academic/years/y1', { name: 'x' })
    const res = await PutYear(req, paramsFor('y1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

describe('DELETE /api/academic/years/[id]', () => {
  it('returns 200 on success', async () => {
    vi.mocked(academicService.deleteAcademicYear).mockResolvedValue(undefined as never)

    const req = makeDeleteRequest('/api/academic/years/y1')
    const res = await DeleteYear(req, paramsFor('y1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.deleted).toBe(true)
  })

  it('returns 404 on Prisma P2025', async () => {
    vi.mocked(academicService.deleteAcademicYear).mockRejectedValue(prismaNotFound())

    const req = makeDeleteRequest('/api/academic/years/missing')
    const res = await DeleteYear(req, paramsFor('missing'))
    expect(res.status).toBe(404)
  })
})

// ── Academic Terms ───────────────────────────────────────────────────────────

describe('PUT /api/academic/terms/[id]', () => {
  it('returns 200 on success', async () => {
    vi.mocked(academicService.updateTerm).mockResolvedValue({ id: 't1', name: 'Fall' } as never)

    const req = makePutRequest('/api/academic/terms/t1', { name: 'Fall' })
    const res = await PutTerm(req, paramsFor('t1'))
    expect(res.status).toBe(200)
  })

  it('returns 404 when service throws "not found"', async () => {
    vi.mocked(academicService.updateTerm).mockRejectedValue(new Error('Term not found'))

    const req = makePutRequest('/api/academic/terms/missing', { name: 'x' })
    const res = await PutTerm(req, paramsFor('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 400 on Prisma P2003 (FK violation)', async () => {
    vi.mocked(academicService.updateTerm).mockRejectedValue(
      Object.assign(new Error('Foreign key constraint failed'), { code: 'P2003' })
    )

    const req = makePutRequest('/api/academic/terms/t1', { name: 'x' })
    const res = await PutTerm(req, paramsFor('t1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('BAD_REQUEST')
  })
})

describe('DELETE /api/academic/terms/[id]', () => {
  it('returns 200 on success', async () => {
    vi.mocked(academicService.deleteTerm).mockResolvedValue(undefined as never)

    const req = makeDeleteRequest('/api/academic/terms/t1')
    const res = await DeleteTerm(req, paramsFor('t1'))
    expect(res.status).toBe(200)
  })

  it('returns 404 on Prisma P2025', async () => {
    vi.mocked(academicService.deleteTerm).mockRejectedValue(prismaNotFound())

    const req = makeDeleteRequest('/api/academic/terms/missing')
    const res = await DeleteTerm(req, paramsFor('missing'))
    expect(res.status).toBe(404)
  })
})

// ── Bell Schedules ───────────────────────────────────────────────────────────

describe('GET /api/academic/bell-schedules/[id]', () => {
  it('returns 404 when schedule is null', async () => {
    vi.mocked(academicService.getBellScheduleById).mockResolvedValue(null)

    const req = makePutRequest('/api/academic/bell-schedules/missing', {})
    const res = await GetBell(req, paramsFor('missing'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('returns 200 with schedule data when found', async () => {
    vi.mocked(academicService.getBellScheduleById).mockResolvedValue({ id: 'bs1', name: 'Regular' } as never)

    const req = makePutRequest('/api/academic/bell-schedules/bs1', {})
    const res = await GetBell(req, paramsFor('bs1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.id).toBe('bs1')
  })
})

describe('PUT /api/academic/bell-schedules/[id]', () => {
  it('returns 200 on success', async () => {
    vi.mocked(academicService.updateBellSchedule).mockResolvedValue({ id: 'bs1', name: 'Regular' } as never)

    const req = makePutRequest('/api/academic/bell-schedules/bs1', { name: 'Regular' })
    const res = await PutBell(req, paramsFor('bs1'))
    expect(res.status).toBe(200)
  })

  it('returns 400 on Zod validation error (invalid time format)', async () => {
    const req = makePutRequest('/api/academic/bell-schedules/bs1', {
      periods: [{ name: 'P1', startTime: 'not-a-time', endTime: '09:00' }],
    })
    const res = await PutBell(req, paramsFor('bs1'))
    expect(res.status).toBe(400)
  })

  it('returns 404 on Prisma P2025', async () => {
    vi.mocked(academicService.updateBellSchedule).mockRejectedValue(prismaNotFound())

    const req = makePutRequest('/api/academic/bell-schedules/missing', { name: 'x' })
    const res = await PutBell(req, paramsFor('missing'))
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/academic/bell-schedules/[id]', () => {
  it('returns 200 on success', async () => {
    vi.mocked(academicService.deleteBellSchedule).mockResolvedValue(undefined as never)

    const req = makeDeleteRequest('/api/academic/bell-schedules/bs1')
    const res = await DeleteBell(req, paramsFor('bs1'))
    expect(res.status).toBe(200)
  })

  it('returns 404 on Prisma P2025', async () => {
    vi.mocked(academicService.deleteBellSchedule).mockRejectedValue(prismaNotFound())

    const req = makeDeleteRequest('/api/academic/bell-schedules/missing')
    const res = await DeleteBell(req, paramsFor('missing'))
    expect(res.status).toBe(404)
  })
})

// ── Special Days ─────────────────────────────────────────────────────────────

describe('PUT /api/academic/special-days/[id]', () => {
  it('returns 200 on success', async () => {
    vi.mocked(academicService.updateSpecialDay).mockResolvedValue({ id: 's1', name: 'MLK Day' } as never)

    const req = makePutRequest('/api/academic/special-days/s1', { name: 'MLK Day' })
    const res = await PutSpecial(req, paramsFor('s1'))
    expect(res.status).toBe(200)
  })

  it('returns 404 on Prisma P2025', async () => {
    vi.mocked(academicService.updateSpecialDay).mockRejectedValue(prismaNotFound())

    const req = makePutRequest('/api/academic/special-days/missing', { name: 'x' })
    const res = await PutSpecial(req, paramsFor('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 400 on invalid enum value', async () => {
    const req = makePutRequest('/api/academic/special-days/s1', { specialDayType: 'UNKNOWN_TYPE' })
    const res = await PutSpecial(req, paramsFor('s1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('DELETE /api/academic/special-days/[id]', () => {
  it('returns 200 on success', async () => {
    vi.mocked(academicService.deleteSpecialDay).mockResolvedValue(undefined as never)

    const req = makeDeleteRequest('/api/academic/special-days/s1')
    const res = await DeleteSpecial(req, paramsFor('s1'))
    expect(res.status).toBe(200)
  })

  it('returns 404 on Prisma P2025', async () => {
    vi.mocked(academicService.deleteSpecialDay).mockRejectedValue(prismaNotFound())

    const req = makeDeleteRequest('/api/academic/special-days/missing')
    const res = await DeleteSpecial(req, paramsFor('missing'))
    expect(res.status).toBe(404)
  })
})
