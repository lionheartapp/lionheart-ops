export interface Team {
  id: string
  name: string
  level: string
  schoolId: string | null
  sport: { id: string; name: string; color: string }
  season: { id: string; name: string }
}

export interface RosterPlayer {
  id: string
  athleticTeamId: string
  firstName: string
  lastName: string
  jerseyNumber: string | null
  position: string | null
  grade: string | null
  height: string | null
  weight: string | null
  userId: string | null
  isActive: boolean
  user: { id: string; firstName: string | null; lastName: string | null; email: string } | null
  athleticTeam: { id: string; name: string; sport: { name: string; color: string } }
}

export interface OrgUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
}
