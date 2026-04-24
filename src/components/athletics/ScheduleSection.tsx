'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryOptions, queryKeys } from '@/lib/queries'
import { Plus, CalendarDays, Trash2, Edit2, Trophy, ClipboardList } from 'lucide-react'
import { RRule } from 'rrule'
import { handleAuthResponse } from '@/lib/client-auth'
import { ScheduleSkeleton } from '@/components/athletics/AthleticsTableSkeleton'
import { FloatingDropdown, type DropdownOption } from '@/components/ui/FloatingInput'
import RowActionMenu from '@/components/RowActionMenu'
import ConfirmDialog from '@/components/ConfirmDialog'
import GameDrawer from '@/components/athletics/GameDrawer'
import PracticeDrawer from '@/components/athletics/PracticeDrawer'
import SportIcon, { GlassSportTile } from '@/components/athletics/SportIcon'
import ScoreDialog from '@/components/athletics/ScoreDialog'
import PlayerStatsDialog from '@/components/athletics/PlayerStatsDialog'
import { IllustrationCalendar } from '@/components/illustrations'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Team {
  id: string
  name: string
  level: string
  campusId: string | null
  sport: { id: string; name: string; color: string }
  season: { id: string; name: string }
  _count: { games: number; practices: number }
}

interface TeamSummary {
  id: string
  name: string
  level?: string
  campusId?: string | null
  sport: { name: string; color: string }
}

interface Game {
  id: string
  athleticTeamId: string
  // Optional FK to an in-org opponent team (cross-school games within one org).
  // When null/undefined, opponentName is the only opponent info (external team).
  opponentAthleticTeamId?: string | null
  opponentName: string
  homeAway: string
  startTime: string
  endTime: string
  venue: string | null
  homeScore: number | null
  awayScore: number | null
  isFinal: boolean
  calendarEventId?: string | null
  athleticTeam?: TeamSummary
  opponentAthleticTeam?: TeamSummary | null
}

interface Practice {
  id: string
  athleticTeamId: string
  startTime: string
  endTime: string
  location: string | null
  notes: string | null
  rrule: string | null
  athleticTeam?: { id: string; name: string; sport: { name: string } }
}

interface Calendar {
  id: string
  name: string
  calendarType: string
}

type AgendaItem =
  | { type: 'game'; data: Game; date: string; sortTime: number }
  | { type: 'practice'; data: Practice; date: string; sortTime: number; isExpanded?: boolean }

type FilterType = 'all' | 'games' | 'practices'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function toDateKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getTodayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function expandRecurringPractice(practice: Practice, daysAhead: number = 60): AgendaItem[] {
  if (!practice.rrule) {
    return [{
      type: 'practice',
      data: practice,
      date: toDateKey(practice.startTime),
      sortTime: new Date(practice.startTime).getTime(),
    }]
  }

  try {
    const rule = RRule.fromString(practice.rrule)
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + daysAhead)

    const occurrences = rule.between(start, end, true)
    const origStart = new Date(practice.startTime)
    const origEnd = new Date(practice.endTime)
    const durationMs = origEnd.getTime() - origStart.getTime()

    return occurrences.map((occ) => {
      const occStart = new Date(occ)
      occStart.setHours(origStart.getHours(), origStart.getMinutes(), 0, 0)
      const occEnd = new Date(occStart.getTime() + durationMs)

      return {
        type: 'practice' as const,
        data: {
          ...practice,
          startTime: occStart.toISOString(),
          endTime: occEnd.toISOString(),
        },
        date: toDateKey(occStart.toISOString()),
        sortTime: occStart.getTime(),
        isExpanded: true,
      }
    })
  } catch {
    return [{
      type: 'practice',
      data: practice,
      date: toDateKey(practice.startTime),
      sortTime: new Date(practice.startTime).getTime(),
    }]
  }
}

function getRruleText(rruleStr: string): string {
  try {
    const rule = RRule.fromString(rruleStr)
    const text = rule.toText()
    return text.charAt(0).toUpperCase() + text.slice(1)
  } catch {
    return ''
  }
}

type GameSide = 'owning' | 'opponent'
type HomeAwayLiteral = 'HOME' | 'AWAY' | 'NEUTRAL'

function flipHomeAway(ha: string): HomeAwayLiteral {
  if (ha === 'HOME') return 'AWAY'
  if (ha === 'AWAY') return 'HOME'
  return 'NEUTRAL'
}

