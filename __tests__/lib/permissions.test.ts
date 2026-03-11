import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { DeepMockProxy } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

// Create the mock outside of vi.mock, then reference it inside
// Using vi.hoisted to ensure initialization before mock hoisting
const mocks = vi.hoisted(() => {
  // We can't use ESM imports here, so we use a deferred init pattern
  return {
    rawPrisma: null as unknown as DeepMockProxy<PrismaClient>,
  }
})

vi.mock('@/lib/db', async () => {
  const { mockDeep } = await import('vitest-mock-extended')
  const mock = mockDeep<PrismaClient>()
  mocks.rawPrisma = mock
  return {
    rawPrisma: mock,
    prisma: mock,
  }
})

import {
  can,
  assertCan,
  getUserPermissions,
  clearPermissionCache,
} from '@/lib/auth/permissions'

// Helper to build a user fixture with role permissions
function makeUser(permissionStrings: Array<{ resource: string; action: string; scope: string }>) {
  return {
    id: 'user-1',
    userRole: {
      permissions: permissionStrings.map((p) => ({
        permission: p,
      })),
    },
    userPermissions: [],
    teams: [],
  }
}

describe('getUserPermissions', () => {
  beforeEach(() => {
    clearPermissionCache('user-1')
    if (mocks.rawPrisma) mockReset(mocks.rawPrisma)
  })

  it('returns cached result on second call within TTL (findUnique called once)', async () => {
    const user = makeUser([{ resource: 'tickets', action: 'read', scope: 'all' }])
    mocks.rawPrisma.user.findUnique.mockResolvedValue(user as any)

    await getUserPermissions('user-1')
    await getUserPermissions('user-1')

    expect(mocks.rawPrisma.user.findUnique).toHaveBeenCalledTimes(1)
  })

  it('re-fetches from DB after clearPermissionCache', async () => {
    const user = makeUser([{ resource: 'tickets', action: 'read', scope: 'all' }])
    mocks.rawPrisma.user.findUnique.mockResolvedValue(user as any)

    await getUserPermissions('user-1')
    clearPermissionCache('user-1')
    await getUserPermissions('user-1')

    expect(mocks.rawPrisma.user.findUnique).toHaveBeenCalledTimes(2)
  })
})

describe('can', () => {
  beforeEach(() => {
    clearPermissionCache('user-1')
    if (mocks.rawPrisma) mockReset(mocks.rawPrisma)
  })

  it('returns true when user has the matching permission in role', async () => {
    const user = makeUser([{ resource: 'tickets', action: 'read', scope: 'all' }])
    mocks.rawPrisma.user.findUnique.mockResolvedValue(user as any)

    const result = await can('user-1', 'tickets:read:all')
    expect(result).toBe(true)
  })

  it('returns false when user has no matching permissions', async () => {
    const user = makeUser([{ resource: 'events', action: 'read', scope: 'global' }])
    mocks.rawPrisma.user.findUnique.mockResolvedValue(user as any)

    const result = await can('user-1', 'tickets:read:all')
    expect(result).toBe(false)
  })

  it('returns true when user has wildcard *:* permission', async () => {
    const user = makeUser([{ resource: '*', action: '*', scope: 'global' }])
    mocks.rawPrisma.user.findUnique.mockResolvedValue(user as any)

    const result = await can('user-1', 'anything')
    expect(result).toBe(true)
  })
})

describe('assertCan', () => {
  beforeEach(() => {
    clearPermissionCache('user-1')
    if (mocks.rawPrisma) mockReset(mocks.rawPrisma)
  })

  it('throws "Insufficient permissions" when user lacks the permission', async () => {
    const user = makeUser([])
    mocks.rawPrisma.user.findUnique.mockResolvedValue(user as any)

    await expect(assertCan('user-1', 'tickets:read:all')).rejects.toThrow('Insufficient permissions')
  })

  it('does not throw when user has the permission', async () => {
    const user = makeUser([{ resource: 'tickets', action: 'read', scope: 'all' }])
    mocks.rawPrisma.user.findUnique.mockResolvedValue(user as any)

    await expect(assertCan('user-1', 'tickets:read:all')).resolves.toBeUndefined()
  })
})

import { DEFAULT_ROLES, PERMISSIONS } from '@/lib/permissions'

describe('DEFAULT_ROLES', () => {
  it('ADMIN role includes PERMISSIONS.SETTINGS_BILLING', () => {
    expect(DEFAULT_ROLES.ADMIN.permissions).toContain(PERMISSIONS.SETTINGS_BILLING)
  })

  it('PERMISSIONS.SETTINGS_BILLING equals "settings:billing"', () => {
    expect(PERMISSIONS.SETTINGS_BILLING).toBe('settings:billing')
  })
})
