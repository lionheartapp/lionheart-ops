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
  gameStructure: 'innings' | 'quarters' | 'halves' | 'sets' | 'matches' | 'events' | 'general'
  maxRegularPeriods?: number
  resultMode: 'team_score' | 'sets' | 'matches' | 'events'
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

const BASKETBALL_ACTIONS: SportAction[] = [
  { key: 'ft', label: 'FT', statKey: 'free_throws', scoreDelta: 1, celebration: 'score' },
  { key: 'two', label: '2PT', statKey: 'field_goals_2', scoreDelta: 2, celebration: 'score' },
  { key: 'three', label: '3PT', statKey: 'field_goals_3', scoreDelta: 3, celebration: 'score' },
  { key: 'assist', label: 'Assist', statKey: 'assists' },
  { key: 'rebound', label: 'Rebound', statKey: 'rebounds' },
  { key: 'steal', label: 'Steal', statKey: 'steals' },
  { key: 'block', label: 'Block', statKey: 'blocks' },
  { key: 'foul', label: 'Foul', statKey: 'fouls' },
]

const FOOTBALL_ACTIONS: SportAction[] = [
  { key: 'td', label: 'TD', statKey: 'touchdowns', scoreDelta: 6, celebration: 'score' },
  { key: 'xp', label: 'XP', statKey: 'extra_points', scoreDelta: 1, celebration: 'score' },
  { key: 'fg', label: 'FG', statKey: 'field_goals', scoreDelta: 3, celebration: 'score' },
  { key: 'safety', label: 'Safety', statKey: 'safeties', scoreDelta: 2, celebration: 'score' },
  { key: 'tackle', label: 'Tackle', statKey: 'tackles' },
  { key: 'sack', label: 'Sack', statKey: 'sacks' },
  { key: 'int', label: 'INT', statKey: 'interceptions' },
  { key: 'fumble', label: 'Fumble', statKey: 'fumble_recoveries' },
]

const SOCCER_ACTIONS: SportAction[] = [
  { key: 'goal', label: 'Goal', statKey: 'goals', scoreDelta: 1, celebration: 'score' },
  { key: 'assist', label: 'Assist', statKey: 'assists' },
  { key: 'save', label: 'Save', statKey: 'saves' },
  { key: 'shot', label: 'Shot', statKey: 'shots' },
  { key: 'corner', label: 'Corner', statKey: 'corners' },
  { key: 'yellow', label: 'Yellow', statKey: 'yellow_cards' },
  { key: 'red', label: 'Red', statKey: 'red_cards' },
]

const VOLLEYBALL_ACTIONS: SportAction[] = [
  { key: 'point', label: 'Point', statKey: 'points', scoreDelta: 1, celebration: 'score' },
  { key: 'kill', label: 'Kill', statKey: 'kills', scoreDelta: 1, celebration: 'score' },
  { key: 'ace', label: 'Ace', statKey: 'aces', scoreDelta: 1, celebration: 'score' },
  { key: 'assist', label: 'Assist', statKey: 'assists' },
  { key: 'dig', label: 'Dig', statKey: 'digs' },
  { key: 'block', label: 'Block', statKey: 'blocks', scoreDelta: 1, celebration: 'score' },
  { key: 'error', label: 'Error', statKey: 'errors' },
]

const MATCH_ACTIONS: SportAction[] = [
  { key: 'point', label: 'Point', statKey: 'points', scoreDelta: 1, celebration: 'score' },
  { key: 'game', label: 'Game', statKey: 'games_won' },
  { key: 'set', label: 'Set', statKey: 'sets_won' },
  { key: 'ace', label: 'Ace', statKey: 'aces' },
]

const EVENT_ACTIONS: SportAction[] = [
  { key: 'first', label: '1st', statKey: 'first_place' },
  { key: 'second', label: '2nd', statKey: 'second_place' },
  { key: 'third', label: '3rd', statKey: 'third_place' },
  { key: 'pr', label: 'PR', statKey: 'personal_records' },
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
      gameStructure: 'innings',
      maxRegularPeriods: 7,
      resultMode: 'team_score',
      quickActions: BASEBALL_ACTIONS,
    }
  }

  if (normalized.includes('basketball')) {
    return {
      kind: 'general',
      label: 'Basketball',
      periodLabel: 'Quarter',
      scoreUnit: 'Point',
      primaryStatLabel: 'On court',
      gameStructure: 'quarters',
      maxRegularPeriods: 4,
      resultMode: 'team_score',
      quickActions: BASKETBALL_ACTIONS,
    }
  }

  if (normalized.includes('football')) {
    return {
      kind: 'general',
      label: 'Football',
      periodLabel: 'Quarter',
      scoreUnit: 'Point',
      primaryStatLabel: 'Drive',
      gameStructure: 'quarters',
      maxRegularPeriods: 4,
      resultMode: 'team_score',
      quickActions: FOOTBALL_ACTIONS,
    }
  }

  if (normalized.includes('soccer')) {
    return {
      kind: 'general',
      label: 'Soccer',
      periodLabel: 'Half',
      scoreUnit: 'Goal',
      primaryStatLabel: 'Player',
      gameStructure: 'halves',
      maxRegularPeriods: 2,
      resultMode: 'team_score',
      quickActions: SOCCER_ACTIONS,
    }
  }

  if (normalized.includes('volleyball')) {
    return {
      kind: 'general',
      label: 'Volleyball',
      periodLabel: 'Set',
      scoreUnit: 'Point',
      primaryStatLabel: 'Rotation',
      gameStructure: 'sets',
      maxRegularPeriods: 5,
      resultMode: 'sets',
      quickActions: VOLLEYBALL_ACTIONS,
    }
  }

  if (normalized.includes('tennis') || normalized.includes('golf') || normalized.includes('wrestling')) {
    return {
      kind: 'general',
      label: sportName || 'Match',
      periodLabel: normalized.includes('golf') ? 'Hole' : normalized.includes('wrestling') ? 'Period' : 'Set',
      scoreUnit: normalized.includes('wrestling') ? 'Point' : 'Point',
      primaryStatLabel: 'Match',
      gameStructure: 'matches',
      resultMode: 'matches',
      quickActions: MATCH_ACTIONS,
    }
  }

  if (normalized.includes('track') || normalized.includes('cross country') || normalized.includes('swim')) {
    return {
      kind: 'general',
      label: sportName || 'Meet',
      periodLabel: 'Event',
      scoreUnit: 'Point',
      primaryStatLabel: 'Result',
      gameStructure: 'events',
      resultMode: 'events',
      quickActions: EVENT_ACTIONS,
    }
  }

  return {
    kind: 'general',
    label: sportName || 'Sport',
    periodLabel: 'Game',
    scoreUnit: 'Point',
    primaryStatLabel: 'Actions',
    gameStructure: 'general',
    resultMode: 'team_score',
    quickActions: GENERAL_ACTIONS,
  }
}
