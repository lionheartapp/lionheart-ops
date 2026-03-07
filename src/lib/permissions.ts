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
  ATHLETICS_ROSTER_MANAGE: 'athletics:roster:manage',
  ATHLETICS_STATS_MANAGE: 'athletics:stats:manage',

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

  // Maintenance
  MAINTENANCE_SUBMIT: 'maintenance:submit',                         // Submit a maintenance request (any authenticated user)
  MAINTENANCE_READ_OWN: 'maintenance:read:own',                     // View own submitted tickets
  MAINTENANCE_READ_ALL: 'maintenance:read:all',                     // View all tickets (head, admin)
  MAINTENANCE_UPDATE_OWN: 'maintenance:update:own',                 // Update own ticket (add comment, cancel own)
  MAINTENANCE_UPDATE_ALL: 'maintenance:update:all',                 // Update any ticket
  MAINTENANCE_ASSIGN: 'maintenance:assign',                         // Assign/reassign tickets to technicians
  MAINTENANCE_CLAIM: 'maintenance:claim',                           // Self-claim tickets (technicians)
  MAINTENANCE_APPROVE_QA: 'maintenance:approve:qa',                 // Sign off QA to DONE (head, admin)
  MAINTENANCE_CANCEL: 'maintenance:cancel',                         // Cancel any ticket (head, admin)
  MAINTENANCE_MANAGE_ASSETS: 'maintenance:assets:manage',           // CRUD on assets (legacy alias)
  MAINTENANCE_MANAGE_PM: 'maintenance:pm:manage',                   // CRUD on PM schedules
  MAINTENANCE_VIEW_ANALYTICS: 'maintenance:analytics:view',         // View analytics dashboard
  MAINTENANCE_MANAGE_TECHNICIANS: 'maintenance:technicians:manage', // Manage technician profiles

  // Asset register (fine-grained)
  ASSETS_READ: 'assets:read',                                       // View asset list and details
  ASSETS_CREATE: 'assets:create',                                   // Create new assets
  ASSETS_UPDATE: 'assets:update',                                   // Edit existing assets
  ASSETS_DELETE: 'assets:delete',                                   // Soft-delete assets

  // Compliance
  COMPLIANCE_READ: 'compliance:read',                               // View compliance calendar and records
  COMPLIANCE_MANAGE: 'compliance:manage',                           // Configure domains, update records, attach docs
  COMPLIANCE_EXPORT: 'compliance:export',                           // Generate audit PDF export

  // Knowledge Base
  KB_READ: 'knowledge-base:read',                                   // View knowledge base articles
  KB_CREATE: 'knowledge-base:create',                               // Create new articles (head, tech, admin)
  KB_UPDATE: 'knowledge-base:update',                               // Edit existing articles
  KB_DELETE: 'knowledge-base:delete',                               // Soft-delete articles (head, admin)

  // IT Help Desk
  IT_TICKET_SUBMIT: 'it:ticket:submit',                     // Submit IT ticket (any authenticated user)
  IT_TICKET_READ_OWN: 'it:ticket:read:own',                 // View own submitted IT tickets
  IT_TICKET_READ_ASSIGNED: 'it:ticket:read:assigned',        // View assigned IT tickets
  IT_TICKET_READ_ALL: 'it:ticket:read:all',                  // View all IT tickets (IT coordinator, admin)
  IT_TICKET_UPDATE_STATUS: 'it:ticket:update:status',        // Update IT ticket status
  IT_TICKET_ASSIGN: 'it:ticket:assign',                      // Assign IT tickets to coordinators
  IT_TICKET_COMMENT_INTERNAL: 'it:ticket:comment:internal',  // Add internal comments (hidden from submitter)
  IT_TICKET_COMMENT_SUBMITTER: 'it:ticket:comment:submitter', // Add submitter-visible comments
  IT_MAGICLINK_GENERATE: 'it:magiclink:generate',            // Generate magic links for sub submissions

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
      // Maintenance permissions
      PERMISSIONS.MAINTENANCE_SUBMIT,
      PERMISSIONS.MAINTENANCE_READ_ALL,
      PERMISSIONS.MAINTENANCE_UPDATE_ALL,
      PERMISSIONS.MAINTENANCE_ASSIGN,
      PERMISSIONS.MAINTENANCE_APPROVE_QA,
      PERMISSIONS.MAINTENANCE_CANCEL,
      PERMISSIONS.MAINTENANCE_MANAGE_ASSETS,
      PERMISSIONS.MAINTENANCE_MANAGE_PM,
      PERMISSIONS.MAINTENANCE_VIEW_ANALYTICS,
      PERMISSIONS.MAINTENANCE_MANAGE_TECHNICIANS,
      // Asset register
      PERMISSIONS.ASSETS_READ,
      PERMISSIONS.ASSETS_CREATE,
      PERMISSIONS.ASSETS_UPDATE,
      PERMISSIONS.ASSETS_DELETE,
      // Compliance
      PERMISSIONS.COMPLIANCE_READ,
      PERMISSIONS.COMPLIANCE_MANAGE,
      PERMISSIONS.COMPLIANCE_EXPORT,
      // Knowledge Base
      PERMISSIONS.KB_READ,
      PERMISSIONS.KB_CREATE,
      PERMISSIONS.KB_UPDATE,
      PERMISSIONS.KB_DELETE,
      // IT Help Desk
      PERMISSIONS.IT_TICKET_SUBMIT,
      PERMISSIONS.IT_TICKET_READ_ALL,
      PERMISSIONS.IT_TICKET_UPDATE_STATUS,
      PERMISSIONS.IT_TICKET_ASSIGN,
      PERMISSIONS.IT_TICKET_COMMENT_INTERNAL,
      PERMISSIONS.IT_TICKET_COMMENT_SUBMITTER,
      PERMISSIONS.IT_MAGICLINK_GENERATE,
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
      // Maintenance permissions
      PERMISSIONS.MAINTENANCE_SUBMIT,
      PERMISSIONS.MAINTENANCE_READ_OWN,
      PERMISSIONS.MAINTENANCE_UPDATE_OWN,
      // Asset register
      PERMISSIONS.ASSETS_READ,
      // Compliance
      PERMISSIONS.COMPLIANCE_READ,
      // Knowledge Base
      PERMISSIONS.KB_READ,
      // IT Help Desk
      PERMISSIONS.IT_TICKET_SUBMIT,
      PERMISSIONS.IT_TICKET_READ_OWN,
      PERMISSIONS.IT_TICKET_COMMENT_SUBMITTER,
    ],
    isSystem: true,
  },
  TEACHER: {
    slug: 'teacher',
    name: 'Teacher',
    description: 'Teaching staff — classroom and personal calendar access',
    permissions: [
      PERMISSIONS.TICKETS_CREATE,
      PERMISSIONS.TICKETS_READ_OWN,
      PERMISSIONS.TICKETS_UPDATE_OWN,
      PERMISSIONS.EVENTS_READ,
      PERMISSIONS.SETTINGS_READ,
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
      // Maintenance permissions
      PERMISSIONS.MAINTENANCE_SUBMIT,
      PERMISSIONS.MAINTENANCE_READ_OWN,
      PERMISSIONS.MAINTENANCE_UPDATE_OWN,
      // Asset register
      PERMISSIONS.ASSETS_READ,
      // Knowledge Base
      PERMISSIONS.KB_READ,
      // IT Help Desk
      PERMISSIONS.IT_TICKET_SUBMIT,
      PERMISSIONS.IT_TICKET_READ_OWN,
      PERMISSIONS.IT_TICKET_COMMENT_SUBMITTER,
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
      // Maintenance permissions
      PERMISSIONS.MAINTENANCE_READ_OWN,
      // Asset register
      PERMISSIONS.ASSETS_READ,
      // Knowledge Base
      PERMISSIONS.KB_READ,
      // IT Help Desk
      PERMISSIONS.IT_TICKET_READ_OWN,
    ],
    isSystem: true,
  },
  ATHLETIC_DIRECTOR: {
    slug: 'athletic-director',
    name: 'Athletic Director',
    description: 'Manages athletic programs, approves games and tournaments',
    permissions: [
      PERMISSIONS.ATHLETICS_MANAGE,
      PERMISSIONS.ATHLETICS_GAMES_CREATE,
      PERMISSIONS.ATHLETICS_GAMES_APPROVE,
      PERMISSIONS.ATHLETICS_GAMES_SCORE,
      PERMISSIONS.ATHLETICS_PRACTICES_CREATE,
      PERMISSIONS.ATHLETICS_PRACTICES_APPROVE,
      PERMISSIONS.ATHLETICS_TOURNAMENTS_MANAGE,
      PERMISSIONS.ATHLETICS_TEAMS_MANAGE,
      PERMISSIONS.ATHLETICS_ROSTER_MANAGE,
      PERMISSIONS.ATHLETICS_STATS_MANAGE,
      PERMISSIONS.ATHLETICS_READ,
      PERMISSIONS.CALENDARS_READ,
      PERMISSIONS.CALENDARS_CREATE,
      PERMISSIONS.CALENDAR_EVENTS_CREATE,
      PERMISSIONS.CALENDAR_EVENTS_READ,
      PERMISSIONS.CALENDAR_EVENTS_UPDATE_ALL,
      PERMISSIONS.CALENDAR_EVENTS_DELETE_ALL,
      PERMISSIONS.CALENDAR_EVENTS_APPROVE,
      PERMISSIONS.ACADEMIC_READ,
      PERMISSIONS.PLANNING_VIEW,
      PERMISSIONS.RESOURCE_REQUESTS_CREATE,
      PERMISSIONS.RESOURCE_REQUESTS_READ_ALL,
      PERMISSIONS.RESOURCE_REQUESTS_RESPOND,
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.TEAMS_READ,
    ],
    isSystem: true,
  },
  COACH: {
    slug: 'coach',
    name: 'Coach',
    description: 'Creates games and practices, scores games for assigned teams',
    permissions: [
      PERMISSIONS.ATHLETICS_GAMES_CREATE,
      PERMISSIONS.ATHLETICS_GAMES_SCORE,
      PERMISSIONS.ATHLETICS_PRACTICES_CREATE,
      PERMISSIONS.ATHLETICS_ROSTER_MANAGE,
      PERMISSIONS.ATHLETICS_STATS_MANAGE,
      PERMISSIONS.ATHLETICS_READ,
      PERMISSIONS.CALENDARS_READ,
      PERMISSIONS.CALENDAR_EVENTS_CREATE_OWN,
      PERMISSIONS.CALENDAR_EVENTS_READ,
      PERMISSIONS.CALENDAR_EVENTS_UPDATE_OWN,
      PERMISSIONS.CALENDAR_EVENTS_DELETE_OWN,
      PERMISSIONS.ACADEMIC_READ,
      PERMISSIONS.PLANNING_VIEW,
      PERMISSIONS.RESOURCE_REQUESTS_CREATE,
      PERMISSIONS.RESOURCE_REQUESTS_READ_OWN,
      PERMISSIONS.SETTINGS_READ,
    ],
    isSystem: true,
  },
  MAINTENANCE_HEAD: {
    slug: 'maintenance-head',
    name: 'Head of Maintenance',
    description: 'Manages the maintenance team, assigns work, approves QA, views analytics',
    permissions: [
      PERMISSIONS.MAINTENANCE_SUBMIT,
      PERMISSIONS.MAINTENANCE_READ_ALL,
      PERMISSIONS.MAINTENANCE_UPDATE_ALL,
      PERMISSIONS.MAINTENANCE_ASSIGN,
      PERMISSIONS.MAINTENANCE_CLAIM,
      PERMISSIONS.MAINTENANCE_APPROVE_QA,
      PERMISSIONS.MAINTENANCE_CANCEL,
      PERMISSIONS.MAINTENANCE_MANAGE_ASSETS,
      PERMISSIONS.MAINTENANCE_MANAGE_PM,
      PERMISSIONS.MAINTENANCE_VIEW_ANALYTICS,
      PERMISSIONS.MAINTENANCE_MANAGE_TECHNICIANS,
      // Asset register
      PERMISSIONS.ASSETS_READ,
      PERMISSIONS.ASSETS_CREATE,
      PERMISSIONS.ASSETS_UPDATE,
      PERMISSIONS.ASSETS_DELETE,
      // Compliance
      PERMISSIONS.COMPLIANCE_READ,
      PERMISSIONS.COMPLIANCE_MANAGE,
      PERMISSIONS.COMPLIANCE_EXPORT,
      // Knowledge Base
      PERMISSIONS.KB_READ,
      PERMISSIONS.KB_CREATE,
      PERMISSIONS.KB_UPDATE,
      PERMISSIONS.KB_DELETE,
      // Platform basics
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.TEAMS_READ,
      PERMISSIONS.CALENDARS_READ,
      PERMISSIONS.CALENDAR_EVENTS_READ,
      PERMISSIONS.ACADEMIC_READ,
    ],
    isSystem: true,
  },
  MAINTENANCE_TECHNICIAN: {
    slug: 'maintenance-technician',
    name: 'Maintenance Technician',
    description: 'Works on assigned tickets, self-claims matching specialty, logs labor',
    permissions: [
      PERMISSIONS.MAINTENANCE_SUBMIT,
      PERMISSIONS.MAINTENANCE_READ_OWN,
      PERMISSIONS.MAINTENANCE_CLAIM,
      PERMISSIONS.MAINTENANCE_UPDATE_OWN,
      // Asset register
      PERMISSIONS.ASSETS_READ,
      // Compliance
      PERMISSIONS.COMPLIANCE_READ,
      // Knowledge Base
      PERMISSIONS.KB_READ,
      PERMISSIONS.KB_CREATE,
      PERMISSIONS.KB_UPDATE,
      // Platform basics
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.CALENDARS_READ,
      PERMISSIONS.CALENDAR_EVENTS_READ,
      PERMISSIONS.ACADEMIC_READ,
    ],
    isSystem: true,
  },
  IT_COORDINATOR: {
    slug: 'it-coordinator',
    name: 'IT Coordinator',
    description: 'Campus IT staff — manages IT tickets, assigns work, generates magic links',
    permissions: [
      PERMISSIONS.IT_TICKET_SUBMIT,
      PERMISSIONS.IT_TICKET_READ_ALL,
      PERMISSIONS.IT_TICKET_UPDATE_STATUS,
      PERMISSIONS.IT_TICKET_ASSIGN,
      PERMISSIONS.IT_TICKET_COMMENT_INTERNAL,
      PERMISSIONS.IT_TICKET_COMMENT_SUBMITTER,
      PERMISSIONS.IT_MAGICLINK_GENERATE,
      // Platform basics
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.USERS_READ,
      PERMISSIONS.TEAMS_READ,
      PERMISSIONS.CALENDARS_READ,
      PERMISSIONS.CALENDAR_EVENTS_READ,
      PERMISSIONS.ACADEMIC_READ,
      // Maintenance — can submit requests
      PERMISSIONS.MAINTENANCE_SUBMIT,
      PERMISSIONS.MAINTENANCE_READ_OWN,
      // Knowledge Base
      PERMISSIONS.KB_READ,
    ],
    isSystem: true,
  },
  SECRETARY: {
    slug: 'secretary',
    name: 'Secretary / Front Office',
    description: 'Front office staff — can submit IT tickets and generate magic links for substitutes',
    permissions: [
      PERMISSIONS.IT_TICKET_SUBMIT,
      PERMISSIONS.IT_TICKET_READ_OWN,
      PERMISSIONS.IT_TICKET_COMMENT_SUBMITTER,
      PERMISSIONS.IT_MAGICLINK_GENERATE,
      // Platform basics
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.CALENDARS_READ,
      PERMISSIONS.CALENDAR_EVENTS_READ,
      PERMISSIONS.ACADEMIC_READ,
      // Maintenance — can submit requests
      PERMISSIONS.MAINTENANCE_SUBMIT,
      PERMISSIONS.MAINTENANCE_READ_OWN,
      // Knowledge Base
      PERMISSIONS.KB_READ,
    ],
    isSystem: true,
  },
  BOARD_MEMBER: {
    slug: 'board-member',
    name: 'Board Member',
    description: 'Read-only access to calendars, planning, and athletics',
    permissions: [
      PERMISSIONS.CALENDARS_READ,
      PERMISSIONS.CALENDAR_EVENTS_READ,
      PERMISSIONS.ACADEMIC_READ,
      PERMISSIONS.PLANNING_VIEW,
      PERMISSIONS.ATHLETICS_READ,
      PERMISSIONS.SETTINGS_READ,
    ],
    isSystem: true,
  },
  PARENT: {
    slug: 'parent',
    name: 'Parent',
    description: 'Read-only access to public-facing calendars and academics',
    permissions: [
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
  SECURITY: {
    slug: 'security',
    name: 'Security',
    description: 'Campus security and access control',
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
