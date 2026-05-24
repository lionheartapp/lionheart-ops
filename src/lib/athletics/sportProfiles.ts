export interface SportAction {
  key: string
  label: string
  statKey?: string
  scoreDelta?: number
  advancesPlayer?: boolean
  celebration?: 'homeRun' | 'score' | 'generic'
}

export interface SportProfile {
  kind: 'baseball' | 'general'
  label: string
  periodLabel: string
  scoreUnit: string
  primaryStatLabel: string
  quickActions: SportAction[]
}

const BASEBALL_ACTIONS: SportAction[] = [
  { key: 'single', label: '1B', statKey: 'singles', advancesPlayer: true },
  { key: 'double', label: '2B', statKey: 'doubles', advancesPlayer: true },
  { key: 'triple', label: '3B', statKey: 'triples', advancesPlayer: true },
  { key: 'hr', label: 'HR', statKey: 'home_runs', scoreDelta: 1, celebration: 'homeRun', advancesPlayer: true },
  { key: 'walk', label: 'Walk', statKey: 'walks', advancesPlayer: true },
  { key: 'strikeout', label: 'K', statKey: 'strikeouts' },
  { key: 'out', label: 'Out' },
]

const GENERAL_ACTIONS: SportAction[] = [
  { key: 'point', label: 'Point', statKey: 'points', scoreDelta: 1, celebration: 'score' },
  { key: 'assist', label: 'Assist', statKey: 'assists' },
  { key: 'rebound', label: 'Rebound', statKey: 'rebounds' },
  { key: 'save', label: 'Save', statKey: 'saves' },
]

export function getSportProfile(sportName?: string | null): SportProfile {
  const normalized = sportName?.toLowerCase() ?? ''
  if (normalized.includes('baseball') || normalized.includes('softball')) {
    return {
      kind: 'baseball',
      label: normalized.includes('softball') ? 'Softball' : 'Baseball',
      periodLabel: 'Inning',
      scoreUnit: 'Run',
      primaryStatLabel: 'At bat',
      quickActions: BASEBALL_ACTIONS,
    }
  }

  return {
    kind: 'general',
    label: sportName || 'Sport',
    periodLabel: 'Game',
    scoreUnit: 'Point',
    primaryStatLabel: 'Actions',
    quickActions: GENERAL_ACTIONS,
  }
}