/**
 * Score/win calculation needs to know which side the viewer is on. The DB
 * stores `homeScore` / `awayScore` absolutely; whether the viewer's team was
 * home depends on (a) which side they were on in the game record, and
 * (b) the stored `homeAway` flag (which is always relative to the owning team).
 *
 * Rules:
 *   - owning side + HOME   → owning was home
 *   - owning side + AWAY   → owning was away
 *   - opponent side + HOME → opponent was away (away of an away? no — opponent
 *     is the *other* side, so if the owning team was HOME, the opponent was AWAY)
 *   - opponent side + AWAY → opponent was home
 *   - NEUTRAL stays neutral on both sides (no home advantage)
 */
function sideWasHome(game: Game, side: GameSide): boolean {
  if (game.homeAway === 'NEUTRAL') return false
  const owningWasHome = game.homeAway === 'HOME'
  return side === 'owning' ? owningWasHome : !owningWasHome
}

function getScoreDisplayFromSide(game: Game, side: GameSide): string | null {
  if (game.homeScore == null || game.awayScore == null) return null
  const isHome = sideWasHome(game, side)
  const mine = isHome ? game.homeScore : game.awayScore
  const theirs = isHome ? game.awayScore : game.homeScore
  const tied = mine === theirs
  const won = mine > theirs
  const prefix = tied ? 'T' : won ? 'W' : 'L'
  return `${prefix} ${mine}-${theirs}`
}

/**
 * Viewpoint describes how to render a game row from a chosen team's perspective.
 * For most games the viewpoint is the owning team (no flip). For cross-school
 * games where we're viewing the opponent school's schedule, the viewpoint flips
 * to the opponent team — home/away inverts, scores swap, and the labels swap.
 */
interface GameViewpoint {
  side: GameSide
  team: TeamSummary | undefined
  /** Name of the opponent from the viewpoint. */
  opponentLabel: string
  /** Home/away/neutral relative to the viewpoint team. */
  homeAway: HomeAwayLiteral
  scoreDisplay: string | null
}

function resolveGameViewpoint(
  game: Game,
  preferredTeamId: string | null,
  candidateTeamIds: ReadonlySet<string>,
): GameViewpoint {
  // Default to the owning side — it's the canonical record holder.
  let side: GameSide = 'owning'

  if (preferredTeamId) {
    // Explicit preference wins when it matches a side.
    if (game.opponentAthleticTeamId === preferredTeamId) side = 'opponent'
    else side = 'owning'
  } else if (game.opponentAthleticTeamId) {
    // No explicit team — fall back to whichever side is in view.
    const owningInView = candidateTeamIds.has(game.athleticTeamId)
    const opponentInView = candidateTeamIds.has(game.opponentAthleticTeamId)
    if (!owningInView && opponentInView) side = 'opponent'
  }

  if (side === 'owning') {
    return {
      side,
      team: game.athleticTeam,
      opponentLabel: game.opponentAthleticTeam?.name ?? game.opponentName,
      homeAway: (game.homeAway as HomeAwayLiteral) ?? 'HOME',
      scoreDisplay: getScoreDisplayFromSide(game, 'owning'),
    }
  }

  // Flipped — render from opponent side.
  return {
    side,
    team: game.opponentAthleticTeam ?? undefined,
    opponentLabel: game.athleticTeam?.name ?? game.opponentName,
    homeAway: flipHomeAway(game.homeAway),
    scoreDisplay: getScoreDisplayFromSide(game, 'opponent'),
  }
}

function calcRecord(games: Game[], viewpointTeamId: string | null): { wins: number; losses: number; ties: number } {
  let wins = 0, losses = 0, ties = 0
  for (const g of games) {
    if (g.homeScore == null || g.awayScore == null || !g.isFinal) continue
    if (g.homeScore === g.awayScore) { ties++; continue }
    // When viewpointTeamId is null or matches owning side, count from owning
    // perspective; when it matches the opponent side, count from opponent.
    const side: GameSide =
      viewpointTeamId && viewpointTeamId === g.opponentAthleticTeamId ? 'opponent' : 'owning'
    const isHome = sideWasHome(g, side)
    const homeWon = g.homeScore > g.awayScore
    if ((isHome && homeWon) || (!isHome && !homeWon)) wins++
    else losses++
  }
  return { wins, losses, ties }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ScheduleSectionProps {
  activeCampusId: string | null
  canWrite?: boolean
}

const FILTER_PILLS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'games', label: 'Games' },
  { key: 'practices', label: 'Practices' },
]

