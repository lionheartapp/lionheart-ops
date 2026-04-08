import { describe, it, expect } from 'vitest'

// Mock rawPrisma before importing the module (needed because the module imports from @/lib/db)
vi.mock('@/lib/db', () => ({
  rawPrisma: {
    platformAdmin: {
      findUnique: vi.fn(),
    },
  },
}))

import { vi } from 'vitest'
import {
  PLATFORM_PERMISSIONS,
  getPlatformRolePermissions,
  platformAdminCan,
  assertPlatformAdminCan,
} from '@/lib/auth/platform-permissions'

describe('PLATFORM_PERMISSIONS', () => {
  it('has ALL wildcard permission', () => {
    expect(PLATFORM_PERMISSIONS.ALL).toBe('platform:*')
  })

  it('has organization permissions', () => {
    expect(PLATFORM_PERMISSIONS.ORGANIZATIONS_READ).toBe('platform:organizations:read')
    expect(PLATFORM_PERMISSIONS.ORGANIZATIONS_UPDATE).toBe('platform:organizations:update')
  })

  it('all permissions start with platform:', () => {
    for (const value of Object.values(PLATFORM_PERMISSIONS)) {
      expect(value).toMatch(/^platform:/)
    }
  })
})

describe('getPlatformRolePermissions', () => {
  it('returns wildcard for SUPER_ADMIN', () => {
    const perms = getPlatformRolePermissions('SUPER_ADMIN' as never)
    expect(perms).toContain('platform:*')
  })

  it('returns specific permissions for OPERATOR', () => {
    const perms = getPlatformRolePermissions('OPERATOR' as never)
    expect(perms).toContain(PLATFORM_PERMISSIONS.ORGANIZATIONS_READ)
    expect(perms).toContain(PLATFORM_PERMISSIONS.SUPPORT_TICKETS_MANAGE)
    expect(perms).not.toContain(PLATFORM_PERMISSIONS.ALL)
    expect(perms).not.toContain(PLATFORM_PERMISSIONS.ADMINS_MANAGE)
  })

  it('returns empty array for unknown role', () => {
    expect(getPlatformRolePermissions('UNKNOWN_ROLE' as never)).toEqual([])
  })
})

describe('platformAdminCan', () => {
  it('SUPER_ADMIN can do anything via wildcard', () => {
    expect(platformAdminCan('SUPER_ADMIN' as never, PLATFORM_PERMISSIONS.ORGANIZATIONS_READ)).toBe(true)
    expect(platformAdminCan('SUPER_ADMIN' as never, PLATFORM_PERMISSIONS.ADMINS_MANAGE)).toBe(true)
    expect(platformAdminCan('SUPER_ADMIN' as never, 'platform:anything')).toBe(true)
  })

  it('OPERATOR can read organizations', () => {
    expect(platformAdminCan('OPERATOR' as never, PLATFORM_PERMISSIONS.ORGANIZATIONS_READ)).toBe(true)
  })

  it('OPERATOR cannot manage admins', () => {
    expect(platformAdminCan('OPERATOR' as never, PLATFORM_PERMISSIONS.ADMINS_MANAGE)).toBe(false)
  })

  it('OPERATOR cannot manage platform settings', () => {
    expect(platformAdminCan('OPERATOR' as never, PLATFORM_PERMISSIONS.PLATFORM_SETTINGS)).toBe(false)
  })
})

describe('assertPlatformAdminCan', () => {
  it('does not throw when permission is granted', () => {
    expect(() => {
      assertPlatformAdminCan('SUPER_ADMIN' as never, PLATFORM_PERMISSIONS.ORGANIZATIONS_READ)
    }).not.toThrow()
  })

  it('throws when permission is denied', () => {
    expect(() => {
      assertPlatformAdminCan('OPERATOR' as never, PLATFORM_PERMISSIONS.ADMINS_MANAGE)
    }).toThrow('Insufficient platform permissions')
  })

  it('uses custom error message when provided', () => {
    expect(() => {
      assertPlatformAdminCan('OPERATOR' as never, PLATFORM_PERMISSIONS.ADMINS_MANAGE, 'Not allowed')
    }).toThrow('Not allowed')
  })
})
