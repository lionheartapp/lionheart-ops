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
  INVENTORY_CHECKOUT: 'inventory:checkout',
  INVENTORY_CHECKIN: 'inventory:checkin',
  
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

  // IT Device Management (MDM)
  IT_DEVICE_READ: 'it:device:read',                         // View device inventory
  IT_DEVICE_CREATE: 'it:device:create',                     // Create new devices
  IT_DEVICE_UPDATE: 'it:device:update',                     // Update device info
  IT_DEVICE_DELETE: 'it:device:delete',                     // Soft-delete devices
  IT_DEVICE_ASSIGN: 'it:device:assign',                     // Assign/unassign devices to students/users
  IT_DEVICE_SYNC: 'it:device:sync',                         // Trigger device sync (Google Admin)
  IT_DEVICE_INTELLIGENCE: 'it:device:intelligence',         // View AI recommendations / lemon reports
  IT_DEVICE_CONFIGURE: 'it:device:configure',               // Configure thresholds (lemon, replace, loaner)

  // Student Records
  STUDENTS_READ: 'students:read',                           // View all students (FERPA full access)
  STUDENTS_READ_OWN_SCHOOL: 'students:read:own-school',     // View students in own school only
  STUDENTS_MANAGE: 'students:manage',                       // Create/update/delete students
  STUDENTS_AUDIT: 'students:audit',                         // View student data access audit log

  // Loaner Pool
  IT_LOANER_CHECKOUT: 'it:loaner:checkout',                 // Checkout a loaner device
  IT_LOANER_CHECKIN: 'it:loaner:checkin',                   // Checkin a loaner device
  IT_LOANER_MANAGE: 'it:loaner:manage',                     // Manage loaner pool (overdue, config)

  // Roster Sync
  IT_ROSTER_SYNC: 'it:roster:sync',                         // Trigger roster sync
  IT_ROSTER_CONFIGURE: 'it:roster:configure',               // Configure Clever/ClassLink connections

  // Device Lifecycle
  IT_DEPLOYMENT_MANAGE: 'it:deployment:manage',              // Create/edit deployment & collection batches
  IT_DEPLOYMENT_PROCESS: 'it:deployment:process',            // Process individual batch items (assign/collect)
  IT_SUMMER_MANAGE: 'it:summer:manage',                      // Manage summer mode, reimaging, staging
  IT_REPAIR_QUEUE_MANAGE: 'it:repair-queue:manage',          // Manage repair queue workflow
  IT_DAMAGE_ASSESS: 'it:damage:assess',                      // Assess device condition during collection
  IT_DAMAGE_EXPORT: 'it:damage:export',                      // Export damage reports for finance
  IT_MDM_CONFIGURE: 'it:mdm:configure',                      // Configure MDM provider (Jamf/Mosyle)
  IT_MDM_SYNC: 'it:mdm:sync',                                // Trigger MDM sync
  IT_STUDENT_PASSWORD: 'it:student:password',                 // Admin-generate student password reset tokens
  IT_AI_DIAGNOSTIC: 'it:ai:diagnostic',                       // Run AI diagnostics on tickets/devices

  // Account Provisioning
  IT_PROVISIONING_MANAGE: 'it:provisioning:manage',            // Manage account provisioning automation
  IT_PROVISIONING_VIEW: 'it:provisioning:view',                // View provisioning events and orphaned accounts
  IT_QR_GENERATE: 'it:qr:generate',                           // Generate QR codes for devices

  // IT Analytics & Reports (District Tier)
  IT_ANALYTICS_READ: 'it:analytics:read',                      // View IT analytics dashboard
  IT_REPORTS_BOARD: 'it:reports:board',                        // View/generate IT board reports

  // E-Rate Compliance
  IT_ERATE_MANAGE: 'it:erate:manage',                          // Manage E-Rate calendar, tasks, docs
  IT_ERATE_VIEW: 'it:erate:view',                              // View E-Rate calendar and status

  // CIPA / Content Filter
  IT_CIPA_AUDIT_VIEW: 'it:cipa:audit:view',                    // View CIPA audit trail
  IT_CIPA_AUDIT_MANAGE: 'it:cipa:audit:manage',                // Manage CIPA evidence retention
  IT_FILTERS_CONFIGURE: 'it:filters:configure',                // Connect/disconnect filter platforms
  IT_FILTERS_MANAGE: 'it:filters:manage',                      // Approve/deny filter exceptions

  // Security Incidents
  IT_INCIDENT_READ: 'it:incident:read',                        // View security incident log
  IT_INCIDENT_CREATE: 'it:incident:create',                    // Report new security incidents
  IT_INCIDENT_MANAGE: 'it:incident:manage',                    // Manage incidents (severity, responders, close)

  // Event Projects
  EVENT_PROJECT_CREATE: 'events:project:create',               // Create a new EventProject (direct request path)
  EVENT_PROJECT_READ: 'events:project:read',                   // View EventProject details and children
  EVENT_PROJECT_UPDATE_OWN: 'events:project:update:own',       // Update own EventProject (creator or assignee)
  EVENT_PROJECT_UPDATE_ALL: 'events:project:update:all',       // Update any EventProject (admin)
  EVENT_PROJECT_DELETE: 'events:project:delete',               // Soft-delete EventProject (admin)
  EVENT_PROJECT_APPROVE: 'events:project:approve',             // Approve/reject PENDING_APPROVAL projects
  EVENT_SERIES_MANAGE: 'events:series:manage',                 // Create/update/delete EventSeries

  // Registration (Medical/FERPA) — Phase 20
  EVENTS_MEDICAL_READ: 'events:medical:read',               // View medical/emergency data for registrations
  EVENTS_REGISTRATION_MANAGE: 'events:registration:manage', // Configure registration forms, view registrations

  // Event Documents, Groups, Communication, Day-of Tools — Phase 21
  EVENTS_DOCUMENTS_MANAGE: 'events:documents:manage',       // Create/edit document requirements, send reminders
  EVENTS_COMPLIANCE_MANAGE: 'events:compliance:manage',     // Manage compliance checklist items
  EVENTS_GROUPS_MANAGE: 'events:groups:manage',             // Create groups, assign participants, manage activities
  EVENTS_CHECKIN_MANAGE: 'events:checkin:manage',           // Scan QR codes, perform check-ins
  EVENTS_ANNOUNCEMENTS_MANAGE: 'events:announcements:manage', // Post announcements to participants
  EVENTS_INCIDENTS_MANAGE: 'events:incidents:manage',       // Log and view day-of incidents
  EVENTS_SURVEYS_MANAGE: 'events:surveys:manage',           // Create and manage post-event surveys

  // Event Templates and AI — Phase 22
  EVENTS_TEMPLATES_MANAGE: 'events:templates:manage',       // Save/create/delete event templates
  EVENTS_NOTIFICATIONS_MANAGE: 'events:notifications:manage', // Create, approve, and dispatch event notification rules

  // Event Budget — Phase 22
  EVENTS_BUDGET_MANAGE: 'events:budget:manage',             // Create/edit/delete budget line items, revenue entries
  EVENTS_BUDGET_READ: 'events:budget:read',                 // View budget data and reports

  // External Integrations — Phase 22
  INTEGRATIONS_MANAGE: 'integrations:manage',               // Manage org-level integrations (PCO, Twilio)
  INTEGRATIONS_GOOGLE_CALENDAR: 'integrations:google-calendar', // Per-user Google Calendar connect

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
      PERMISSIONS.INVENTORY_CHECKOUT,
      PERMISSIONS.INVENTORY_CHECKIN,
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.SETTINGS_UPDATE,
      PERMISSIONS.SETTINGS_BILLING, // Billing tab access — added Phase 16
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
      // MDM + Roster (admin gets all 18)
      PERMISSIONS.IT_DEVICE_READ,
      PERMISSIONS.IT_DEVICE_CREATE,
      PERMISSIONS.IT_DEVICE_UPDATE,
      PERMISSIONS.IT_DEVICE_DELETE,
      PERMISSIONS.IT_DEVICE_ASSIGN,
      PERMISSIONS.IT_DEVICE_SYNC,
      PERMISSIONS.IT_DEVICE_INTELLIGENCE,
      PERMISSIONS.IT_DEVICE_CONFIGURE,
      PERMISSIONS.STUDENTS_READ,
      PERMISSIONS.STUDENTS_READ_OWN_SCHOOL,
      PERMISSIONS.STUDENTS_MANAGE,
      PERMISSIONS.STUDENTS_AUDIT,
      PERMISSIONS.IT_LOANER_CHECKOUT,
      PERMISSIONS.IT_LOANER_CHECKIN,
      PERMISSIONS.IT_LOANER_MANAGE,
      PERMISSIONS.IT_ROSTER_SYNC,
      PERMISSIONS.IT_ROSTER_CONFIGURE,
      // Device Lifecycle (admin gets all 10)
      PERMISSIONS.IT_DEPLOYMENT_MANAGE,
      PERMISSIONS.IT_DEPLOYMENT_PROCESS,
      PERMISSIONS.IT_SUMMER_MANAGE,
      PERMISSIONS.IT_REPAIR_QUEUE_MANAGE,
      PERMISSIONS.IT_DAMAGE_ASSESS,
      PERMISSIONS.IT_DAMAGE_EXPORT,
      PERMISSIONS.IT_MDM_CONFIGURE,
      PERMISSIONS.IT_MDM_SYNC,
      PERMISSIONS.IT_STUDENT_PASSWORD,
      PERMISSIONS.IT_AI_DIAGNOSTIC,
      // Account Provisioning
      PERMISSIONS.IT_PROVISIONING_MANAGE,
      PERMISSIONS.IT_PROVISIONING_VIEW,
      PERMISSIONS.IT_QR_GENERATE,
      // IT Analytics & Reports (District Tier)
      PERMISSIONS.IT_ANALYTICS_READ,
      PERMISSIONS.IT_REPORTS_BOARD,
      // E-Rate + Content Filter
      PERMISSIONS.IT_ERATE_MANAGE,
      PERMISSIONS.IT_ERATE_VIEW,
      PERMISSIONS.IT_CIPA_AUDIT_VIEW,
      PERMISSIONS.IT_CIPA_AUDIT_MANAGE,
      PERMISSIONS.IT_FILTERS_CONFIGURE,
      PERMISSIONS.IT_FILTERS_MANAGE,
      // Security Incidents
      PERMISSIONS.IT_INCIDENT_READ,
      PERMISSIONS.IT_INCIDENT_CREATE,
      PERMISSIONS.IT_INCIDENT_MANAGE,
      // Event Projects
      PERMISSIONS.EVENT_PROJECT_CREATE,
      PERMISSIONS.EVENT_PROJECT_READ,
      PERMISSIONS.EVENT_PROJECT_UPDATE_OWN,
      PERMISSIONS.EVENT_PROJECT_UPDATE_ALL,
      PERMISSIONS.EVENT_PROJECT_DELETE,
      PERMISSIONS.EVENT_PROJECT_APPROVE,
      PERMISSIONS.EVENT_SERIES_MANAGE,
      // Registration permissions (Phase 20)
      PERMISSIONS.EVENTS_MEDICAL_READ,
      PERMISSIONS.EVENTS_REGISTRATION_MANAGE,
      // Phase 21: Documents, Groups, Communication, Day-of Tools
      PERMISSIONS.EVENTS_DOCUMENTS_MANAGE,
      PERMISSIONS.EVENTS_COMPLIANCE_MANAGE,
      PERMISSIONS.EVENTS_GROUPS_MANAGE,
      PERMISSIONS.EVENTS_CHECKIN_MANAGE,
      PERMISSIONS.EVENTS_ANNOUNCEMENTS_MANAGE,
      PERMISSIONS.EVENTS_INCIDENTS_MANAGE,
      PERMISSIONS.EVENTS_SURVEYS_MANAGE,
      // Phase 22: Event Templates, AI, and Notification Orchestration
      PERMISSIONS.EVENTS_TEMPLATES_MANAGE,
      PERMISSIONS.EVENTS_NOTIFICATIONS_MANAGE,
      // Phase 22: Budget
      PERMISSIONS.EVENTS_BUDGET_MANAGE,
      PERMISSIONS.EVENTS_BUDGET_READ,
      // Phase 22: External Integrations
      PERMISSIONS.INTEGRATIONS_MANAGE,
      PERMISSIONS.INTEGRATIONS_GOOGLE_CALENDAR,
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
      // MDM
      PERMISSIONS.IT_DEVICE_READ,
      // Event Projects
      PERMISSIONS.EVENT_PROJECT_CREATE,
      PERMISSIONS.EVENT_PROJECT_READ,
      PERMISSIONS.EVENT_PROJECT_UPDATE_OWN,
      // Phase 21: Documents, Groups, Communication, Day-of Tools (member subset)
      PERMISSIONS.EVENTS_DOCUMENTS_MANAGE,
      PERMISSIONS.EVENTS_GROUPS_MANAGE,
      PERMISSIONS.EVENTS_CHECKIN_MANAGE,
      PERMISSIONS.EVENTS_ANNOUNCEMENTS_MANAGE,
      PERMISSIONS.EVENTS_INCIDENTS_MANAGE,
      // Phase 22: Event Templates (members can use templates)
      PERMISSIONS.EVENTS_TEMPLATES_MANAGE,
      // Phase 22: Budget (members can view budget reports)
      PERMISSIONS.EVENTS_BUDGET_READ,
      // Phase 22: External Integrations (members can connect personal Google Calendar)
      PERMISSIONS.INTEGRATIONS_GOOGLE_CALENDAR,
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
      // MDM + Students
      PERMISSIONS.STUDENTS_READ_OWN_SCHOOL,
      PERMISSIONS.IT_DEVICE_READ,
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
      // MDM
      PERMISSIONS.IT_DEVICE_READ,
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
    description: 'Campus IT staff — manages IT tickets, devices, students, and sync',
    permissions: [
      PERMISSIONS.IT_TICKET_SUBMIT,
      PERMISSIONS.IT_TICKET_READ_ALL,
      PERMISSIONS.IT_TICKET_UPDATE_STATUS,
      PERMISSIONS.IT_TICKET_ASSIGN,
      PERMISSIONS.IT_TICKET_COMMENT_INTERNAL,
      PERMISSIONS.IT_TICKET_COMMENT_SUBMITTER,
      PERMISSIONS.IT_MAGICLINK_GENERATE,
      // MDM + Roster
      PERMISSIONS.IT_DEVICE_READ,
      PERMISSIONS.IT_DEVICE_CREATE,
      PERMISSIONS.IT_DEVICE_UPDATE,
      PERMISSIONS.IT_DEVICE_DELETE,
      PERMISSIONS.IT_DEVICE_ASSIGN,
      PERMISSIONS.IT_DEVICE_SYNC,
      PERMISSIONS.IT_DEVICE_INTELLIGENCE,
      PERMISSIONS.IT_DEVICE_CONFIGURE,
      PERMISSIONS.STUDENTS_READ,
      PERMISSIONS.STUDENTS_READ_OWN_SCHOOL,
      PERMISSIONS.STUDENTS_MANAGE,
      PERMISSIONS.IT_LOANER_CHECKOUT,
      PERMISSIONS.IT_LOANER_CHECKIN,
      PERMISSIONS.IT_LOANER_MANAGE,
      PERMISSIONS.IT_ROSTER_SYNC,
      PERMISSIONS.IT_ROSTER_CONFIGURE,
      // Device Lifecycle
      PERMISSIONS.IT_DEPLOYMENT_MANAGE,
      PERMISSIONS.IT_DEPLOYMENT_PROCESS,
      PERMISSIONS.IT_SUMMER_MANAGE,
      PERMISSIONS.IT_REPAIR_QUEUE_MANAGE,
      PERMISSIONS.IT_DAMAGE_ASSESS,
      PERMISSIONS.IT_DAMAGE_EXPORT,
      PERMISSIONS.IT_MDM_CONFIGURE,
      PERMISSIONS.IT_MDM_SYNC,
      PERMISSIONS.IT_STUDENT_PASSWORD,
      PERMISSIONS.IT_AI_DIAGNOSTIC,
      // Account Provisioning
      PERMISSIONS.IT_PROVISIONING_MANAGE,
      PERMISSIONS.IT_PROVISIONING_VIEW,
      PERMISSIONS.IT_QR_GENERATE,
      // IT Analytics (campus-scoped, no board reports)
      PERMISSIONS.IT_ANALYTICS_READ,
      // E-Rate + Content Filter (view + manage filters)
      PERMISSIONS.IT_ERATE_VIEW,
      PERMISSIONS.IT_CIPA_AUDIT_VIEW,
      PERMISSIONS.IT_FILTERS_MANAGE,
      // Security Incidents
      PERMISSIONS.IT_INCIDENT_READ,
      PERMISSIONS.IT_INCIDENT_CREATE,
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
  STUDENT_TECHNICIAN: {
    slug: 'student-technician',
    name: 'Student Technician',
    description: 'Student IT helper — limited device access, processes deployments, manages loaners',
    permissions: [
      PERMISSIONS.IT_DEVICE_READ,
      PERMISSIONS.IT_DEPLOYMENT_PROCESS,
      PERMISSIONS.IT_LOANER_CHECKIN,
      PERMISSIONS.IT_LOANER_CHECKOUT,
      PERMISSIONS.IT_TICKET_SUBMIT,
      PERMISSIONS.IT_TICKET_READ_OWN,
      PERMISSIONS.IT_TICKET_COMMENT_SUBMITTER,
      PERMISSIONS.STUDENTS_READ_OWN_SCHOOL,
      PERMISSIONS.SETTINGS_READ,
      PERMISSIONS.KB_READ,
    ],
    isSystem: true,
  },
  SECRETARY: {
    slug: 'secretary',
    name: 'Secretary / Front Office',
    description: 'Front office staff — can submit IT tickets, manage loaner checkouts, and generate magic links',
    permissions: [
      PERMISSIONS.IT_TICKET_SUBMIT,
      PERMISSIONS.IT_TICKET_READ_OWN,
      PERMISSIONS.IT_TICKET_COMMENT_SUBMITTER,
      PERMISSIONS.IT_MAGICLINK_GENERATE,
      // MDM + Students
      PERMISSIONS.IT_DEVICE_READ,
      PERMISSIONS.STUDENTS_READ_OWN_SCHOOL,
      PERMISSIONS.IT_LOANER_CHECKOUT,
      PERMISSIONS.IT_LOANER_CHECKIN,
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
