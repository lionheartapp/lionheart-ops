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
  USERS_MANAGE_PERMISSIONS: 'users:manage:permissions',
  
  // Roles & Teams
  ROLES_READ: 'roles:read',
  ROLES_CREATE: 'roles:create',
  ROLES_UPDATE: 'roles:update',
  ROLES_DELETE: 'roles:delete',
  TEAMS_READ: 'teams:read',
  TEAMS_CREATE: 'teams:create',
  TEAMS_UPDATE: 'teams:update',
  TEAMS_DELETE: 'teams:delete',
  
  // Calendar
  CALENDARS_CREATE: 'calendars:create',
  CALENDARS_READ: 'calendars:read',
  CALENDARS_UPDATE: 'calendars:update',
  CALENDARS_DELETE: 'calendars:delete',
  CALENDARS_SHARE: 'calendars:share',

  // Calendar Events
  CALENDAR_EVENTS_CREATE: 'calendar-events:create',
  CALENDAR_EVENTS_CREATE_OWN: 'calendar-events:create:own-calendar',
  CALENDAR_EVENTS_READ: 'calendar-events:read',
  CALENDAR_EVENTS_UPDATE_OWN: 'calendar-events:update:own',
  CALENDAR_EVENTS_UPDATE_ALL: 'calendar-events:update:all',
  CALENDAR_EVENTS_DELETE_OWN: 'calendar-events:delete:own',
  CALENDAR_EVENTS_DELETE_ALL: 'calendar-events:delete:all',
  CALENDAR_EVENTS_APPROVE: 'calendar-events:approve',
  CALENDAR_EVENTS_PUBLISH: 'calendar-events:publish',

  // Athletics
  ATHLETICS_MANAGE: 'athletics:manage',
  ATHLETICS_GAMES_CREATE: 'athletics:games:create',
  ATHLETICS_GAMES_APPROVE: 'athletics:games:approve',
  ATHLETICS_GAMES_SCORE: 'athletics:games:score',
  ATHLETICS_PRACTICES_CREATE: 'athletics:practices:create',
  ATHLETICS_PRACTICES_APPROVE: 'athletics:practices:approve',
  ATHLETICS_TOURNAMENTS_MANAGE: 'athletics:tournaments:manage',
  ATHLETICS_TEAMS_MANAGE: 'athletics:teams:manage',
  ATHLETICS_READ: 'athletics:read',

  // Academic Calendar
  ACADEMIC_MANAGE: 'academic:manage',
  ACADEMIC_BELL_SCHEDULES: 'academic:bell-schedules',
  ACADEMIC_SPECIAL_DAYS: 'academic:special-days',
  ACADEMIC_READ: 'academic:read',

  // Planning Season
  PLANNING_MANAGE: 'planning:manage',
  PLANNING_SUBMIT: 'planning:submit',
  PLANNING_REVIEW: 'planning:review',
  PLANNING_VIEW: 'planning:view',
  PLANNING_COMMENT: 'planning:comment',

  // Resource Requests
  RESOURCE_REQUESTS_CREATE: 'resource-requests:create',
  RESOURCE_REQUESTS_READ_OWN: 'resource-requests:read:own',
  RESOURCE_REQUESTS_READ_ALL: 'resource-requests:read:all',
  RESOURCE_REQUESTS_RESPOND: 'resource-requests:respond',
  RESOURCE_REQUESTS_MANAGE: 'resource-requests:manage',

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
      PERMISSIONS.USERS_MANAGE_PERMISSIONS,
      PERMISSIONS.ROLES_READ,
      PERMISSIONS.ROLES_CREATE,
      PERMISSIONS.TEAMS_READ,
      PERMISSIONS.TEAMS_CREATE,
      PERMISSIONS.TEAMS_UPDATE,
      PERMISSIONS.TEAMS_DELETE,
      // Calendar permissions
      PERMISSIONS.CALENDARS_CREATE,
      PERMISSIONS.CALENDARS_READ,
      PERMISSIONS.CALENDARS_UPDATE,
      PERMISSIONS.CALENDARS_DELETE,
      PERMISSIONS.CALENDARS_SHARE,
      PERMISSIONS.CALENDAR_EVENTS_CREATE,
      PERMISSIONS.CALENDAR_EVENTS_READ,
      PERMISSIONS.CALENDAR_EVENTS_UPDATE_ALL,
      PERMISSIONS.CALENDAR_EVENTS_DELETE_ALL,
      PERMISSIONS.CALENDAR_EVENTS_APPROVE,
      PERMISSIONS.CALENDAR_EVENTS_PUBLISH,
      PERMISSIONS.ACADEMIC_MANAGE,
      PERMISSIONS.ACADEMIC_BELL_SCHEDULES,
      PERMISSIONS.ACADEMIC_SPECIAL_DAYS,
      PERMISSIONS.ACADEMIC_READ,
      PERMISSIONS.PLANNING_MANAGE,
      PERMISSIONS.PLANNING_SUBMIT,
      PERMISSIONS.PLANNING_REVIEW,
      PERMISSIONS.PLANNING_VIEW,
      PERMISSIONS.PLANNING_COMMENT,
      PERMISSIONS.RESOURCE_REQUESTS_CREATE,
      PERMISSIONS.RESOURCE_REQUESTS_READ_ALL,
      PERMISSIONS.RESOURCE_REQUESTS_RESPOND,
      PERMISSIONS.RESOURCE_REQUESTS_MANAGE,
      PERMISSIONS.ATHLETICS_MANAGE,
      PERMISSIONS.ATHLETICS_GAMES_CREATE,
      PERMISSIONS.ATHLETICS_GAMES_APPROVE,
      PERMISSIONS.ATHLETICS_GAMES_SCORE,
      PERMISSIONS.ATHLETICS_READ,
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
      // Calendar permissions for staff/teachers
      PERMISSIONS.CALENDARS_READ,
      PERMISSIONS.CALENDAR_EVENTS_CREATE_OWN,
      PERMISSIONS.CALENDAR_EVENTS_READ,
      PERMISSIONS.CALENDAR_EVENTS_UPDATE_OWN,
      PERMISSIONS.CALENDAR_EVENTS_DELETE_OWN,
      PERMISSIONS.ACADEMIC_READ,
      PERMISSIONS.PLANNING_SUBMIT,
      PERMISSIONS.PLANNING_VIEW,
      PERMISSIONS.PLANNING_COMMENT,
      PERMISSIONS.RESOURCE_REQUESTS_CREATE,
      PERMISSIONS.RESOURCE_REQUESTS_READ_OWN,
      PERMISSIONS.ATHLETICS_READ,
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
      // Calendar read-only
      PERMISSIONS.CALENDARS_READ,
      PERMISSIONS.CALENDAR_EVENTS_READ,
      PERMISSIONS.ACADEMIC_READ,
      PERMISSIONS.ATHLETICS_READ,
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
