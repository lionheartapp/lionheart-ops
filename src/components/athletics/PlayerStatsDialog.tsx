'use client'

import { useState, useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'

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
  firstName: string
  lastName: string
  jerseyNumber: string | null
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
            headers: { Authorization: `Bearer ${token}` },
          }),
          // Need the sport ID — get it from the game's team
          fetch(`/api/athletics/teams/${game.athleticTeamId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/athletics/games/${game.id}/stats`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ])

        if (handleAuthResponse(rosterRes) || handleAuthResponse(configRes) || handleAuthResponse(statsRes)) return

        const [rosterData, teamData, statsData] = await Promise.all([
          rosterRes.json(),
          configRes.json(),
          statsRes.json(),
        ])

        const rosterList: RosterPlayer[] = rosterData.ok ? rosterData.data : []
        setRoster(rosterList)

        const sportId = teamData.ok ? teamData.data.sportId : null

        if (sportId) {
          const cfgRes = await fetch(`/api/athletics/sports/${sportId}/stat-configs`, {
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
      const stats: Array<{ rosterId: string; statKey: string; statValue: number }> = []
      for (const [rosterId, keyMap] of Object.entries(values)) {
        for (const [statKey, val] of Object.entries(keyMap)) {
          const num = parseFloat(val)
          if (!isNaN(num)) {
            stats.push({ rosterId, statKey, statValue: num })
          }
        }
      }

      const res = await fetch(`/api/athletics/games/${game.id}/stats`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stats }),
      })

      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!data.ok) {
        setError(data.error?.message || 'Failed to save stats')
        return
      }

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
  const dateStr = new Date(game.startTime).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div className="fixed inset-0 z-modal overflow-y-auto">
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
          className="relative w-full max-w-4xl transform overflow-hidden rounded-xl border border-gray-200 bg-white shadow-heavy transition-all"
        >
          <button
            onClick={onClose}
            className="absolute right-3 top-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition z-10"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="p-6">
            <h3 id="stats-dialog-title" className="text-lg font-semibold text-gray-900 mb-1">
              Player Stats
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-5">
              <span>{game.athleticTeam?.name}</span>
              <span className="text-gray-300">vs</span>
              <span>{game.opponentName}</span>
              <span className="text-gray-300">·</span>
              <span>{dateStr}</span>
              {scoreDisplay && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="font-medium text-gray-700">{scoreDisplay}</span>
                </>
              )}
            </div>

            {loading ? (
              <div className="space-y-3 py-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : statConfigs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500 mb-1">No stat categories configured for this sport.</p>
                <p className="text-xs text-gray-400">
                  Go to the Stats tab and set up stat categories first.
                </p>
              </div>
            ) : roster.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">No players on this team&apos;s roster.</p>
                <p className="text-xs text-gray-400">Add players in the Roster tab first.</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50/50 min-w-[140px]">
                        Player
                      </th>
                      {statConfigs.map((cfg) => (
                        <th
                          key={cfg.statKey}
                          className="px-3 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[80px]"
                        >
                          {cfg.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {roster.map((player) => (
                      <tr key={player.id} className="hover:bg-gray-50/30">
                        <td className="px-3 py-2 sticky left-0 bg-white">
                          <div className="flex items-center gap-2">
                            {player.jerseyNumber && (
                              <span className="text-xs font-bold text-gray-400 w-6 text-right">
                                {player.jerseyNumber}
                              </span>
                            )}
                            <span className="text-sm font-medium text-gray-900">
                              {player.firstName} {player.lastName}
                            </span>
                          </div>
                        </td>
                        {statConfigs.map((cfg) => (
                          <td key={cfg.statKey} className="px-3 py-2">
                            <input
                              type="number"
                              step="any"
                              value={values[player.id]?.[cfg.statKey] || ''}
                              onChange={(e) => handleCellChange(player.id, cfg.statKey, e.target.value)}
                              className="w-full px-2 py-1.5 text-sm text-center border border-gray-200 rounded-md focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900/10"
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
                  className="flex-1 py-2.5 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
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
