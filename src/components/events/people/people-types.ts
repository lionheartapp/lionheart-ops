export interface OrgUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  avatar: string | null
  jobTitle: string | null
}

/** A staged member to add (lives only in drawer state). */
export interface StagedMember {
  user: OrgUser
  role: string
  notes: string
}

export function getUserName(user: { firstName: string | null; lastName: string | null }): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unnamed'
}

export function getInitials(user: { firstName: string | null; lastName: string | null }): string {
  const first = user.firstName?.charAt(0) ?? ''
  const last = user.lastName?.charAt(0) ?? ''
  return (first + last).toUpperCase() || '?'
}
