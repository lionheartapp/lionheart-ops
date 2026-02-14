// Access levels: super-admin (see/view as anyone), admin (full), it-admin (IT team lead), creator (create/edit events), viewer (read-only)
export const ROLES = [
  { id: 'super-admin', label: 'Super Admin', description: 'View as any user and see everything' },
  { id: 'admin', label: 'Admin', description: 'Full access, manage users & teams' },
  { id: 'it-admin', label: 'IT Admin', description: 'Manage IT queue, assign tickets to team, oversee IT support' },
  { id: 'creator', label: 'Creator', description: 'Create and edit events' },
  { id: 'viewer', label: 'Viewer', description: 'Read-only access' },
]

// Clean start: no pre-defined teams; schools create their own.
export const DEFAULT_TEAMS = []

// Single admin user for a new school (e.g. Linfield). No sample/demo users.
export const INITIAL_USERS = [
  { id: 'u0', name: 'Admin User', email: 'admin@school.edu', teamIds: [], role: 'super-admin', positionTitle: 'Administrator' },
]

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
  return user && (user.role === 'super-admin' || user.role === 'admin' || user.role === 'it-admin' || user.role === 'creator')
}

export function canEdit(user) {
  return user && (user.role === 'super-admin' || user.role === 'admin' || user.role === 'it-admin' || user.role === 'creator')
}

export function canManageTeams(user) {
  return user && (user.role === 'super-admin' || user.role === 'admin')
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

/** IT Admin: manages IT queue, can assign tickets to any IT team member. Must be in IT team. */
export function isITAdmin(user, teams) {
  if (!user) return false
  if (user.role === 'admin' || isSuperAdmin(user)) return true
  return user.role === 'it-admin' && getUserTeamIds(user).includes('it')
}

/** Get user names for a team (e.g. 'facilities', 'av') */
export function getTeamMemberNames(users, teamId) {
  if (!users?.length) return []
  return users
    .filter((u) => getUserTeamIds(u).includes(teamId))
    .map((u) => u.name)
    .filter(Boolean)
}
