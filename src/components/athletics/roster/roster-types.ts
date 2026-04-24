export interface Team {
  id: string
  name: string
  level: string
  campusId: string | null
  sport: { id: string; name: string; color: string }
  season: { id: string; name: string }
}

export interface RosterEntry {
  id: string
  athleteId: string
  athleticTeamId: string
  jerseyNumber: string | null
  position: string | null
  isActive: boolean
  athleticTeam: {
    id: string
    name: string
    level: string
    sport: { id: string; name: string; color: string }
  }
}

export interface Athlete {
  id: string
  firstName: string
  lastName: string
  grade: string | null
  height: string | null
  weight: string | null
  photoUrl: string | null
  bio: string | null
  userId: string | null
  isActive: boolean
  rosters: RosterEntry[]
  user: { id: string; firstName: string | null; lastName: string | null; email: string } | null
}

// Backwards-compat alias
export type RosterPlayer = Athlete

export interface OrgUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
}