export default function ScheduleSection({ activeCampusId, canWrite = false }: ScheduleSectionProps) {
  const queryClient = useQueryClient()

  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')

  // ─── Cached Data ──────────────────────────────────────────────────

  const { data: teamsData, isLoading: loading } = useQuery(queryOptions.athleticsTeams())
  const teams = (teamsData ?? []) as Team[]

  const { data: allCalendars } = useQuery(queryOptions.calendars())
  const calendars = ((allCalendars ?? []) as Calendar[]).filter(c => c.calendarType === 'ATHLETICS')

  const { data: gamesData, isLoading: gamesLoading } = useQuery(
    queryOptions.athleticsGames(selectedTeamId || undefined)
  )
  const games = (gamesData ?? []) as Game[]

  const { data: practicesData, isLoading: practicesLoading } = useQuery(
    queryOptions.athleticsPractices(selectedTeamId || undefined)
  )
  const practices = (practicesData ?? []) as Practice[]

  const loadingSchedule = gamesLoading || practicesLoading

  const refreshSchedule = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.athleticsGames.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.athleticsPractices.all })
  }, [queryClient])

  // Drawer/dialog state
  const [gameDrawerOpen, setGameDrawerOpen] = useState(false)
  const [editingGame, setEditingGame] = useState<Game | null>(null)
  const [practiceDrawerOpen, setPracticeDrawerOpen] = useState(false)
  const [editingPractice, setEditingPractice] = useState<Practice | null>(null)
  const [scoreGame, setScoreGame] = useState<Game | null>(null)
  const [playerStatsGame, setPlayerStatsGame] = useState<Game | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'game' | 'practice'; id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null

  // Listen for external "add" triggers from the Add menu
  useEffect(() => {
    const handleAddGame = () => { setEditingGame(null); setGameDrawerOpen(true) }
    const handleAddPractice = () => { setEditingPractice(null); setPracticeDrawerOpen(true) }
    window.addEventListener('athletics-add-game', handleAddGame)
    window.addEventListener('athletics-add-practice', handleAddPractice)
    return () => {
      window.removeEventListener('athletics-add-game', handleAddGame)
      window.removeEventListener('athletics-add-practice', handleAddPractice)
    }
  }, [])

  // ─── Campus-filtered teams ────────────────────────────────────────

  const displayTeams = useMemo(() => {
    if (!activeCampusId) return teams
    return teams.filter((t) => !t.campusId || t.campusId === activeCampusId)
  }, [teams, activeCampusId])

  const teamOptions: DropdownOption[] = useMemo(() => {
    return displayTeams.map((t) => ({
      value: t.id,
      label: `${t.name} — ${t.sport.name}`,
      color: t.sport.color,
    }))
  }, [displayTeams])

  // Reset team selection when campus changes and team is no longer available
  useEffect(() => {
    if (selectedTeamId && !displayTeams.find((t) => t.id === selectedTeamId)) {
      setSelectedTeamId('')
    }
  }, [displayTeams, selectedTeamId])

  // Lookup set built once per render — used by viewpoint resolution and filters.
  const displayTeamIds = useMemo(() => new Set(displayTeams.map((t) => t.id)), [displayTeams])

  // ─── Campus-filtered games/practices when viewing all teams ──────

  const displayGames = useMemo(() => {
    if (selectedTeamId || !activeCampusId) return games
    // A game shows if EITHER side is an in-view team. This keeps cross-school
    // games visible from both schools' perspectives (the owning-team side and
    // the opponent-team side), rather than hiding the game from the opponent's
    // schedule just because the authoritative record is owned by the other team.
    return games.filter((g) => {
      if (displayTeamIds.has(g.athleticTeamId)) return true
      if (g.opponentAthleticTeamId && displayTeamIds.has(g.opponentAthleticTeamId)) return true
      return false
    })
  }, [games, selectedTeamId, activeCampusId, displayTeamIds])

  const displayPractices = useMemo(() => {
    if (selectedTeamId || !activeCampusId) return practices
    return practices.filter((p) => {
      const team = displayTeams.find((t) => t.id === p.athleticTeamId)
      return !!team
    })
  }, [practices, selectedTeamId, activeCampusId, displayTeams])

  // ─── Build agenda ─────────────────────────────────────────────────

  const showingAllTeams = !selectedTeamId

  const agendaItems = useMemo(() => {
    const items: AgendaItem[] = []

    if (filter !== 'practices') {
      for (const game of displayGames) {
        items.push({
          type: 'game',
          data: game,
          date: toDateKey(game.startTime),
          sortTime: new Date(game.startTime).getTime(),
        })
      }
    }

    if (filter !== 'games') {
      for (const practice of displayPractices) {
        items.push(...expandRecurringPractice(practice))
      }
    }

    items.sort((a, b) => a.sortTime - b.sortTime)
    return items
  }, [displayGames, displayPractices, filter])

  // Season record (from final games). When a specific team is selected the
  // record flips correctly regardless of which side of each game they were on.
  const record = useMemo(() => calcRecord(games, selectedTeamId || null), [games, selectedTeamId])
  const selectedTeam = displayTeams.find((t) => t.id === selectedTeamId)

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: { date: string; items: AgendaItem[] }[] = []
    for (const item of agendaItems) {
      const last = groups[groups.length - 1]
      if (last && last.date === item.date) {
        last.items.push(item)
      } else {
        groups.push({ date: item.date, items: [item] })
      }
    }
    return groups
  }, [agendaItems])

  // ─── Handlers ─────────────────────────────────────────────────────

  const openGameCreate = () => {
    setEditingGame(null)
    setGameDrawerOpen(true)
  }

  const openGameEdit = (game: Game) => {
    setEditingGame(game)
    setGameDrawerOpen(true)
  }

  const openPracticeCreate = () => {
    setEditingPractice(null)
    setPracticeDrawerOpen(true)
  }

  const openPracticeEdit = (practice: Practice) => {
    setEditingPractice(practice)
    setPracticeDrawerOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const endpoint = deleteTarget.type === 'game'
        ? `/api/athletics/games/${deleteTarget.id}`
        : `/api/athletics/practices/${deleteTarget.id}`
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (handleAuthResponse(res)) return
      setDeleteTarget(null)
      refreshSchedule()
    } catch {
      // silent
    } finally {
      setDeleting(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────

  if (loading) {
    return <ScheduleSkeleton groups={3} />
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 mb-5">
        <div className="w-full sm:w-64">
          <FloatingDropdown
            id="schedule-team"
            label="Select Team"
            value={selectedTeamId}
            onChange={setSelectedTeamId}
            options={[{ value: '', label: 'All Teams' }, ...teamOptions]}
          />
        </div>

        <div className="inline-flex gap-1 rounded-full bg-slate-100 p-1">
          {FILTER_PILLS.map((pill) => (
            <button
              key={pill.key}
              type="button"
              onClick={() => setFilter(pill.key)}
              className={`relative px-5 py-2 rounded-full text-sm font-medium transition-colors duration-200 cursor-pointer ${
                filter === pill.key
                  ? 'text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {filter === pill.key && (
                <motion.div
                  layoutId="athleticsScheduleFilter"
                  className="absolute inset-0 rounded-full bg-slate-900"
                  transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
                />
              )}
              <span className="relative z-10">{pill.label}</span>
            </button>
          ))}
        </div>

        {canWrite && (
          <div className="flex gap-2 sm:ml-auto">
            <button
              type="button"
              onClick={openGameCreate}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Game
            </button>
            <button
              type="button"
              onClick={openPracticeCreate}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-stone-700 border border-stone-200 rounded-full hover:bg-stone-50 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Practice
            </button>
          </div>
        )}
      </div>

      {/* Season Record Banner */}
      {selectedTeamId && selectedTeam && !loadingSchedule && (
        <div className="flex items-center gap-4 mb-5 px-4 py-3 ui-glass">
          <div className="flex items-center gap-2">
            <GlassSportTile sport={selectedTeam.sport.name} color={selectedTeam.sport.color} size="sm" />
            <span className="text-sm font-semibold text-slate-900">{selectedTeam.name}</span>
            <span className="text-xs text-stone-400">Season Record</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">{record.wins}</div>
              <div className="text-[10px] font-medium text-stone-400 uppercase">W</div>
            </div>
            <div className="w-px h-8 bg-stone-200" />
            <div className="text-center">
              <div className="text-lg font-bold text-red-500">{record.losses}</div>
              <div className="text-[10px] font-medium text-stone-400 uppercase">L</div>
            </div>
            <div className="w-px h-8 bg-stone-200" />
            <div className="text-center">
              <div className="text-lg font-bold text-stone-500">{record.ties}</div>
              <div className="text-[10px] font-medium text-stone-400 uppercase">T</div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {displayTeams.length === 0 ? (
        <div className="ui-glass p-8 text-center">
          <IllustrationCalendar className="w-48 h-40 mx-auto mb-2" />
          <p className="text-base font-semibold text-stone-700 mb-1">No teams available</p>
          <p className="text-sm text-stone-500">Create teams in the Teams tab first</p>
        </div>
      ) : loadingSchedule ? (
        <ScheduleSkeleton groups={2} />
      ) : agendaItems.length === 0 ? (
        <div className="ui-glass p-8 text-center">
          <IllustrationCalendar className="w-48 h-40 mx-auto mb-2" />
          <p className="text-base font-semibold text-stone-700 mb-1">No games or practices scheduled</p>
          <p className="text-sm text-stone-500 mb-4">Get started by creating a game or practice</p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={openGameCreate}
              className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors active:scale-[0.97] cursor-pointer"
            >
              Add Game
            </button>
            <button
              type="button"
              onClick={openPracticeCreate}
              className="px-5 py-2.5 rounded-full bg-white border border-stone-200 text-stone-700 text-sm font-medium hover:bg-stone-50 transition-colors active:scale-[0.97] cursor-pointer"
            >
              Add Practice
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {(() => {
            const todayKey = getTodayKey()
            const allDates = groupedByDate.map(g => g.date)
            const hasPast = allDates.some(d => d < todayKey)
            const hasFuture = allDates.some(d => d >= todayKey)
            const needsTodayDivider = hasPast && hasFuture
            let todayDividerShown = false

            return groupedByDate.map((group) => {
              const isPast = group.date < todayKey
              const isToday = group.date === todayKey
              let todayDivider = null

              if (needsTodayDivider && !todayDividerShown && group.date >= todayKey) {
                todayDividerShown = true
                todayDivider = (
                  <div key="today-divider" className="flex items-center gap-3 py-1">
                    <div className="flex-1 h-px bg-slate-900/20" />
                    <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Today</span>
                    <div className="flex-1 h-px bg-slate-900/20" />
                  </div>
                )
              }

              return (
                <div key={group.date}>
                  {todayDivider}
                  <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${
                    isToday
                      ? 'text-slate-900'
                      : isPast
                        ? 'text-stone-300'
                        : 'text-stone-400'
                  }`}>
                    {formatDate(group.date)}{isToday ? ' — Today' : ''}
                  </h3>
                  <div className={`rounded-2xl border bg-white/60 backdrop-blur-sm divide-y divide-stone-50 shadow-sm ${
                    isPast ? 'border-stone-100/30 opacity-60' : 'border-stone-200/30'
                  }`}>
                    {group.items.map((item, idx) => (
                      item.type === 'game' ? (
                        (() => {
                          const viewpoint = resolveGameViewpoint(
                            item.data,
                            selectedTeamId || null,
                            displayTeamIds,
                          )
                          return (
                            <GameRow
                              key={`game-${item.data.id}-${idx}`}
                              game={item.data}
                              viewpoint={viewpoint}
                              showTeamName={showingAllTeams}
                              onEdit={() => openGameEdit(item.data)}
                              onScore={() => setScoreGame(item.data)}
                              onPlayerStats={() => setPlayerStatsGame(item.data)}
                              onDelete={() => setDeleteTarget({
                                type: 'game',
                                id: item.data.id,
                                name: `vs ${viewpoint.opponentLabel}`,
                              })}
                            />
                          )
                        })()
                      ) : (
                        <PracticeRow
                          key={`practice-${item.data.id}-${idx}`}
                          practice={item.data}
                          showTeamName={showingAllTeams}
                          isExpanded={item.isExpanded}
                          onEdit={() => openPracticeEdit(item.data)}
                          onDelete={() => setDeleteTarget({
                            type: 'practice',
                            id: item.data.id,
                            name: 'this practice',
                          })}
                        />
                      )
                    ))}
                  </div>
                </div>
              )
            })
          })()}
        </div>
      )}

      {/* Drawers & Dialogs */}
      <GameDrawer
        isOpen={gameDrawerOpen}
        onClose={() => { setGameDrawerOpen(false); setEditingGame(null) }}
        onSaved={refreshSchedule}
        editingGame={editingGame}
        teams={displayTeams}
        calendars={calendars}
        preselectedTeamId={selectedTeamId}
      />

      <PracticeDrawer
        isOpen={practiceDrawerOpen}
        onClose={() => { setPracticeDrawerOpen(false); setEditingPractice(null) }}
        onSaved={refreshSchedule}
        editingPractice={editingPractice}
        teams={displayTeams}
        preselectedTeamId={selectedTeamId}
      />

      <ScoreDialog
        isOpen={!!scoreGame}
        onClose={() => setScoreGame(null)}
        onSaved={refreshSchedule}
        game={scoreGame}
        onOpenPlayerStats={(g) => setPlayerStatsGame(g as unknown as Game)}
      />

      <PlayerStatsDialog
        isOpen={!!playerStatsGame}
        onClose={() => setPlayerStatsGame(null)}
        onSaved={refreshSchedule}
        game={playerStatsGame}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Delete ${deleteTarget?.type === 'game' ? 'Game' : 'Practice'}`}
        message={`Are you sure you want to delete ${deleteTarget?.name}? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={deleting}
        loadingText="Deleting..."
      />
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface GameRowProps {
  game: Game
  viewpoint: GameViewpoint
  showTeamName?: boolean
  onEdit: () => void
  onScore: () => void
  onPlayerStats: () => void
  onDelete: () => void
}

