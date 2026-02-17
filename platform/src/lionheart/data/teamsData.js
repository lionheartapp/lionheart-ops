// Access levels: Standardized for SaaS School Operations
export const ROLES = [
  {
    id: 'super-admin',
    label: 'Super Admin',
    description: 'Platform-level access; view as any user and see everything',
  },
  {
    id: 'admin',
    label: 'Admin',
    description: 'Full access to settings, billing, and all data.',
  },
  {
    id: 'member',
    label: 'Member',
    description: 'Can manage tickets, events, and view all data. (Best for Maintenance/IT Staff & Secretaries)',
  },
  {
    id: 'requester',
    label: 'Teacher / Staff',
    description: 'Can submit requests and view their own history.',
  },
  {
    id: 'viewer',
    label: 'Viewer',
    description: 'Read-only access.',
  },
]

// Standard Pre-built Teams (roles + divisions)
export const DEFAULT_TEAMS = [
  { id: 'admin', name: 'Administration' },
  { id: 'teachers', name: 'Teachers' },
  { id: 'students', name: 'Students' },
  { id: 'it', name: 'IT' },
  { id: 'facilities', name: 'Maintenance' }, // Mapped to 'facilities' ID for code compatibility
  { id: 'av', name: 'A/V' },
  { id: 'web', name: 'Web' },
  { id: 'athletics', name: 'Athletics' },
  { id: 'security', name: 'Campus Safety' },
  { id: 'elementary-school', name: 'Elementary School' },
  { id: 'middle-school', name: 'Middle School' },
  { id: 'high-school', name: 'High School' },
  { id: 'global', name: 'Global / All divisions' },
]

// Additional teams suggested when adding a new team (high-traffic facility/event departments)
export const TEAM_SUGGESTIONS = [
  { id: 'admissions', name: 'Admissions' },
  { id: 'health-office', name: 'Health Office / Nurse' },
  { id: 'transportation', name: 'Transportation' },
  { id: 'after-school', name: 'After-School / Extended Care' },
  { id: 'pto', name: 'PTO / PTA' },
]

// Default to empty users for a new school instance
export const INITIAL_USERS = []

export function getTeamName(teams, teamId) {
  return teams.find((t) => t.id === teamId)?.name ?? teamId
}

/** Get team IDs for a user (supports both teamIds array and legacy teamId/secondaryTeamId) */
export function getUserTeamIds(user) {
  if (!user) return []
  if (Array.isArray(user.teamIds)) return user.teamIds
  const ids = [user.teamId, user.secondaryTeamId].filter(Boolean)
  return ids
}

/** Primary team for backward compat - first in teamIds or teamId */
export function getPrimaryTeamId(user) {
  const ids = getUserTeamIds(user)
  return ids[0] ?? user?.teamId ?? null
}

export function canCreate(user) {
  return ['admin', 'member', 'requester', 'super-admin', 'creator'].includes(user?.role)
}

export function canEdit(user) {
  return ['admin', 'member', 'super-admin', 'creator'].includes(user?.role)
}

export function canManageTeams(user) {
  return ['admin', 'super-admin'].includes(user?.role)
}

export function isITTeam(user, teams) {
  if (!user) return false
  const ids = getUserTeamIds(user)
  return ids.includes('it') || user.role === 'admin'
}

export function isFacilitiesTeam(user, teams) {
  if (!user) return false
  const ids = getUserTeamIds(user)
  return ids.includes('facilities') || user.role === 'admin'
}

export function isAVTeam(user, teams) {
  if (!user) return false
  const ids = getUserTeamIds(user)
  return ids.includes('av') || user.role === 'admin'
}

/** User is in the Teachers team (sees calendar, requests, personal forms only; no events) */
export function isTeacherTeam(user) {
  if (!user) return false
  const ids = getUserTeamIds(user)
  return ids.includes('teachers') || user.role === 'admin' || user.role === 'super-admin'
}

/** User is only in Teachers (and/or students, etc.) — no IT/Maintenance/A/V/Admin. They cannot create events; forms they create are personal. */
export function isTeachersOnly(user) {
  if (!user) return false
  if (user.role === 'admin' || user.role === 'super-admin') return false
  const ids = getUserTeamIds(user)
  const operational = ['it', 'facilities', 'av', 'admin', 'security', 'web', 'athletics']
  const hasOperational = operational.some((t) => ids.includes(t))
  return !hasOperational && ids.length >= 0
}

/**
 * Can show "Create Event" / "Request Event" and submit to API.
 * Respects SaaS toggle (Linfield vs Alternative):
 * - allowTeacherEventRequests === false (Linfield): only Admin/Super Admin can create events.
 * - allowTeacherEventRequests === true (Alternative): any canCreate user (including teachers) can submit; backend sets PENDING_APPROVAL for non-admins.
 */
export function canCreateEvent(user, allowTeacherEventRequests = false) {
  if (!user) return false
  const isAdmin = user.role === 'admin' || user.role === 'super-admin'
  if (isAdmin) return true
  if (allowTeacherEventRequests) return canCreate(user)
  return false
}

/** Linfield model: event scheduling message when user cannot create events. */
export const EVENT_SCHEDULING_MESSAGE =
  'Event scheduling is managed by the Site Administration. Please contact your Site Secretary to book a facility.'

/** Forms created by teachers-only are personal (only visible to them). */
export function shouldCreatePersonalForm(user) {
  return isTeachersOnly(user)
}

export function isSuperAdmin(user) {
  return user?.role === 'super-admin' || user?.role === 'SUPER_ADMIN'
}

/** IT Admin: admin/super-admin, or member-level user within the IT team */
export function isITAdmin(user, teams) {
  if (!user) return false
  if (user.role === 'admin' || isSuperAdmin(user)) return true
  return user.role === 'member' && getUserTeamIds(user).includes('it')
}

/** Get user names for a team (e.g. 'facilities', 'av') */
export function getTeamMemberNames(users, teamId) {
  if (!users?.length) return []
  return users
    .filter((u) => getUserTeamIds(u).includes(teamId))
    .map((u) => u.name)
    .filter(Boolean)
}
