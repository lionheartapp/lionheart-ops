/**
 * Route tests for GET/POST /api/settings/users
 *
 * Tests pagination, search/filter, user creation, validation, and conflict handling.
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
    email: 'admin@example.com', roleName: 'admin',
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

vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('hashed-password'),
}))

vi.mock('@/lib/auth/password-setup', () => ({
  generateSetupToken: vi.fn().mockReturnValue('setup-token-abc'),
  hashSetupToken: vi.fn().mockReturnValue('hashed-setup-token'),
  getSetupLink: vi.fn().mockReturnValue('https://app.example.com/set-password?token=setup-token-abc'),
}))

vi.mock('@/lib/services/emailService', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue({ sent: true, reason: 'ok' }),
}))

// ── Import routes after mocks ───────────────────────────────────────────────

import { GET, POST } from '@/app/api/settings/users/route'

// Route context stub for non-dynamic routes
const routeCtx = { params: Promise.resolve({}) } as any

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeUser(id: string, email: string, first: string, last: string) {
  return {
    id,
    email,
    firstName: first,
    lastName: last,
    avatar: null,
    jobTitle: null,
    schoolScope: 'GLOBAL',
    employmentType: null,
    phone: null,
    status: 'ACTIVE',
    createdAt: new Date('2024-01-01'),
    teams: [],
    userRole: { id: 'role-1', name: 'admin', slug: 'admin' },
  }
}

// ── GET Tests ───────────────────────────────────────────────────────────────

describe('GET /api/settings/users', () => {
  beforeEach(() => {
    if (mocks.prisma) mockReset(mocks.prisma)
  })

  it('returns paginated list of users', async () => {
    const users = [
      makeUser('u1', 'alice@example.com', 'Alice', 'Smith'),
      makeUser('u2', 'bob@example.com', 'Bob', 'Jones'),
    ]
    ;(mocks.prisma.user.count as any).mockResolvedValue(2)
    ;(mocks.prisma.user.findMany as any).mockResolvedValue(users)

    const req = new NextRequest('http://localhost/api/settings/users?page=1&limit=10')
    const res = await GET(req, { params: Promise.resolve({}) } as any)
    const body = await res.json()

    expect(body.ok).toBe(true)
    expect(body.data).toHaveLength(2)
    expect(body.data[0].email).toBe('alice@example.com')
    expect(body.meta.total).toBe(2)
    expect(body.meta.page).toBe(1)
    expect(body.meta.limit).toBe(10)
  })

  it('returns empty array when no users match', async () => {
    ;(mocks.prisma.user.count as any).mockResolvedValue(0)
    ;(mocks.prisma.user.findMany as any).mockResolvedValue([])

    const req = new NextRequest('http://localhost/api/settings/users')
    const res = await GET(req, { params: Promise.resolve({}) } as any)
    const body = await res.json()

    expect(body.ok).toBe(true)
    expect(body.data).toEqual([])
    expect(body.meta.total).toBe(0)
  })

  it('passes search filter to where clause', async () => {
    ;(mocks.prisma.user.count as any).mockResolvedValue(0)
    ;(mocks.prisma.user.findMany as any).mockResolvedValue([])

    const req = new NextRequest('http://localhost/api/settings/users?search=alice')
    await GET(req, { params: Promise.resolve({}) } as any)

    const countCall = (mocks.prisma.user.count as any).mock.calls[0][0]
    expect(countCall.where.OR).toBeDefined()
    expect(countCall.where.OR).toHaveLength(3) // firstName, lastName, email
  })

  it('passes roleId filter to where clause', async () => {
    ;(mocks.prisma.user.count as any).mockResolvedValue(0)
    ;(mocks.prisma.user.findMany as any).mockResolvedValue([])

    const req = new NextRequest('http://localhost/api/settings/users?roleId=role-123')
    await GET(req, { params: Promise.resolve({}) } as any)

    const countCall = (mocks.prisma.user.count as any).mock.calls[0][0]
    expect(countCall.where.roleId).toBe('role-123')
  })

  it('passes teamSlug filter to where clause', async () => {
    ;(mocks.prisma.user.count as any).mockResolvedValue(0)
    ;(mocks.prisma.user.findMany as any).mockResolvedValue([])

    const req = new NextRequest('http://localhost/api/settings/users?teamSlug=it-support')
    await GET(req, { params: Promise.resolve({}) } as any)

    const countCall = (mocks.prisma.user.count as any).mock.calls[0][0]
    expect(countCall.where.teams).toEqual({ some: { team: { slug: 'it-support' } } })
  })
})

// ── POST Tests ──────────────────────────────────────────────────────────────

describe('POST /api/settings/users', () => {
  beforeEach(() => {
    if (mocks.prisma) mockReset(mocks.prisma)
  })

  function postReq(body: Record<string, unknown>) {
    return new NextRequest('http://localhost/api/settings/users', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const validBody = {
    email: 'new@example.com',
    firstName: 'New',
    lastName: 'User',
    roleId: 'role-1',
  }

  it('creates a user and returns 201', async () => {
    // No existing user
    ;(mocks.prisma.user.findUnique as any).mockResolvedValue(null)
    // Role exists
    ;(mocks.prisma.role.findFirst as any).mockResolvedValue({ id: 'role-1' })
    // Org lookup
    ;(mocks.prisma.organization.findUniqueOrThrow as any).mockResolvedValue({
      slug: 'test-org', name: 'Test Org',
    })
    // User create
    const createdUser = makeUser('u-new', 'new@example.com', 'New', 'User')
    ;(mocks.prisma.user.create as any).mockResolvedValue(createdUser)
    // Calendar create
    ;(mocks.prisma.calendar.create as any).mockResolvedValue({ id: 'cal-1' })
    // Password setup token (accessed via dynamic property)
    ;(mocks.prisma as any).passwordSetupToken = {
      create: vi.fn().mockResolvedValue({ id: 'pst-1' }),
    }

    const res = await POST(postReq(validBody), routeCtx)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.ok).toBe(true)
    expect(body.data.user.email).toBe('new@example.com')
    expect(body.data.setup.setupLink).toContain('set-password')
    expect(body.data.setup.emailSent).toBe(true)
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await POST(postReq({ email: 'a@b.com' }), routeCtx)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('BAD_REQUEST')
  })

  it('returns 400 when email is empty', async () => {
    const res = await POST(postReq({ ...validBody, email: '' }), routeCtx)
    expect(res.status).toBe(400)
  })

  it('returns 409 when user with email already exists', async () => {
    ;(mocks.prisma.user.findUnique as any).mockResolvedValue(
      makeUser('u-existing', 'new@example.com', 'Existing', 'User')
    )

    const res = await POST(postReq(validBody), routeCtx)
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error.code).toBe('CONFLICT')
  })

  it('returns 400 when roleId is invalid for the org', async () => {
    ;(mocks.prisma.user.findUnique as any).mockResolvedValue(null)
    ;(mocks.prisma.role.findFirst as any).mockResolvedValue(null) // role not found

    const res = await POST(postReq(validBody), routeCtx)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.message).toContain('Invalid role')
  })

  it('normalizes email to lowercase', async () => {
    ;(mocks.prisma.user.findUnique as any).mockResolvedValue(null)
    ;(mocks.prisma.role.findFirst as any).mockResolvedValue({ id: 'role-1' })
    ;(mocks.prisma.organization.findUniqueOrThrow as any).mockResolvedValue({
      slug: 'test-org', name: 'Test Org',
    })
    ;(mocks.prisma.user.create as any).mockResolvedValue(
      makeUser('u-new', 'upper@example.com', 'Test', 'User')
    )
    ;(mocks.prisma.calendar.create as any).mockResolvedValue({ id: 'cal-1' })
    ;(mocks.prisma as any).passwordSetupToken = {
      create: vi.fn().mockResolvedValue({ id: 'pst-1' }),
    }

    await POST(postReq({ ...validBody, email: 'UPPER@Example.COM' }), routeCtx)

    const findCall = (mocks.prisma.user.findUnique as any).mock.calls[0][0]
    expect(findCall.where.organizationId_email.email).toBe('upper@example.com')
  })
})
