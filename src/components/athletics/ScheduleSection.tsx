'use client'

import { useEffect, useState, useMemo } from 'react'
import { Plus, CalendarDays, Trash2, Edit2, Trophy } from 'lucide-react'
import { RRule } from 'rrule'
import { handleAuthResponse } from '@/lib/client-auth'
import { FloatingDropdown, type DropdownOption } from '@/components/ui/FloatingInput'
import RowActionMenu from '@/components/RowActionMenu'
import ConfirmDialog from '@/components/ConfirmDialog'
import GameDrawer from '@/components/athletics/GameDrawer'
import PracticeDrawer from '@/components/athletics/PracticeDrawer'
import ScoreDialog from '@/components/athletics/ScoreDialog'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Team {
  id: string
  name: string
  level: string
  schoolId: string | null
  sport: { id: string; name: string; color: string }
  season: { id: string; name: string }
  _count: { games: number; practices: number }
}

interface Game {
  id: string
  athleticTeamId: string
  opponentName: string
  homeAway: string
  startTime: string
  endTime: string
  venue: string | null
  homeScore: number | null
  awayScore: number | null
  isFinal: boolean
  calendarEventId?: string | null
  athleticTeam?: { id: string; name: string; level: string; sport: { name: string; color: string } }
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

function getScoreDisplay(game: Game): string | null {
  if (game.homeScore == null || game.awayScore == null) return null
  const won = game.homeAway === 'HOME'
    ? game.homeScore > game.awayScore
    : game.awayScore > game.homeScore
  const tied = game.homeScore === game.awayScore
  const prefix = tied ? 'T' : won ? 'W' : 'L'
  return `${prefix} ${game.homeScore}-${game.awayScore}`
}

function calcRecord(games: Game[]): { wins: number; losses: number; ties: number } {
  let wins = 0, losses = 0, ties = 0
  for (const g of games) {
    if (g.homeScore == null || g.awayScore == null || !g.isFinal) continue
    if (g.homeScore === g.awayScore) { ties++; continue }
    const isHome = g.homeAway === 'HOME'
    const homeWon = g.homeScore > g.awayScore
    if ((isHome && homeWon) || (!isHome && !homeWon)) wins++
    else losses++
  }
  return { wins, losses, ties }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ScheduleSectionProps {
  activeCampusId: string | null
}

const FILTER_PILLS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'games', label: 'Games' },
  { key: 'practices', label: 'Practices' },
]

