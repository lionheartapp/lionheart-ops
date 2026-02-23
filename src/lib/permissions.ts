/**
 * Permission System
 * 
 * Format: resource:action:scope
 * - resource: What entity (tickets, events, settings, etc.)
 * - action: What operation (create, read, update, delete, approve)
 * - scope: Who can access (own, team, all, or omitted for global)
 * 
 * Examples:
 * - "tickets:create" - Can create tickets
 * - "tickets:read:own" - Can read own tickets
 * - "tickets:read:all" - Can read all tickets
 * - "settings:billing" - Can access billing settings
 */

export const PERMISSIONS = {
  // Tickets
  TICKETS_CREATE: 'tickets:create',
  TICKETS_READ_OWN: 'tickets:read:own',
  TICKETS_READ_TEAM: 'tickets:read:team',
  TICKETS_READ_ALL: 'tickets:read:all',
  TICKETS_UPDATE_OWN: 'tickets:update:own',
  TICKETS_UPDATE_TEAM: 'tickets:update:team',
  TICKETS_UPDATE_ALL: 'tickets:update:all',
  TICKETS_DELETE: 'tickets:delete',
  TICKETS_ASSIGN: 'tickets:assign',
  
  // Events
  EVENTS_CREATE: 'events:create',
  EVENTS_READ: 'events:read',
  EVENTS_UPDATE_OWN: 'events:update:own',
  EVENTS_UPDATE_ALL: 'events:update:all',
  EVENTS_DELETE: 'events:delete',
  EVENTS_APPROVE: 'events:approve',
  
  // Inventory
  INVENTORY_READ: 'inventory:read',
  INVENTORY_CREATE: 'inventory:create',
  INVENTORY_UPDATE: 'inventory:update',
  INVENTORY_DELETE: 'inventory:delete',
  
  // Settings
  SETTINGS_READ: 'settings:read',
  SETTINGS_UPDATE: 'settings:update',
  SETTINGS_BILLING: 'settings:billing',
  
  // Users
  USERS_READ: 'users:read',
  USERS_INVITE: 'users:invite',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  USERS_MANAGE_ROLES: 'users:manage:roles',
  
  // Roles & Teams
  ROLES_READ: 'roles:read',
  ROLES_CREATE: 'roles:create',
  ROLES_UPDATE: 'roles:update',
  ROLES_DELETE: 'roles:delete',
  TEAMS_READ: 'teams:read',
  TEAMS_CREATE: 'teams:create',
  TEAMS_UPDATE: 'teams:update',
  TEAMS_DELETE: 'teams:delete',
  
  // Wildcard (Super Admin)
  ALL: '*:*',
} as const

export type PermissionKey = keyof typeof PERMISSIONS
export type PermissionValue = typeof PERMISSIONS[PermissionKey]

/**
 * Default Role Definitions
 * These are seeded into the database on first run
 */
export const DEFAULT_ROLES = {
  SUPER_ADMIN: {
    slug: 'super-admin',
    name: 'Super Admin',
    description: 'Full system access including billing and user management',
    permissions: [PERMISSIONS.ALL],
    isSystem: true,
  },
  ADMIN: {
    slug: 'admin',
    name: 'Administrator',
    description: 'Full operational access, can manage users and approve events',
    permissions: [
      PERMISSIONS.TICKETS_CREATE,
      PERMISSIONS.TICKETS_READ_ALL,
      PERMISSIONS.TICKETS_UPDATE_ALL,
      PERMISSIONS.TICKETS_DELETE,
      PERMISSIONS.TICKETS_ASSIGN,
      PERMISSIONS.EVENTS_CREATE,
      PERMISSIONS.EVENTS_READ,
      PERMISSIONS.EVENTS_UPDATE_ALL,
      PERMISSIONS.EVENTS_DELETE,
      PERMISSIONS.EVENTS_APPROVE,
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.INVENTORY_CREATE,
      PERMISSIONS.INVENTORY_UPDATE,
      PERMISSIONS.INVENTORY_DELETE,
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.SETTINGS_UPDATE,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.USERS_INVITE,
      PERMISSIONS.USERS_UPDATE,
      PERMISSIONS.USERS_MANAGE_ROLES,
      PERMISSIONS.ROLES_READ,
      PERMISSIONS.ROLES_CREATE,
      PERMISSIONS.TEAMS_READ,
      PERMISSIONS.TEAMS_CREATE,
      PERMISSIONS.TEAMS_UPDATE,
      PERMISSIONS.TEAMS_DELETE,
    ],
    isSystem: true,
  },
  MEMBER: {
    slug: 'member',
    name: 'Member',
    description: 'Standard user with ability to create and manage own tickets',
    permissions: [
      PERMISSIONS.TICKETS_CREATE,
      PERMISSIONS.TICKETS_READ_OWN,
      PERMISSIONS.TICKETS_UPDATE_OWN,
      PERMISSIONS.EVENTS_READ,
      PERMISSIONS.INVENTORY_READ,
      PERMISSIONS.SETTINGS_READ,
    ],
    isSystem: true,
  },
  VIEWER: {
    slug: 'viewer',
    name: 'Viewer',
    description: 'Read-only access',
    permissions: [
      PERMISSIONS.TICKETS_READ_OWN,
      PERMISSIONS.EVENTS_READ,
      PERMISSIONS.INVENTORY_READ,
    ],
    isSystem: true,
  },
} as const

/**
 * Default Team Definitions
 */
export const DEFAULT_TEAMS = {
  IT_SUPPORT: {
    slug: 'it-support',
    name: 'IT Support',
    description: 'Technical infrastructure, hardware, and software support',
  },
  MAINTENANCE: {
    slug: 'maintenance',
    name: 'Facility Maintenance',
    description: 'Physical campus upkeep and repairs',
  },
  AV_PRODUCTION: {
    slug: 'av-production',
    name: 'A/V Production',
    description: 'Audio/visual equipment and event support',
  },
  TEACHERS: {
    slug: 'teachers',
    name: 'Teachers',
    description: 'Teaching staff',
  },
  ADMINISTRATION: {
    slug: 'administration',
    name: 'Administration',
    description: 'School administration and office staff',
  },
} as const

/**
 * Parse permission string into components
 */
export function parsePermission(permission: string): {
  resource: string
  action: string
  scope?: string
} {
  const parts = permission.split(':')
  return {
    resource: parts[0] || '',
    action: parts[1] || '',
    scope: parts[2],
  }
}

/**
 * Check if a permission matches a pattern (supports wildcards)
 */
export function matchesPermission(
  userPermission: string,
  requiredPermission: string
): boolean {
  // Wildcard grants everything
  if (userPermission === '*:*') return true

  const userParts = parsePermission(userPermission)
  const reqParts = parsePermission(requiredPermission)

  // Check resource match
  if (userParts.resource !== '*' && userParts.resource !== reqParts.resource) {
    return false
  }

  // Check action match
  if (userParts.action !== '*' && userParts.action !== reqParts.action) {
    return false
  }

  // Check scope match (if required permission has scope)
  if (reqParts.scope) {
    // If user has 'all' scope, they can access any scope
    if (userParts.scope === 'all') return true
    
    // Otherwise, scopes must match exactly
    if (userParts.scope !== reqParts.scope) return false
  }

  return true
}
