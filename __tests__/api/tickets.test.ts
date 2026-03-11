/**
 * Integration-level tests for GET /api/tickets with pagination.
 *
 * Mocks the database, org context, auth, and permissions to test
 * that the route returns the correct pagination metadata shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { DeepMockProxy } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

// ── Mock hoisting ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  return {
    prisma: null as unknown as DeepMockProxy<PrismaClient>,
  }
})

vi.mock('@/lib/db', async () => {
  const { mockDeep } = await import('vitest-mock-extended')
  const mock = mockDeep<PrismaClient>()
  mocks.prisma = mock
  return {
    rawPrisma: mock,
    prisma: mock,
  }
})

vi.mock('@/lib/request-context', () => ({
  getUserContext: vi.fn().mockResolvedValue({
    userId: 'user-test-1',
    organizationId: 'org-test-1',
    email: 'test@example.com',
    roleName: 'admin',
  }),
}))

vi.mock('@/lib/auth/permissions', () => ({
  assertCan: vi.fn().mockResolvedValue(undefined),
  can: vi.fn().mockResolvedValue(true), // canReadAll = true so no OR filter
  canAny: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/org-context', () => ({
  getOrgIdFromRequest: vi.fn().mockReturnValue('org-test-1'),
  runWithOrgContext: vi.fn().mockImplementation((_orgId: string, fn: () => unknown) => fn()),
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

vi.mock('@sentry/nextjs', () => ({
  setTag: vi.fn(),
  captureException: vi.fn(),
}))

// ── Import route handler AFTER mocks are in place ────────────────────────────

import { GET, POST } from '@/app/api/tickets/route'

// ── Ticket fixture ────────────────────────────────────────────────────────────

function makeTicket(id: string) {
  return {
    id,
    organizationId: 'org-test-1',
    title: `Ticket ${id}`,
    description: null,
    category: 'MAINTENANCE',
    priority: 'NORMAL',
    status: 'OPEN',
    source: 'MANUAL',
    schoolId: null,
    locationRefType: null,
    locationRefId: null,
    locationText: 'Room 101',
    assignedToId: null,
    createdById: 'user-test-1',
    deletedAt: null,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    assignedTo: null,
    createdBy: { id: 'user-test-1', name: 'Test User', email: 'test@example.com' },
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/tickets pagination', () => {
  beforeEach(() => {
    if (mocks.prisma) mockReset(mocks.prisma)
    // Re-apply count and findMany mocks after reset
    ;(mocks.prisma.ticket.count as any).mockResolvedValue(50)
    ;(mocks.prisma.ticket.findMany as any).mockResolvedValue([
      makeTicket('t1'),
      makeTicket('t2'),
      makeTicket('t3'),
    ])
  })

  it('returns pagination meta with correct shape for page=1&limit=25', async () => {
    const req = new NextRequest('http://localhost/api/tickets?page=1&limit=25')
    const response = await GET(req)
    const body = await response.json()

    expect(body.ok).toBe(true)
    expect(body.data).toHaveLength(3)
    expect(body.meta).toBeDefined()
    expect(body.meta.total).toBe(50)
    expect(body.meta.page).toBe(1)
    expect(body.meta.limit).toBe(25)
    expect(body.meta.totalPages).toBe(2)
  })

  it('defaults to page=1 and limit=25 when no params provided', async () => {
    const req = new NextRequest('http://localhost/api/tickets')
    const response = await GET(req)
    const body = await response.json()

    expect(body.ok).toBe(true)
    expect(body.meta.page).toBe(1)
    expect(body.meta.limit).toBe(25)
  })

  it('returns correct totalPages for page=2', async () => {
    ;(mocks.prisma.ticket.count as any).mockResolvedValue(100)
    ;(mocks.prisma.ticket.findMany as any).mockResolvedValue([makeTicket('t1')])

    const req = new NextRequest('http://localhost/api/tickets?page=2&limit=10')
    const response = await GET(req)
    const body = await response.json()

    expect(body.meta.page).toBe(2)
    expect(body.meta.limit).toBe(10)
    expect(body.meta.total).toBe(100)
    expect(body.meta.totalPages).toBe(10)
  })

  it('returns totalPages=0 when no tickets exist', async () => {
    ;(mocks.prisma.ticket.count as any).mockResolvedValue(0)
    ;(mocks.prisma.ticket.findMany as any).mockResolvedValue([])

    const req = new NextRequest('http://localhost/api/tickets')
    const response = await GET(req)
    const body = await response.json()

    expect(body.ok).toBe(true)
    expect(body.data).toHaveLength(0)
    expect(body.meta.total).toBe(0)
    expect(body.meta.totalPages).toBe(0)
  })
})

describe('POST /api/tickets validation', () => {
  beforeEach(() => {
    if (mocks.prisma) mockReset(mocks.prisma)
  })

  it('returns 400 when required fields are missing', async () => {
    const req = new NextRequest('http://localhost/api/tickets', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const response = await POST(req)
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when locationText and locationRef are both missing', async () => {
    const req = new NextRequest('http://localhost/api/tickets', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Broken window',
        category: 'MAINTENANCE',
        priority: 'NORMAL',
        // Missing locationText and locationRefType+locationRefId
      }),
    })
    const response = await POST(req)
    expect(response.status).toBe(400)
  })
})
