import { describe, it, expect } from 'vitest'
import {
  PERMISSIONS,
  DEFAULT_ROLES,
  DEFAULT_TEAMS,
  parsePermission,
  matchesPermission,
} from '@/lib/permissions'

// ── PERMISSIONS constants ───────────────────────────────────────────────────

describe('PERMISSIONS', () => {
  it('has ALL wildcard as *:*', () => {
    expect(PERMISSIONS.ALL).toBe('*:*')
  })

  it('all values are colon-separated segments or wildcard', () => {
    const permissionRegex = /^([\w-]+(:[\w-]+)+)$|\*:\*/
    const values = Object.values(PERMISSIONS)
    for (const perm of values) {
      expect(perm).toMatch(permissionRegex)
    }
  })

  it('has no duplicate permission values', () => {
    const values = Object.values(PERMISSIONS)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })

  it('has expected ticket permissions', () => {
    expect(PERMISSIONS.TICKETS_CREATE).toBe('tickets:create')
    expect(PERMISSIONS.TICKETS_READ_ALL).toBe('tickets:read:all')
    expect(PERMISSIONS.TICKETS_READ_OWN).toBe('tickets:read:own')
    expect(PERMISSIONS.TICKETS_READ_TEAM).toBe('tickets:read:team')
  })

  it('has expected maintenance permissions', () => {
    expect(PERMISSIONS.MAINTENANCE_SUBMIT).toBe('maintenance:submit')
    expect(PERMISSIONS.MAINTENANCE_APPROVE_QA).toBe('maintenance:approve:qa')
  })

  it('has expected IT permissions', () => {
    expect(PERMISSIONS.IT_TICKET_SUBMIT).toBe('it:ticket:submit')
    expect(PERMISSIONS.IT_DEVICE_READ).toBe('it:device:read')
  })
})

// ── DEFAULT_ROLES ───────────────────────────────────────────────────────────

describe('DEFAULT_ROLES', () => {
  it('has expected role slugs', () => {
    const slugs = Object.values(DEFAULT_ROLES).map((r) => r.slug)
    expect(slugs).toContain('super-admin')
    expect(slugs).toContain('admin')
    expect(slugs).toContain('member')
    expect(slugs).toContain('viewer')
    expect(slugs).toContain('teacher')
    expect(slugs).toContain('coach')
    expect(slugs).toContain('it-coordinator')
  })

  it('all roles are system roles', () => {
    for (const role of Object.values(DEFAULT_ROLES)) {
      expect(role.isSystem).toBe(true)
    }
  })

  it('super-admin only has the wildcard permission', () => {
    expect(DEFAULT_ROLES.SUPER_ADMIN.permissions).toEqual([PERMISSIONS.ALL])
  })

  it('admin does not have wildcard but has many permissions', () => {
    expect(DEFAULT_ROLES.ADMIN.permissions).not.toContain(PERMISSIONS.ALL)
    expect(DEFAULT_ROLES.ADMIN.permissions.length).toBeGreaterThan(50)
  })

  it('viewer has no create/update/delete/manage permissions', () => {
    const viewerPerms = DEFAULT_ROLES.VIEWER.permissions
    const writeActions = ['create', 'update', 'delete', 'manage', 'assign', 'invite', 'approve']
    for (const perm of viewerPerms) {
      for (const action of writeActions) {
        expect(perm).not.toContain(`:${action}`)
      }
    }
  })

  it('all role permission values exist in PERMISSIONS', () => {
    const allPermValues = new Set(Object.values(PERMISSIONS))
    for (const role of Object.values(DEFAULT_ROLES)) {
      for (const perm of role.permissions) {
        expect(allPermValues.has(perm)).toBe(true)
      }
    }
  })

  it('each role has non-empty name and description', () => {
    for (const role of Object.values(DEFAULT_ROLES)) {
      expect(role.name.length).toBeGreaterThan(0)
      expect(role.description.length).toBeGreaterThan(0)
    }
  })
})

// ── DEFAULT_TEAMS ───────────────────────────────────────────────────────────

describe('DEFAULT_TEAMS', () => {
  it('has 8 teams', () => {
    expect(Object.keys(DEFAULT_TEAMS)).toHaveLength(8)
  })

  it('each team has slug, name, and description', () => {
    for (const team of Object.values(DEFAULT_TEAMS)) {
      expect(team.slug).toBeTruthy()
      expect(team.name).toBeTruthy()
      expect(team.description).toBeTruthy()
    }
  })

  it('slugs are lowercase kebab-case', () => {
    for (const team of Object.values(DEFAULT_TEAMS)) {
      expect(team.slug).toMatch(/^[a-z][a-z0-9-]*$/)
    }
  })
})

// ── parsePermission ─────────────────────────────────────────────────────────

describe('parsePermission', () => {
  it('parses resource:action format', () => {
    const result = parsePermission('tickets:create')
    expect(result).toEqual({ resource: 'tickets', action: 'create', scope: undefined })
  })

  it('parses resource:action:scope format', () => {
    const result = parsePermission('tickets:read:all')
    expect(result).toEqual({ resource: 'tickets', action: 'read', scope: 'all' })
  })

  it('parses wildcard', () => {
    const result = parsePermission('*:*')
    expect(result).toEqual({ resource: '*', action: '*', scope: undefined })
  })

  it('handles empty string gracefully', () => {
    const result = parsePermission('')
    expect(result.resource).toBe('')
  })
})

// ── matchesPermission ───────────────────────────────────────────────────────

describe('matchesPermission', () => {
  it('wildcard *:* matches everything', () => {
    expect(matchesPermission('*:*', 'tickets:create')).toBe(true)
    expect(matchesPermission('*:*', 'events:read:all')).toBe(true)
  })

  it('exact match returns true', () => {
    expect(matchesPermission('tickets:create', 'tickets:create')).toBe(true)
  })

  it('different resource returns false', () => {
    expect(matchesPermission('tickets:create', 'events:create')).toBe(false)
  })

  it('different action returns false', () => {
    expect(matchesPermission('tickets:create', 'tickets:delete')).toBe(false)
  })

  it('scope "all" matches any scope', () => {
    expect(matchesPermission('tickets:read:all', 'tickets:read:own')).toBe(true)
    expect(matchesPermission('tickets:read:all', 'tickets:read:team')).toBe(true)
  })

  it('scope "own" does not match "all"', () => {
    expect(matchesPermission('tickets:read:own', 'tickets:read:all')).toBe(false)
  })

  it('no-scope user permission matches no-scope required', () => {
    expect(matchesPermission('tickets:create', 'tickets:create')).toBe(true)
  })

  it('resource wildcard matches any resource', () => {
    expect(matchesPermission('*:create', 'tickets:create')).toBe(true)
    expect(matchesPermission('*:create', 'events:create')).toBe(true)
  })

  it('action wildcard matches any action', () => {
    expect(matchesPermission('tickets:*', 'tickets:create')).toBe(true)
    expect(matchesPermission('tickets:*', 'tickets:delete')).toBe(true)
  })
})
