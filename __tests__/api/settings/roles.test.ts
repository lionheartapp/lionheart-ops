/**
 * Route tests for GET/POST /api/settings/roles
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

vi.mock('@/lib/cache/settings-cache', () => ({
  getCached: vi.fn().mockImplementation((_key: string, fn: () => unknown) => fn()),
  invalidateSettingsCache: vi.fn(),
  settingsCacheKey: vi.fn().mockReturnValue('roles:org-test-1'),
}))

// ── Import routes after mocks ───────────────────────────────────────────────

import { GET, POST } from '@/app/api/settings/roles/route'

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeRole(id: string, name: string, isSystem = false) {
  return {
    id,
    organizationId: 'org-test-1',
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    isSystem,
    _count: { permissions: 5, users: 2 },
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/settings/roles', () => {
  beforeEach(() => {
    if (mocks.prisma) mockReset(mocks.prisma)
  })

  it('returns list of roles with permission and user counts', async () => {
    const roles = [
      makeRole('r1', 'Super Admin', true),
      makeRole('r2', 'Admin', true),
      makeRole('r3', 'Custom Role'),
    ]
    ;(mocks.prisma.role.findMany as any).mockResolvedValue(roles)

    const req = new NextRequest('http://localhost/api/settings/roles')
    const res = await GET(req, { params: Promise.resolve({}) } as any)
    const body = await res.json()

    expect(body.ok).toBe(true)
    expect(body.data).toHaveLength(3)
    expect(body.data[0].name).toBe('Super Admin')
    expect(body.data[0]._count.permissions).toBe(5)
    expect(body.data[0]._count.users).toBe(2)
  })

  it('returns empty array when no roles exist', async () => {
    ;(mocks.prisma.role.findMany as any).mockResolvedValue([])

    const req = new NextRequest('http://localhost/api/settings/roles')
    const res = await GET(req, { params: Promise.resolve({}) } as any)
    const body = await res.json()

    expect(body.ok).toBe(true)
    expect(body.data).toEqual([])
  })
})

describe('POST /api/settings/roles', () => {
  beforeEach(() => {
    if (mocks.prisma) mockReset(mocks.prisma)
  })

  it('creates a role and returns 201', async () => {
    const created = makeRole('r-new', 'Event Manager')
    ;(mocks.prisma.role.create as any).mockResolvedValue(created)

    const req = new NextRequest('http://localhost/api/settings/roles', {
      method: 'POST',
      body: JSON.stringify({ name: 'Event Manager' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({}) } as any)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.ok).toBe(true)
    expect(body.data.name).toBe('Event Manager')
  })

  it('returns 400 when name is empty', async () => {
    const req = new NextRequest('http://localhost/api/settings/roles', {
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
    const req = new NextRequest('http://localhost/api/settings/roles', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({}) } as any)

    expect(res.status).toBe(400)
  })

  it('creates role permissions when permissionIds provided', async () => {
    const created = makeRole('r-new', 'Viewer')
    ;(mocks.prisma.role.create as any).mockResolvedValue(created)
    ;(mocks.prisma.permission.findMany as any).mockResolvedValue([
      { id: 'p1' },
      { id: 'p2' },
    ])
    ;(mocks.prisma.rolePermission.createMany as any).mockResolvedValue({ count: 2 })

    const req = new NextRequest('http://localhost/api/settings/roles', {
      method: 'POST',
      body: JSON.stringify({ name: 'Viewer', permissionIds: ['p1', 'p2'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({}) } as any)

    expect(res.status).toBe(201)
    expect(mocks.prisma.rolePermission.createMany).toHaveBeenCalledWith({
      data: [
        { roleId: 'r-new', permissionId: 'p1' },
        { roleId: 'r-new', permissionId: 'p2' },
      ],
      skipDuplicates: true,
    })
  })

  it('returns 400 when some permissionIds are invalid', async () => {
    const created = makeRole('r-new', 'Viewer')
    ;(mocks.prisma.role.create as any).mockResolvedValue(created)
    // Only 1 of 3 permissions found → mismatch
    ;(mocks.prisma.permission.findMany as any).mockResolvedValue([{ id: 'p1' }])

    const req = new NextRequest('http://localhost/api/settings/roles', {
      method: 'POST',
      body: JSON.stringify({ name: 'Viewer', permissionIds: ['p1', 'p2', 'p3'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req, { params: Promise.resolve({}) } as any)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.message).toContain('invalid')
  })

  it('auto-generates slug from name', async () => {
    ;(mocks.prisma.role.create as any).mockImplementation(({ data }: any) => ({
      ...data,
      id: 'r-new',
      isSystem: false,
      _count: { permissions: 0, users: 0 },
    }))

    const req = new NextRequest('http://localhost/api/settings/roles', {
      method: 'POST',
      body: JSON.stringify({ name: 'Content Manager' }),
      headers: { 'Content-Type': 'application/json' },
    })
    await POST(req, { params: Promise.resolve({}) } as any)

    const createCall = (mocks.prisma.role.create as any).mock.calls[0][0]
    expect(createCall.data.slug).toBe('content-manager')
  })
})