function GameRow({
  game,
  viewpoint,
  showTeamName,
  onEdit,
  onScore,
  onPlayerStats,
  onDelete,
}: GameRowProps) {
  const sportColor = viewpoint.team?.sport?.color || '#6a6864'
  const sportName = viewpoint.team?.sport?.name || ''
  const prefix = viewpoint.homeAway === 'AWAY' ? '@' : 'vs'
  const score = viewpoint.scoreDisplay
  const homeAwayLabel =
    viewpoint.homeAway === 'HOME' ? 'Home' : viewpoint.homeAway === 'AWAY' ? 'Away' : 'Neutral'

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50/50 transition-colors">
      <SportIcon sport={sportName} size={16} style={{ color: sportColor }} className="flex-shrink-0" />
      <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-600 bg-stone-100 rounded">
        Game
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {showTeamName && viewpoint.team && (
            <span className="text-xs font-medium text-stone-500">{viewpoint.team.name}</span>
          )}
          <span className="font-medium text-slate-900 text-sm">
            {prefix} {viewpoint.opponentLabel}
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500 font-medium">
            {homeAwayLabel}
          </span>
          {score && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
              game.isFinal ? 'bg-green-50 text-green-700' : 'bg-stone-100 text-stone-600'
            }`}>
              {score}{game.isFinal ? ' ✓' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-stone-500">
          <span>{formatTime(game.startTime)}–{formatTime(game.endTime)}</span>
          {game.venue && <><span className="text-stone-300">·</span><span>{game.venue}</span></>}
        </div>
      </div>
      <RowActionMenu
        items={[
          { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: onEdit },
          { label: 'Score', icon: <Trophy className="w-4 h-4" />, onClick: onScore },
          { label: 'Player Stats', icon: <ClipboardList className="w-4 h-4" />, onClick: onPlayerStats },
          { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: onDelete, variant: 'danger' },
        ]}
      />
    </div>
  )
}

function PracticeRow({
  practice,
  showTeamName,
  isExpanded,
  onEdit,
  onDelete,
}: {
  practice: Practice
  showTeamName?: boolean
  isExpanded?: boolean
  onEdit?: () => void
  onDelete: () => void
}) {
  const rruleText = practice.rrule ? getRruleText(practice.rrule) : null

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50/50 transition-colors">
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-stone-400" />
      <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-stone-500 bg-stone-100 rounded">
        Practice
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {showTeamName && practice.athleticTeam && (
            <span className="text-xs font-medium text-stone-500">{practice.athleticTeam.name}</span>
          )}
          <span className="font-medium text-slate-900 text-sm">
            {showTeamName && practice.athleticTeam ? `${practice.athleticTeam.sport?.name} Practice` : 'Practice'}
          </span>
          {rruleText && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
              {rruleText}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-stone-500">
          <span>{formatTime(practice.startTime)}–{formatTime(practice.endTime)}</span>
          {practice.location && <><span className="text-stone-300">·</span><span>{practice.location}</span></>}
        </div>
      </div>
      {!isExpanded && (
        <RowActionMenu
          items={[
            ...(onEdit ? [{ label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: onEdit }] : []),
            { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: onDelete, variant: 'danger' as const },
          ]}
        />
      )}
    </div>
  )
}
