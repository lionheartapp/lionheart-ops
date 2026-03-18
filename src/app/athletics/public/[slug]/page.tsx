'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { Trophy, CalendarDays, MapPin, Clock, Link2 } from 'lucide-react'

interface Sport {
  id: string
  name: string
  color: string
  abbreviation: string | null
}

interface Team {
  id: string
  name: string
  level: string
  sportId: string
  sport: { name: string; color: string }
}

interface Game {
  id: string
  opponentName: string
  homeAway: string
  startTime: string
  endTime: string
  venue: string | null
  homeScore: number | null
  awayScore: number | null
  isFinal: boolean
  athleticTeamId: string
  athleticTeam: { name: string; level: string; sport: { name: string; color: string } }
}

interface Standing {
  teamName: string
  level: string
  wins: number
  losses: number
  ties: number
}

interface CalendarTeam {
  teamId: string
  teamName: string
  calendarId: string
  sportName: string
}

interface PublicData {
  organization: { id: string; name: string; slug: string; logoUrl: string | null; theme: string | null }
  sports: Sport[]
  teams: Team[]
  upcoming: Game[]
  recent: Game[]
  standingsBySport: Record<string, Standing[]>
  calendarTeams: CalendarTeam[]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function getResultBadge(game: Game): { label: string; className: string } | null {
  if (game.homeScore == null || game.awayScore == null || !game.isFinal) return null
  const isHome = game.homeAway === 'HOME'
  const homeWon = game.homeScore > game.awayScore
  const tied = game.homeScore === game.awayScore
  if (tied) return { label: `T ${game.homeScore}-${game.awayScore}`, className: 'bg-slate-100 text-slate-700' }
  const won = (isHome && homeWon) || (!isHome && !homeWon)
  return {
    label: `${won ? 'W' : 'L'} ${game.homeScore}-${game.awayScore}`,
    className: won ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
  }
}

export default function PublicAthleticsPage() {
  const params = useParams()
  const slug = params.slug as string

  const [data, setData] = useState<PublicData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedSportId, setSelectedSportId] = useState<string>('all')
  const [copiedCalendarId, setCopiedCalendarId] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/public/athletics/${slug}`)
        const json = await res.json()
        if (json.ok) {
          setData(json.data)
        } else {
          setError(json.error?.message || 'Not found')
        }
      } catch {
        setError('Failed to load schedule')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [slug])

  const filteredUpcoming = useMemo(() => {
    if (!data) return []
    if (selectedSportId === 'all') return data.upcoming.slice(0, 20)
    const sportTeamIds = data.teams.filter((t) => t.sportId === selectedSportId).map((t) => t.id)
    return data.upcoming.filter((g) => sportTeamIds.includes(g.athleticTeamId)).slice(0, 20)
  }, [data, selectedSportId])

  const filteredRecent = useMemo(() => {
    if (!data) return []
    if (selectedSportId === 'all') return data.recent
    const sportTeamIds = data.teams.filter((t) => t.sportId === selectedSportId).map((t) => t.id)
    return data.recent.filter((g) => sportTeamIds.includes(g.athleticTeamId))
  }, [data, selectedSportId])

  const currentStandings = useMemo(() => {
    if (!data) return null
    if (selectedSportId === 'all') return null
    return data.standingsBySport[selectedSportId] || null
  }, [data, selectedSportId])

  const handleCopyCalendarLink = (calendarId: string) => {
    const url = `${window.location.origin}/api/calendars/${calendarId}/feed`
    navigator.clipboard.writeText(url)
    setCopiedCalendarId(calendarId)
    setTimeout(() => setCopiedCalendarId(null), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-slate-200 rounded-full" />
          <div className="w-40 h-5 bg-slate-200 rounded" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-slate-700 mb-2">Schedule Not Found</h1>
          <p className="text-sm text-slate-500">{error || 'This athletics schedule could not be found.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-center gap-4">
            {data.organization.logoUrl && (
              <img
                src={data.organization.logoUrl}
                alt={data.organization.name}
                className="w-12 h-12 rounded-xl object-cover"
              />
            )}
            <div>
              <h1 className="text-xl font-bold text-slate-900">{data.organization.name}</h1>
              <p className="text-sm text-slate-500">Athletics Schedule</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Sport filter tabs */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedSportId('all')}
            className={`flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              selectedSportId === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Sports
          </button>
          {data.sports.map((sport) => (
            <button
              key={sport.id}
              type="button"
              onClick={() => setSelectedSportId(sport.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                selectedSportId === sport.id
                  ? 'text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
              style={selectedSportId === sport.id ? { backgroundColor: sport.color } : undefined}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sport.color }} />
              {sport.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming Games */}
          <div className="lg:col-span-2">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
              <CalendarDays className="w-4 h-4 inline mr-1.5" />
              Upcoming Games
            </h2>

            {filteredUpcoming.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
                <p className="text-sm text-slate-500">No upcoming games scheduled</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredUpcoming.map((game) => (
                  <div
                    key={game.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: game.athleticTeam.sport.color }} />
                          <span className="text-sm font-semibold text-slate-900">
                            {game.athleticTeam.name}
                          </span>
                          <span className="text-sm text-slate-500">
                            {game.homeAway === 'AWAY' ? '@' : 'vs'} {game.opponentName}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            {formatDate(game.startTime)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(game.startTime)}
                          </span>
                          {game.venue && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {game.venue}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-primary-50 text-primary-700 uppercase flex-shrink-0">
                        {game.homeAway}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recent Results */}
            {filteredRecent.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  <Trophy className="w-4 h-4 inline mr-1.5" />
                  Recent Results
                </h2>
                <div className="space-y-2">
                  {filteredRecent.map((game) => {
                    const result = getResultBadge(game)
                    return (
                      <div
                        key={game.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: game.athleticTeam.sport.color }} />
                            <span className="text-sm font-medium text-slate-900 truncate">
                              {game.athleticTeam.name}
                            </span>
                            <span className="text-sm text-slate-500">
                              {game.homeAway === 'AWAY' ? '@' : 'vs'} {game.opponentName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-slate-400">{formatDate(game.startTime)}</span>
                            {result && (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${result.className}`}>
                                {result.label}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Standings */}
            {currentStandings && currentStandings.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Standings</h2>
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Team</th>
                        <th className="px-2 py-2 text-center text-xs font-semibold text-slate-500">W</th>
                        <th className="px-2 py-2 text-center text-xs font-semibold text-slate-500">L</th>
                        <th className="px-2 py-2 text-center text-xs font-semibold text-slate-500">T</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {currentStandings.map((s, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-sm font-medium text-slate-900">{s.teamName}</td>
                          <td className="px-2 py-2 text-sm text-center text-green-600 font-semibold">{s.wins}</td>
                          <td className="px-2 py-2 text-sm text-center text-red-500 font-semibold">{s.losses}</td>
                          <td className="px-2 py-2 text-sm text-center text-slate-500">{s.ties}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* iCal Subscribe */}
            {data.calendarTeams.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  <Link2 className="w-4 h-4 inline mr-1.5" />
                  Subscribe to Calendar
                </h2>
                <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-50">
                  {data.calendarTeams
                    .filter((ct) => selectedSportId === 'all' || data.teams.find((t) => t.id === ct.teamId)?.sportId === selectedSportId)
                    .map((ct) => (
                      <div key={ct.calendarId} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <div className="text-sm font-medium text-slate-900">{ct.teamName}</div>
                          <div className="text-xs text-slate-400">{ct.sportName}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyCalendarLink(ct.calendarId)}
                          className="text-xs font-medium text-primary-600 hover:text-primary-700 transition"
                        >
                          {copiedCalendarId === ct.calendarId ? 'Copied!' : 'Copy Link'}
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 mt-12 py-6 text-center text-xs text-slate-400">
        {data.organization.name} Athletics
      </footer>
    </div>
  )
}
