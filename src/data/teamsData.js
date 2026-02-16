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

// Standard Pre-built Teams
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
