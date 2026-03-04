'use client'

import { useState, useEffect, useMemo } from 'react'
import { BarChart3, Trophy, Plus, Trash2, Settings, ArrowRight, CalendarDays } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import { FloatingInput, FloatingDropdown, type DropdownOption } from '@/components/ui/FloatingInput'

interface Sport {
  id: string
  name: string
  color: string
}

interface Season {
  id: string
  name: string
  sport: { id: string; name: string }
}

interface Standing {
  teamId: string
  teamName: string
  level: string
  sport: { id: string; name: string; color: string }
  season: { id: string; name: string }
  wins: number
  losses: number
  ties: number
  gamesPlayed: number
  winPct: number
  rosterCount: number
}

interface Leader {
  rank: number
  rosterId: string
  playerName: string
  jerseyNumber: string | null
  team: { id: string; name: string; sport: { name: string } }
  total: number
  gamesPlayed: number
  average: number
}

interface StatConfig {
  id: string
  statKey: string
  label: string
  sortOrder: number
}

interface StatsSectionProps {
  activeCampusId: string | null
  canWrite?: boolean
}

type StatsView = 'standings' | 'leaders' | 'config'

export default function StatsSection({ activeCampusId, canWrite = false }: StatsSectionProps) {
  const [sports, setSports] = useState<Sport[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)

  const [view, setView] = useState<StatsView>('standings')
  const [selectedSportId, setSelectedSportId] = useState('')
  const [selectedSeasonId, setSelectedSeasonId] = useState('')

  // Standings state
  const [standings, setStandings] = useState<Standing[]>([])
  const [loadingStandings, setLoadingStandings] = useState(false)

  // Leaders state
  const [statConfigs, setStatConfigs] = useState<StatConfig[]>([])
  const [selectedStatKey, setSelectedStatKey] = useState('')
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [loadingLeaders, setLoadingLeaders] = useState(false)

  // Config state
  const [configSportId, setConfigSportId] = useState('')
  const [configs, setConfigs] = useState<StatConfig[]>([])
  const [loadingConfigs, setLoadingConfigs] = useState(false)
  const [newStatKey, setNewStatKey] = useState('')
  const [newStatLabel, setNewStatLabel] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null

  // ─── Data Fetching ────────────────────────────────────────────────

  useEffect(() => {
    if (!token) return
    const fetchBase = async () => {
      try {
        const [sportsRes, seasonsRes] = await Promise.all([
          fetch('/api/athletics/sports', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/athletics/seasons', { headers: { Authorization: `Bearer ${token}` } }),
        ])
        if (handleAuthResponse(sportsRes) || handleAuthResponse(seasonsRes)) return
        const [sportsData, seasonsData] = await Promise.all([sportsRes.json(), seasonsRes.json()])
        if (sportsData.ok) setSports(sportsData.data)
        if (seasonsData.ok) setSeasons(seasonsData.data)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    fetchBase()
  }, [token])

  // Fetch standings when filters change
  useEffect(() => {
    if (view !== 'standings' || !token) return
    const fetchStandings = async () => {
      setLoadingStandings(true)
      try {
        const params = new URLSearchParams()
        if (selectedSportId) params.set('sportId', selectedSportId)
        if (selectedSeasonId) params.set('seasonId', selectedSeasonId)
        const res = await fetch(`/api/athletics/standings?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (handleAuthResponse(res)) return
        const data = await res.json()
        if (data.ok) setStandings(data.data)
      } catch {
        // silent
      } finally {
        setLoadingStandings(false)
      }
    }
    fetchStandings()
  }, [view, selectedSportId, selectedSeasonId, token])

  // Fetch stat configs for selected sport (for leaders dropdown)
  useEffect(() => {
    if (view !== 'leaders' || !selectedSportId || !token) {
      setStatConfigs([])
      return
    }
    const fetchConfigs = async () => {
      try {
        const res = await fetch(`/api/athletics/sports/${selectedSportId}/stat-configs`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (handleAuthResponse(res)) return
        const data = await res.json()
        if (data.ok) setStatConfigs(data.data)
      } catch {
        // silent
      }
    }
    fetchConfigs()
  }, [view, selectedSportId, token])

  // Fetch leaders when stat key changes
  useEffect(() => {
    if (view !== 'leaders' || !selectedStatKey || !token) return
    const fetchLeaders = async () => {
      setLoadingLeaders(true)
      try {
        const params = new URLSearchParams({ statKey: selectedStatKey })
        if (selectedSportId) params.set('sportId', selectedSportId)
        if (selectedSeasonId) params.set('seasonId', selectedSeasonId)
        const res = await fetch(`/api/athletics/stats/leaders?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (handleAuthResponse(res)) return
        const data = await res.json()
        if (data.ok) setLeaders(data.data)
      } catch {
        // silent
      } finally {
        setLoadingLeaders(false)
      }
    }
    fetchLeaders()
  }, [view, selectedStatKey, selectedSportId, selectedSeasonId, token])

  // Fetch configs for management
  useEffect(() => {
    if (view !== 'config' || !configSportId || !token) return
    const fetchConfigs = async () => {
      setLoadingConfigs(true)
      try {
        const res = await fetch(`/api/athletics/sports/${configSportId}/stat-configs`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (handleAuthResponse(res)) return
        const data = await res.json()
        if (data.ok) setConfigs(data.data)
      } catch {
        // silent
      } finally {
        setLoadingConfigs(false)
      }
    }
    fetchConfigs()
  }, [view, configSportId, token])

  // ─── Options ──────────────────────────────────────────────────────

  const sportOptions: DropdownOption[] = useMemo(() => [
    { value: '', label: 'All Sports' },
    ...sports.map((s) => ({ value: s.id, label: s.name, color: s.color })),
  ], [sports])

  const seasonOptions: DropdownOption[] = useMemo(() => {
    const filtered = selectedSportId
      ? seasons.filter((s) => s.sport.id === selectedSportId)
      : seasons
    return [
      { value: '', label: 'All Seasons' },
      ...filtered.map((s) => ({ value: s.id, label: s.name })),
    ]
  }, [seasons, selectedSportId])

  const statKeyOptions: DropdownOption[] = useMemo(() => [
    { value: '', label: 'Select stat...' },
    ...statConfigs.map((c) => ({ value: c.statKey, label: c.label })),
  ], [statConfigs])

  const configSportOptions: DropdownOption[] = useMemo(() => [
    { value: '', label: 'Select sport...' },
    ...sports.map((s) => ({ value: s.id, label: s.name, color: s.color })),
  ], [sports])

  // ─── Config handlers ──────────────────────────────────────────────

  const handleAddConfig = async () => {
    if (!newStatKey.trim() || !newStatLabel.trim() || !configSportId || !token) return
    setSavingConfig(true)
    try {
      const res = await fetch(`/api/athletics/sports/${configSportId}/stat-configs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          configs: [
            ...configs.map((c) => ({ statKey: c.statKey, label: c.label, sortOrder: c.sortOrder })),
            { statKey: newStatKey.trim().toLowerCase().replace(/\s+/g, '_'), label: newStatLabel.trim(), sortOrder: configs.length },
          ],
        }),
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (data.ok) {
        setConfigs(data.data)
        setNewStatKey('')
        setNewStatLabel('')
      }
    } catch {
      // silent
    } finally {
      setSavingConfig(false)
    }
  }

  const handleRemoveConfig = async (id: string) => {
    if (!configSportId || !token) return
    try {
      const res = await fetch(`/api/athletics/sports/${configSportId}/stat-configs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          configs: configs.filter((c) => c.id !== id).map((c) => ({
            statKey: c.statKey,
            label: c.label,
            sortOrder: c.sortOrder,
          })),
          deleteIds: [id],
        }),
      })
      if (handleAuthResponse(res)) return
      setConfigs((prev) => prev.filter((c) => c.id !== id))
    } catch {
      // silent
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
      {/* View tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mb-5 w-fit">
        {([
          { key: 'standings' as const, label: 'Standings', icon: Trophy },
          { key: 'leaders' as const, label: 'Stat Leaders', icon: BarChart3 },
          ...(canWrite ? [{ key: 'config' as const, label: 'Stat Config', icon: Settings }] : []),
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ─── Standings ──────────────────────────────────────────────── */}
      {view === 'standings' && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="w-full sm:w-48">
              <FloatingDropdown id="standings-sport" label="Sport" value={selectedSportId} onChange={setSelectedSportId} options={sportOptions} />
            </div>
            <div className="w-full sm:w-48">
              <FloatingDropdown id="standings-season" label="Season" value={selectedSeasonId} onChange={setSelectedSeasonId} options={seasonOptions} />
            </div>
          </div>

          {loadingStandings ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />)}
            </div>
          ) : standings.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
              <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h2 className="text-lg font-medium text-gray-700 mb-1">No standings data</h2>
              <p className="text-sm text-gray-500 mb-3">
                Standings update when games are marked as final with scores recorded.
              </p>
              <p className="text-xs text-gray-400">
                Go to the <span className="font-medium text-gray-600">Schedule</span> tab to score games and mark them final.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Team</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">W</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">L</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">T</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Win%</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">GP</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Roster</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {standings.map((s, i) => (
                      <tr key={s.teamId} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-bold text-gray-400">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.sport.color }} />
                            <span className="text-sm font-medium text-gray-900">{s.teamName}</span>
                            <span className="text-[10px] text-gray-400">{s.sport.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-center font-semibold text-green-600">{s.wins}</td>
                        <td className="px-4 py-3 text-sm text-center font-semibold text-red-500">{s.losses}</td>
                        <td className="px-4 py-3 text-sm text-center font-semibold text-gray-500">{s.ties}</td>
                        <td className="px-4 py-3 text-sm text-center text-gray-700 hidden sm:table-cell">{(s.winPct * 100).toFixed(0)}%</td>
                        <td className="px-4 py-3 text-sm text-center text-gray-500 hidden sm:table-cell">{s.gamesPlayed}</td>
                        <td className="px-4 py-3 text-sm text-center text-gray-500 hidden md:table-cell">{s.rosterCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Leaders ────────────────────────────────────────────────── */}
      {view === 'leaders' && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="w-full sm:w-48">
              <FloatingDropdown id="leaders-sport" label="Sport" value={selectedSportId} onChange={(v) => { setSelectedSportId(v); setSelectedStatKey('') }} options={sportOptions} />
            </div>
            <div className="w-full sm:w-48">
              <FloatingDropdown id="leaders-season" label="Season" value={selectedSeasonId} onChange={setSelectedSeasonId} options={seasonOptions} />
            </div>
            <div className="w-full sm:w-48">
              <FloatingDropdown id="leaders-stat" label="Stat Category" value={selectedStatKey} onChange={setSelectedStatKey} options={statKeyOptions} />
            </div>
          </div>

          {!selectedSportId ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
              <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h2 className="text-lg font-medium text-gray-700 mb-1">Select a sport</h2>
              <p className="text-sm text-gray-500">Choose a sport to see available stat categories</p>
            </div>
          ) : !selectedStatKey ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
              <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              {statConfigs.length === 0 ? (
                <>
                  <h2 className="text-lg font-medium text-gray-700 mb-1">No stat categories configured</h2>
                  <p className="text-sm text-gray-500 mb-4">
                    Set up stat categories for this sport first, then you can track player stats per game.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setView('config'); setConfigSportId(selectedSportId) }}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
                  >
                    Go to Stat Config
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-medium text-gray-700 mb-1">Select a stat category</h2>
                  <p className="text-sm text-gray-500">Choose a category above to see the leaderboard</p>
                </>
              )}
            </div>
          ) : loadingLeaders ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />)}
            </div>
          ) : leaders.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
              <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h2 className="text-lg font-medium text-gray-700 mb-1">No stats recorded yet</h2>
              <p className="text-sm text-gray-500 mb-3">
                Enter player stats after games to see leaders here.
              </p>
              <p className="text-xs text-gray-400">
                Go to <span className="font-medium text-gray-600">Schedule</span> tab, open a game, and select <span className="font-medium text-gray-600">Player Stats</span> to enter data.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Player</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Team</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">GP</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {leaders.map((l) => (
                      <tr key={l.rosterId} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-bold text-gray-400">{l.rank}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {l.jerseyNumber && (
                              <span className="text-xs font-bold text-gray-400">#{l.jerseyNumber}</span>
                            )}
                            <span className="text-sm font-medium text-gray-900">{l.playerName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{l.team.name}</td>
                        <td className="px-4 py-3 text-sm text-center font-semibold text-gray-900">{l.total}</td>
                        <td className="px-4 py-3 text-sm text-center text-gray-500 hidden sm:table-cell">{l.gamesPlayed}</td>
                        <td className="px-4 py-3 text-sm text-center text-gray-700">{l.average}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Config ─────────────────────────────────────────────────── */}
      {view === 'config' && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="w-full sm:w-48">
              <FloatingDropdown id="config-sport" label="Sport" value={configSportId} onChange={setConfigSportId} options={configSportOptions} />
            </div>
          </div>

          {!configSportId ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
              <Settings className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h2 className="text-lg font-medium text-gray-700 mb-1">Select a sport</h2>
              <p className="text-sm text-gray-500">Choose a sport to configure its stat categories</p>
            </div>
          ) : loadingConfigs ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Existing configs */}
              {configs.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-50">
                  {configs.map((cfg) => (
                    <div key={cfg.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">{cfg.label}</div>
                        <div className="text-xs text-gray-400">Key: {cfg.statKey}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveConfig(cfg.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new config */}
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Add Stat Category</h4>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <FloatingInput id="stat-key" label="Key (e.g. points)" value={newStatKey} onChange={(e) => setNewStatKey(e.target.value)} />
                  </div>
                  <div className="flex-1">
                    <FloatingInput id="stat-label" label="Display Label (e.g. Points)" value={newStatLabel} onChange={(e) => setNewStatLabel(e.target.value)} />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddConfig}
                    disabled={!newStatKey.trim() || !newStatLabel.trim() || savingConfig}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    {savingConfig ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>

              {configs.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
                  <Settings className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-1">No stat categories yet</p>
                  <p className="text-xs text-gray-400">
                    Add categories above (e.g. Points, Assists, Rebounds for basketball) to start tracking player stats per game.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
