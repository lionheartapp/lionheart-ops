'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'
import { BarChart3, Medal, Plus, Trash2, Settings, Printer, Download } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import AthleticsTableSkeleton from '@/components/athletics/AthleticsTableSkeleton'
import { FloatingInput, FloatingDropdown, type DropdownOption } from '@/components/ui/FloatingInput'
import { GlassSportTile } from '@/components/athletics/SportIcon'
import { EmptyState } from '@/components/ui/EmptyState'

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
  // ─── Cached Data ──────────────────────────────────────────────────

  const { data: sportsData, isLoading: sportsLoading } = useQuery(queryOptions.athleticsSports())
  const sports = useMemo(() => (sportsData ?? []) as Sport[], [sportsData])

  const { data: seasonsData, isLoading: seasonsLoading } = useQuery(queryOptions.athleticsSeasons())
  const seasons = useMemo(() => (seasonsData ?? []) as Season[], [seasonsData])

  const loading = sportsLoading || seasonsLoading

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
  const selectedConfigSport = useMemo(
    () => sports.find((sport) => sport.id === configSportId),
    [sports, configSportId],
  )
  const statExamples = getStatExamples(selectedConfigSport?.name)

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

  // ─── Export handlers ──────────────────────────────────────────────

  const handleExportCSV = () => {
    if (standings.length === 0) return
    const headers = ['Rank', 'Team', 'Sport', 'Season', 'W', 'L', 'T', 'Win%', 'GP', 'Roster']
    const rows = standings.map((s, i) => [
      i + 1,
      s.teamName,
      s.sport.name,
      s.season.name,
      s.wins,
      s.losses,
      s.ties,
      `${(s.winPct * 100).toFixed(1)}%`,
      s.gamesPlayed,
      s.rosterCount,
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `athletics-standings-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handlePrintReport = () => {
    const sportLabel = selectedSportId ? sports.find((s) => s.id === selectedSportId)?.name || 'All Sports' : 'All Sports'
    const seasonLabel = selectedSeasonId ? seasons.find((s) => s.id === selectedSeasonId)?.name || 'All Seasons' : 'All Seasons'
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

    const standingsRows = standings.map((s, i) => `
      <tr>
        <td style="padding:8px 12px;text-align:center;font-weight:bold;color:#888;">${i + 1}</td>
        <td style="padding:8px 12px;font-weight:500;">${s.teamName} <span style="color:#999;font-size:12px;">(${s.sport.name})</span></td>
        <td style="padding:8px 12px;text-align:center;font-weight:600;color:#16a34a;">${s.wins}</td>
        <td style="padding:8px 12px;text-align:center;font-weight:600;color:#ef4444;">${s.losses}</td>
        <td style="padding:8px 12px;text-align:center;font-weight:600;color:#6b7280;">${s.ties}</td>
        <td style="padding:8px 12px;text-align:center;">${(s.winPct * 100).toFixed(0)}%</td>
        <td style="padding:8px 12px;text-align:center;">${s.gamesPlayed}</td>
        <td style="padding:8px 12px;text-align:center;">${s.rosterCount}</td>
      </tr>
    `).join('')

    const leadersSection = view === 'leaders' && leaders.length > 0
      ? `
        <h2 style="margin-top:32px;font-size:18px;font-weight:600;">Stat Leaders — ${statConfigs.find((c) => c.statKey === selectedStatKey)?.label || selectedStatKey}</h2>
        <table style="width:100%;border-collapse:collapse;margin-top:12px;">
          <thead>
            <tr style="border-bottom:2px solid #e5e7eb;">
              <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;">Rank</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;">Player</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;">Team</th>
              <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#6b7280;">Total</th>
              <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#6b7280;">GP</th>
              <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#6b7280;">Avg</th>
            </tr>
          </thead>
          <tbody>
            ${leaders.map((l) => `
              <tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:8px 12px;text-align:center;font-weight:bold;color:#888;">${l.rank}</td>
                <td style="padding:8px 12px;font-weight:500;">${l.jerseyNumber ? `#${l.jerseyNumber} ` : ''}${l.playerName}</td>
                <td style="padding:8px 12px;color:#6b7280;">${l.team.name}</td>
                <td style="padding:8px 12px;text-align:center;font-weight:600;">${l.total}</td>
                <td style="padding:8px 12px;text-align:center;color:#6b7280;">${l.gamesPlayed}</td>
                <td style="padding:8px 12px;text-align:center;">${l.average}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `
      : ''

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Athletics Board Report</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; color: #1e293b; }
          @media print { body { margin: 20px; } }
          table { border-collapse: collapse; width: 100%; }
          thead tr { border-bottom: 2px solid #e5e7eb; }
          tbody tr { border-bottom: 1px solid #f3f4f6; }
          tbody tr:hover { background: #f9fafb; }
        </style>
      </head>
      <body>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:24px;">
          <h1 style="font-size:24px;font-weight:700;margin:0;">Athletics Board Report</h1>
          <span style="color:#6b7280;font-size:14px;">${date}</span>
        </div>
        <p style="color:#6b7280;font-size:14px;margin-bottom:24px;">${sportLabel} &middot; ${seasonLabel}</p>

        ${standings.length > 0 ? `
          <h2 style="font-size:18px;font-weight:600;margin-bottom:12px;">Team Standings</h2>
          <table>
            <thead>
              <tr>
                <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#6b7280;">Rank</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6b7280;">Team</th>
                <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#6b7280;">W</th>
                <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#6b7280;">L</th>
                <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#6b7280;">T</th>
                <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#6b7280;">Win%</th>
                <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#6b7280;">GP</th>
                <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#6b7280;">Roster</th>
              </tr>
            </thead>
            <tbody>${standingsRows}</tbody>
          </table>
        ` : '<p style="color:#6b7280;">No standings data available.</p>'}

        ${leadersSection}

        <div style="margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;">
          Generated by Lionheart Athletics &middot; ${date}
        </div>
      </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.onload = () => printWindow.print()
    }
  }

  // ─── Render ───────────────────────────────────────────────────────

  if (loading) {
    return <AthleticsTableSkeleton columns={4} rows={4} />
  }

  return (
    <div>
      {/* View tabs */}
      <div className="inline-flex gap-1 rounded-full bg-slate-100 p-1 mb-5">
        {([
          { key: 'standings' as const, label: 'Standings' },
          { key: 'leaders' as const, label: 'Stat Leaders' },
          ...(canWrite ? [{ key: 'config' as const, label: 'Stat Config' }] : []),
        ]).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={`relative px-5 py-2 rounded-full text-sm font-medium transition-colors duration-200 cursor-pointer ${
              view === key
                ? 'text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {view === key && (
              <motion.div
                layoutId="athleticsStatsPill"
                className="absolute inset-0 rounded-full bg-slate-900"
                transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
              />
            )}
            <span className="relative z-10">{label}</span>
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
            {standings.length > 0 && (
              <div className="flex gap-2 sm:ml-auto">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-all duration-200 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-all duration-200 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Print Report
                </button>
              </div>
            )}
          </div>

          {loadingStandings ? (
            <AthleticsTableSkeleton columns={6} rows={4} showToolbar={false} />
          ) : standings.length === 0 ? (
            <div className="ui-glass">
              <EmptyState
                icon={Medal}
                title="No standings yet"
                body="Standings update when games are marked final with scores recorded."
              />
            </div>
          ) : (
            <div className="ui-glass-table">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-stone-100">
                  <thead>
                    <tr className="bg-stone-50/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider w-10">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Team</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">W</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">L</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">T</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider hidden sm:table-cell">Win%</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider hidden sm:table-cell">GP</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider hidden md:table-cell">Roster</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {standings.map((s, i) => (
                      <tr key={s.teamId} className="hover:bg-stone-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-bold text-stone-400">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <GlassSportTile sport={s.sport.name} color={s.sport.color} size="sm" />
                            <span className="text-sm font-medium text-slate-900">{s.teamName}</span>
                            <span className="text-[10px] text-stone-400">{s.sport.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-center font-semibold text-green-600">{s.wins}</td>
                        <td className="px-4 py-3 text-sm text-center font-semibold text-red-500">{s.losses}</td>
                        <td className="px-4 py-3 text-sm text-center font-semibold text-stone-500">{s.ties}</td>
                        <td className="px-4 py-3 text-sm text-center text-stone-700 hidden sm:table-cell">{(s.winPct * 100).toFixed(0)}%</td>
                        <td className="px-4 py-3 text-sm text-center text-stone-500 hidden sm:table-cell">{s.gamesPlayed}</td>
                        <td className="px-4 py-3 text-sm text-center text-stone-500 hidden md:table-cell">{s.rosterCount}</td>
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
            <div className="ui-glass">
              <EmptyState
                icon={BarChart3}
                title="Select a sport"
                body="Choose a sport to see its stat categories and leaders."
              />
            </div>
          ) : !selectedStatKey ? (
            <div className="ui-glass">
              {statConfigs.length === 0 ? (
                <EmptyState
                  icon={Settings}
                  title="No stat categories"
                  body="Set up categories for this sport, then track player stats after each game."
                  primaryAction={{
                    label: 'Configure stats',
                    onClick: () => { setView('config'); setConfigSportId(selectedSportId) },
                  }}
                />
              ) : (
                <EmptyState
                  icon={BarChart3}
                  title="Select a stat category"
                  body="Choose a category above to see the leaderboard."
                />
              )}
            </div>
          ) : loadingLeaders ? (
            <AthleticsTableSkeleton columns={4} rows={4} showToolbar={false} />
          ) : leaders.length === 0 ? (
            <div className="ui-glass">
              <EmptyState
                icon={BarChart3}
                title="No stats recorded"
                body="Enter player stats from a game to build this leaderboard."
              />
            </div>
          ) : (
            <div className="ui-glass-table">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-stone-100">
                  <thead>
                    <tr className="bg-stone-50/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider w-10">Rank</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Player</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider hidden sm:table-cell">Team</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider hidden sm:table-cell">GP</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">Avg</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {leaders.map((l) => (
                      <tr key={l.rosterId} className="hover:bg-stone-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-bold text-stone-400">{l.rank}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {l.jerseyNumber && (
                              <span className="text-xs font-bold text-stone-400">#{l.jerseyNumber}</span>
                            )}
                            <span className="text-sm font-medium text-slate-900">{l.playerName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-stone-600 hidden sm:table-cell">{l.team.name}</td>
                        <td className="px-4 py-3 text-sm text-center font-semibold text-slate-900">{l.total}</td>
                        <td className="px-4 py-3 text-sm text-center text-stone-500 hidden sm:table-cell">{l.gamesPlayed}</td>
                        <td className="px-4 py-3 text-sm text-center text-stone-700">{l.average}</td>
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
            <div className="ui-glass">
              <EmptyState
                icon={Settings}
                title="Select a sport"
                body="Choose a sport to configure the stat categories coaches will track."
              />
            </div>
          ) : loadingConfigs ? (
            <AthleticsTableSkeleton columns={3} rows={3} showToolbar={false} />
          ) : (
            <div className="space-y-4">
              {/* Existing configs */}
              {configs.length > 0 && (
                <div className="ui-glass divide-y divide-stone-50">
                  {configs.map((cfg) => (
                    <div key={cfg.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900">{cfg.label}</div>
                        <div className="text-xs text-stone-400">Key: {cfg.statKey}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveConfig(cfg.id)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new config */}
              <div className="ui-glass p-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Add Stat Category</h4>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <FloatingInput id="stat-key" label={`Key (e.g. ${statExamples.key})`} value={newStatKey} onChange={(e) => setNewStatKey(e.target.value)} />
                  </div>
                  <div className="flex-1">
                    <FloatingInput id="stat-label" label={`Display Label (e.g. ${statExamples.label})`} value={newStatLabel} onChange={(e) => setNewStatLabel(e.target.value)} />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddConfig}
                    disabled={!newStatKey.trim() || !newStatLabel.trim() || savingConfig}
                    className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    {savingConfig ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </div>

              {configs.length === 0 && (
                <div className="rounded-xl border border-dashed border-stone-200">
                  <EmptyState
                    icon={BarChart3}
                    title="No stat categories yet"
                    body={`Add categories like ${statExamples.label}, then enter player stats after each game.`}
                    className="py-8"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function getStatExamples(sportName?: string) {
  const sport = sportName?.toLowerCase() ?? ''

  if (sport.includes('baseball') || sport.includes('softball')) {
    return { key: 'rbi', label: 'RBI' }
  }

  if (sport.includes('soccer')) {
    return { key: 'goals', label: 'Goals' }
  }

  if (sport.includes('volleyball')) {
    return { key: 'kills', label: 'Kills' }
  }

  if (sport.includes('track') || sport.includes('cross country')) {
    return { key: 'time', label: 'Time' }
  }

  return { key: 'points', label: 'Points' }
}
