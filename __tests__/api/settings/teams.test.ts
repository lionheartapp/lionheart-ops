/**
 * Route tests for GET/POST /api/settings/teams
 *
 * Uses shared mock helpers from route-test-helpers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { DeepMockProxy } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

// ── Mock setup ──────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  prisma: null as unknown as DeepMockProxy<PrismaClient>,
}))

vi.mock('@/lib/db', async () => {
  const { mockDeep } = await import('vitest-mock-extended')
  const mock = mockDeep<PrismaClient>()
  mocks.prisma = mock
  return { rawPrisma: mock, prisma: mock }
})

vi.mock('@/lib/request-context', () => ({
  getUserContext: vi.fn().mockResolvedValue({
    userId: 'user-test-1', organizationId: 'org-test-1',
    email: 'test@example.com', roleName: 'admin',
  }),
}))

vi.mock('@/lib/auth/permissions', () => ({
  assertCan: vi.fn().mockResolvedValue(undefined),
  can: vi.fn().mockResolvedValue(true),
  canAny: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/org-context', () => ({
  getOrgIdFromRequest: vi.fn().mockReturnValue('org-test-1'),
  runWithOrgContext: vi.fn().mockImplementation((_orgId: string, fn: () => unknown) => fn()),
}))

vi.mock('@/lib/logger', () => ({
  logger: { child: vi.fn().mockReturnValue({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) },
}))

vi.mock('@sentry/nextjs', () => ({ setTag: vi.fn(), captureException: vi.fn() }))

vi.mock('@/lib/services/auditService', () => ({
  audit: vi.fn().mockResolvedValue(undefined),
  getIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

// ── Import routes after mocks ───────────────────────────────────────────────

import { GET, POST } from '@/app/api/settings/teams/route'

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeTeam(id: string, name: string) {
  return {
    id,
    organizationId: 'org-test-1',
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    description: null,
    teamType: null,
    _count: { members: 3 },
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/settings/teams', () => {
  beforeEach(() => {
    if (mocks.prisma) mockReset(mocks.prisma)
  })

  it('returns list of teams with member counts', async () => {
    const teams = [makeTeam('t1', 'IT Support'), makeTeam('t2', 'Facilities')]
    ;(mocks.prisma.team.findMany as any).mockResolvedValue(teams)

    const req = new NextRequest('http://localhost/api/settings/teams')
    const res = await GET(req, { params: Promise.resolve({}) } as any)
    const body = await res.json()

    expect(body.ok).toBe(true)
    expect(body.data).toHaveLength(2)
    expect(body.data[0].name).toBe('IT Support')
    expect(body.data[0]._count.members).toBe(3)
  })

  it('returns empty array when no teams exist', async () => {
    ;(mocks.prisma.team.findMany as any).mockResolvedValue([])

    const req = new NextRequest('http://localhost/api/settings/teams')
    const res = await GET(req, { params: Promise.resolve({}) } as any)
    const body = await res.json()

    expect(body.ok).toBe(true)
    expect(body.data).toEqual([])
  })
})

describe('POST /api/settings/teams', () => {
  beforeEach(() => {
    if (mocks.prisma) mockReset(mocks.prisma)
  })

  it('creates a team and returns 201', async () => {
    const created = makeTeam('t-new', 'A/V Production')
    ;(mocks.prisma.team.create as any).mockResolvedValue(created)

    const req = new NextRequest('http://localhost/api/settings/teams', {
      method: 'POST',
      body: JSON.stringify({ name: 'A/V Production' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({}) } as any)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.ok).toBe(true)
    expect(body.data.name).toBe('A/V Production')
  })

  it('returns 400 when name is empty', async () => {
    const req = new NextRequest('http://localhost/api/settings/teams', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({}) } as any)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when body is missing required fields', async () => {
    const req = new NextRequest('http://localhost/api/settings/teams', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({}) } as any)

    expect(res.status).toBe(400)
  })

  it('auto-generates slug from name when slug not provided', async () => {
    ;(mocks.prisma.team.create as any).mockImplementation(({ data }: any) => ({
      ...data,
      id: 't-new',
      _count: { members: 0 },
    }))

    const req = new NextRequest('http://localhost/api/settings/teams', {
      method: 'POST',
      body: JSON.stringify({ name: 'My New Team' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({}) } as any)
    const body = await res.json()

    expect(res.status).toBe(201)
    // Verify slug was passed to create
    const createCall = (mocks.prisma.team.create as any).mock.calls[0][0]
    expect(createCall.data.slug).toBe('my-new-team')
  })

  it('uses provided slug when given', async () => {
    ;(mocks.prisma.team.create as any).mockImplementation(({ data }: any) => ({
      ...data,
      id: 't-new',
      _count: { members: 0 },
    }))

    const req = new NextRequest('http://localhost/api/settings/teams', {
      method: 'POST',
      body: JSON.stringify({ name: 'My Team', slug: 'custom-slug' }),
      headers: { 'Content-Type': 'application/json' },
    })
    await POST(req, { params: Promise.resolve({}) } as any)

    const createCall = (mocks.prisma.team.create as any).mock.calls[0][0]
    expect(createCall.data.slug).toBe('custom-slug')
  })
})