export default function ScheduleSection({ activeCampusId }: ScheduleSectionProps) {
  const [teams, setTeams] = useState<Team[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [practices, setPractices] = useState<Practice[]>([])
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingSchedule, setLoadingSchedule] = useState(false)

  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')

  // Drawer/dialog state
  const [gameDrawerOpen, setGameDrawerOpen] = useState(false)
  const [editingGame, setEditingGame] = useState<Game | null>(null)
  const [practiceDrawerOpen, setPracticeDrawerOpen] = useState(false)
  const [scoreGame, setScoreGame] = useState<Game | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'game' | 'practice'; id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null

  // ─── Data Fetching ──────────────────────────────────────────────────

  const fetchTeams = async () => {
    if (!token) return
    try {
      const res = await fetch('/api/athletics/teams', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (data.ok) setTeams(data.data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  const fetchCalendars = async () => {
    if (!token) return
    try {
      const res = await fetch('/api/calendars?calendarType=ATHLETICS', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (data.ok) setCalendars(data.data)
    } catch {
      // silent
    }
  }

  const fetchSchedule = async (teamId: string) => {
    if (!token || !teamId) return
    setLoadingSchedule(true)
    try {
      const [gamesRes, practicesRes] = await Promise.all([
        fetch(`/api/athletics/games?teamId=${teamId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/athletics/practices?teamId=${teamId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])
      if (handleAuthResponse(gamesRes) || handleAuthResponse(practicesRes)) return

      const [gamesData, practicesData] = await Promise.all([gamesRes.json(), practicesRes.json()])
      if (gamesData.ok) setGames(gamesData.data)
      if (practicesData.ok) setPractices(practicesData.data)
    } catch {
      // silent
    } finally {
      setLoadingSchedule(false)
    }
  }

  useEffect(() => {
    fetchTeams()
    fetchCalendars()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedTeamId) {
      fetchSchedule(selectedTeamId)
    } else {
      setGames([])
      setPractices([])
    }
  }, [selectedTeamId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Campus-filtered teams ────────────────────────────────────────

  const displayTeams = useMemo(() => {
    if (!activeCampusId) return teams
    return teams.filter((t) => t.schoolId === activeCampusId)
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

  // ─── Build agenda ─────────────────────────────────────────────────

  const agendaItems = useMemo(() => {
    const items: AgendaItem[] = []

    if (filter !== 'practices') {
      for (const game of games) {
        items.push({
          type: 'game',
          data: game,
          date: toDateKey(game.startTime),
          sortTime: new Date(game.startTime).getTime(),
        })
      }
    }

    if (filter !== 'games') {
      for (const practice of practices) {
        items.push(...expandRecurringPractice(practice))
      }
    }

    items.sort((a, b) => a.sortTime - b.sortTime)
    return items
  }, [games, practices, filter])

  // Season record (from final games)
  const record = useMemo(() => calcRecord(games), [games])
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

  const refreshSchedule = () => {
    if (selectedTeamId) fetchSchedule(selectedTeamId)
  }

  const openGameCreate = () => {
    setEditingGame(null)
    setGameDrawerOpen(true)
  }

  const openGameEdit = (game: Game) => {
    setEditingGame(game)
    setGameDrawerOpen(true)
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
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
        <div className="w-full sm:w-64">
          <FloatingDropdown
            id="schedule-team"
            label="Select Team"
            value={selectedTeamId}
            onChange={setSelectedTeamId}
            options={[{ value: '', label: 'All Teams' }, ...teamOptions]}
          />
        </div>

        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {FILTER_PILLS.map((pill) => (
            <button
              key={pill.key}
              type="button"
              onClick={() => setFilter(pill.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === pill.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 sm:ml-auto">
          <button
            type="button"
            onClick={openGameCreate}
            disabled={displayTeams.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add Game
          </button>
          <button
            type="button"
            onClick={() => setPracticeDrawerOpen(true)}
            disabled={displayTeams.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add Practice
          </button>
        </div>
      </div>

      {/* Season Record Banner */}
      {selectedTeamId && selectedTeam && !loadingSchedule && (record.wins + record.losses + record.ties > 0) && (
        <div className="flex items-center gap-4 mb-5 px-4 py-3 rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: selectedTeam.sport.color }}
            />
            <span className="text-sm font-semibold text-gray-900">{selectedTeam.name}</span>
            <span className="text-xs text-gray-400">Season Record</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">{record.wins}</div>
              <div className="text-[10px] font-medium text-gray-400 uppercase">W</div>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <div className="text-lg font-bold text-red-500">{record.losses}</div>
              <div className="text-[10px] font-medium text-gray-400 uppercase">L</div>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <div className="text-lg font-bold text-gray-500">{record.ties}</div>
              <div className="text-[10px] font-medium text-gray-400 uppercase">T</div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {!selectedTeamId && displayTeams.length > 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-medium text-gray-700 mb-1">Select a team</h2>
          <p className="text-sm text-gray-500">Choose a team above to view their schedule</p>
        </div>
      ) : displayTeams.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-medium text-gray-700 mb-1">No teams available</h2>
          <p className="text-sm text-gray-500">Create teams in the Teams tab first</p>
        </div>
      ) : loadingSchedule ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : agendaItems.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
          <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-medium text-gray-700 mb-1">No games or practices scheduled</h2>
          <p className="text-sm text-gray-500 mb-4">Get started by creating a game or practice</p>
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              onClick={openGameCreate}
              className="text-sm text-amber-600 hover:text-amber-700 font-medium"
            >
              Add a game
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={() => setPracticeDrawerOpen(true)}
              className="text-sm text-amber-600 hover:text-amber-700 font-medium"
            >
              Add a practice
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map((group) => (
            <div key={group.date}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {formatDate(group.date)}
              </h3>
              <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-50">
                {group.items.map((item, idx) => (
                  item.type === 'game' ? (
                    <GameRow
                      key={`game-${item.data.id}-${idx}`}
                      game={item.data}
                      onEdit={() => openGameEdit(item.data)}
                      onScore={() => setScoreGame(item.data)}
                      onDelete={() => setDeleteTarget({
                        type: 'game',
                        id: item.data.id,
                        name: `vs ${item.data.opponentName}`,
                      })}
                    />
                  ) : (
                    <PracticeRow
                      key={`practice-${item.data.id}-${idx}`}
                      practice={item.data}
                      isExpanded={item.isExpanded}
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
          ))}
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
        onClose={() => setPracticeDrawerOpen(false)}
        onSaved={refreshSchedule}
        teams={displayTeams}
        preselectedTeamId={selectedTeamId}
      />

      <ScoreDialog
        isOpen={!!scoreGame}
        onClose={() => setScoreGame(null)}
        onSaved={refreshSchedule}
        game={scoreGame}
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

function GameRow({
  game,
  onEdit,
  onScore,
  onDelete,
}: {
  game: Game
  onEdit: () => void
  onScore: () => void
  onDelete: () => void
}) {
  const sportColor = game.athleticTeam?.sport?.color || '#6b7280'
  const prefix = game.homeAway === 'AWAY' ? '@' : 'vs'
  const score = getScoreDisplay(game)
  const homeAwayLabel = game.homeAway === 'HOME' ? 'Home' : game.homeAway === 'AWAY' ? 'Away' : 'Neutral'

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors">
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: sportColor }}
      />
      <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 rounded">
        Game
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 text-sm">
            {prefix} {game.opponentName}
          </span>
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
            {homeAwayLabel}
          </span>
          {score && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
              game.isFinal ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {score}{game.isFinal ? ' ✓' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
          <span>{formatTime(game.startTime)}–{formatTime(game.endTime)}</span>
          {game.venue && <><span className="text-gray-300">·</span><span>{game.venue}</span></>}
        </div>
      </div>
      <RowActionMenu
        items={[
          { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: onEdit },
          { label: 'Score', icon: <Trophy className="w-4 h-4" />, onClick: onScore },
          { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: onDelete, variant: 'danger' },
        ]}
      />
    </div>
  )
}

function PracticeRow({
  practice,
  isExpanded,
  onDelete,
}: {
  practice: Practice
  isExpanded?: boolean
  onDelete: () => void
}) {
  const rruleText = practice.rrule ? getRruleText(practice.rrule) : null

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors">
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-gray-400" />
      <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 rounded">
        Practice
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 text-sm">Practice</span>
          {rruleText && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
              {rruleText}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
          <span>{formatTime(practice.startTime)}–{formatTime(practice.endTime)}</span>
          {practice.location && <><span className="text-gray-300">·</span><span>{practice.location}</span></>}
        </div>
      </div>
      {!isExpanded && (
        <RowActionMenu
          items={[
            { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: onDelete, variant: 'danger' },
          ]}
        />
      )}
    </div>
  )
}
