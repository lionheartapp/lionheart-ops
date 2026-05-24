'use client'

import { useState, useEffect, useMemo } from 'react'
import { BarChart3, Users, X } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/Toast'
import { getAuthHeaders } from '@/lib/api-client'

interface Game {
  id: string
  opponentName: string
  homeAway: string
  homeScore: number | null
  awayScore: number | null
  startTime: string
  athleticTeamId: string
  athleticTeam?: { id: string; name: string; sport: { name: string; color: string } }
}

interface RosterPlayer {
  id: string
  athleteId: string
  firstName: string
  lastName: string
  jerseyNumber: string | null
}

interface AthleteRosterResponse {
  id: string
  firstName: string
  lastName: string
  rosters?: Array<{
    id: string
    athleteId: string
    athleticTeamId: string
    jerseyNumber: string | null
    isActive: boolean
  }>
}

interface StatConfig {
  id: string
  statKey: string
  label: string
  sortOrder: number
}

interface ExistingStat {
  rosterId: string
  statKey: string
  statValue: number
}

interface PlayerStatsDialogProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  game: Game | null
}

export default function PlayerStatsDialog({ isOpen, onClose, onSaved, game }: PlayerStatsDialogProps) {
  const { toast } = useToast()
  const [roster, setRoster] = useState<RosterPlayer[]>([])
  const [statConfigs, setStatConfigs] = useState<StatConfig[]>([])
  const [existingStats, setExistingStats] = useState<ExistingStat[]>([])
  const [values, setValues] = useState<Record<string, Record<string, string>>>({}) // rosterId -> statKey -> value
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const focusTrapRef = useFocusTrap(isOpen)

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null

  useEffect(() => {
    if (!isOpen || !game || !token) return

    const fetchData = async () => {
      setLoading(true)
      setError('')

      try {
        // Fetch roster, stat configs, and existing stats in parallel
        const [rosterRes, configRes, statsRes] = await Promise.all([
          fetch(`/api/athletics/roster?teamId=${game.athleticTeamId}&isActive=true`, {
            credentials: 'include',
            headers: { Authorization: `Bearer ${token}` },
          }),
          // Need the sport ID — get it from the game's team
          fetch(`/api/athletics/teams/${game.athleticTeamId}`, {
            credentials: 'include',
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/athletics/games/${game.id}/stats`, {
            credentials: 'include',
            headers: { Authorization: `Bearer ${token}` },
          }),
        ])

        if (handleAuthResponse(rosterRes) || handleAuthResponse(configRes) || handleAuthResponse(statsRes)) return

        const [rosterData, teamData, statsData] = await Promise.all([
          rosterRes.json(),
          configRes.json(),
          statsRes.json(),
        ])

        const rosterList: RosterPlayer[] = rosterData.ok
          ? (rosterData.data as AthleteRosterResponse[])
            .map((athlete) => {
              const teamRoster = athlete.rosters?.find((roster) => roster.athleticTeamId === game.athleticTeamId && roster.isActive)
              if (!teamRoster) return null
              return {
                id: teamRoster.id,
                athleteId: athlete.id,
                firstName: athlete.firstName,
                lastName: athlete.lastName,
                jerseyNumber: teamRoster.jerseyNumber,
              }
            })
            .filter((player): player is RosterPlayer => Boolean(player))
          : []
        setRoster(rosterList)

        const sportId = teamData.ok ? teamData.data.sportId : null

        if (sportId) {
          const cfgRes = await fetch(`/api/athletics/sports/${sportId}/stat-configs`, {
            credentials: 'include',
            headers: { Authorization: `Bearer ${token}` },
          })
          if (!handleAuthResponse(cfgRes)) {
            const cfgData = await cfgRes.json()
            if (cfgData.ok) setStatConfigs(cfgData.data)
          }
        }

        const existingList: ExistingStat[] = statsData.ok
          ? statsData.data.map((s: any) => ({ rosterId: s.rosterId, statKey: s.statKey, statValue: s.statValue }))
          : []
        setExistingStats(existingList)

        // Pre-populate values
        const initial: Record<string, Record<string, string>> = {}
        for (const player of rosterList) {
          initial[player.id] = {}
          for (const stat of existingList) {
            if (stat.rosterId === player.id) {
              initial[player.id][stat.statKey] = String(stat.statValue)
            }
          }
        }
        setValues(initial)
      } catch {
        setError('Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [isOpen, game, token])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const handleCellChange = (rosterId: string, statKey: string, val: string) => {
    setValues((prev) => ({
      ...prev,
      [rosterId]: { ...(prev[rosterId] || {}), [statKey]: val },
    }))
  }

  const handleSave = async () => {
    if (!game || !token) return

    setSaving(true)
    setError('')

    try {
      // Collect all non-empty stat entries
      const stats: Array<{ athleteId: string; rosterId: string; statKey: string; statValue: number }> = []
      for (const [rosterId, keyMap] of Object.entries(values)) {
        const player = roster.find((item) => item.id === rosterId)
        if (!player) continue
        for (const [statKey, val] of Object.entries(keyMap)) {
          const num = parseFloat(val)
          if (!isNaN(num)) {
            stats.push({ athleteId: player.athleteId, rosterId, statKey, statValue: num })
          }
        }
      }

      const res = await fetch(`/api/athletics/games/${game.id}/stats`, {
        method: 'PUT',
        credentials: 'include',
        headers: { ...getAuthHeaders(), Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stats }),
      })

      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!data.ok) {
        setError(data.error?.message || 'Failed to save stats')
        return
      }

      toast('Player stats saved', 'success')
      onSaved()
      onClose()
    } catch {
      setError('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen || !game) return null

  const scoreDisplay = game.homeScore != null && game.awayScore != null
    ? `${game.homeScore} - ${game.awayScore}${game.homeAway === 'AWAY' ? ' (Away)' : ''}`
    : null
  const enteredStatCount = Object.values(values).reduce((total, keyMap) => {
    return total + Object.values(keyMap).filter((value) => value.trim() !== '' && !Number.isNaN(Number(value))).length
  }, 0)
  const dateStr = new Date(game.startTime).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity cursor-pointer"
        onClick={onClose}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={focusTrapRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="stats-dialog-title"
          className="relative w-full max-w-4xl transform overflow-hidden rounded-xl border border-stone-200 bg-white shadow-heavy transition-all"
        >
          <button
            onClick={onClose}
            className="absolute right-3 top-3 p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition z-10"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6">
            <h3 id="stats-dialog-title" className="text-lg font-semibold text-slate-900 mb-1">
              Player Stats
            </h3>
            <div className="flex items-center gap-2 text-sm text-stone-500 mb-5">
              <span>{game.athleticTeam?.name}</span>
              <span className="text-stone-300">vs</span>
              <span>{game.opponentName}</span>
              <span className="text-stone-300">·</span>
              <span>{dateStr}</span>
              {scoreDisplay && (
                <>
                  <span className="text-stone-300">·</span>
                  <span className="font-medium text-stone-700">{scoreDisplay}</span>
                </>
              )}
            </div>
            {!loading && statConfigs.length > 0 && roster.length > 0 && (
              <div className="mb-4 rounded-2xl border border-stone-200 bg-stone-50/70 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">
                  {enteredStatCount} {enteredStatCount === 1 ? 'stat' : 'stats'} entered
                </p>
                <p className="mt-0.5 text-xs text-stone-500">
                  Leave a cell blank if a player did not record that stat.
                </p>
              </div>
            )}

            {loading ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-stone-50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : statConfigs.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No stat categories"
                body="Set up this sport's stat categories in the Stats tab first."
                className="py-8"
              />
            ) : roster.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No players on this roster"
                body="Add players in the Roster tab before entering game stats."
                className="py-8"
              />
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="min-w-full divide-y divide-stone-100">
                  <thead>
                    <tr className="bg-stone-50/50">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-stone-50/50 min-w-[140px]">
                        Player
                      </th>
                      {statConfigs.map((cfg) => (
                        <th
                          key={cfg.statKey}
                          className="px-3 py-2.5 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider min-w-[80px]"
                        >
                          {cfg.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {roster.map((player) => (
                      <tr key={player.id} className="hover:bg-stone-50/30 transition-colors duration-150">
                        <td className="px-3 py-2 sticky left-0 bg-white">
                          <div className="flex items-center gap-2">
                            {player.jerseyNumber && (
                              <span className="text-xs font-bold text-stone-400 w-6 text-right">
                                {player.jerseyNumber}
                              </span>
                            )}
                            <span className="text-sm font-medium text-slate-900">
                              {player.firstName} {player.lastName}
                            </span>
                          </div>
                        </td>
                        {statConfigs.map((cfg) => (
                          <td key={cfg.statKey} className="px-3 py-2">
                            <Input
                              type="number"
                              step="any"
                              min="0"
                              value={values[player.id]?.[cfg.statKey] || ''}
                              onChange={(e) => handleCellChange(player.id, cfg.statKey, e.target.value)}
                              size="sm"
                              className="text-center"
                              placeholder="—"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

            {statConfigs.length > 0 && roster.length > 0 && (
              <div className="flex gap-3 mt-5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-medium text-stone-700 border border-stone-200 rounded-full hover:bg-stone-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Stats'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
