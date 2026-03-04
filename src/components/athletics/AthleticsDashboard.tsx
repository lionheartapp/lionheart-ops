'use client'

import { useQuery } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'
import { Trophy, Users, CalendarDays, Dribbble, ArrowRight, Clock, MapPin, ChevronRight, Plus } from 'lucide-react'
import type { AthleticsTab } from '@/components/Sidebar'

interface AthleticsDashboardProps {
  activeCampusId: string | null
  canWrite: boolean
  onTabChange: (tab: AthleticsTab) => void
}

interface DashboardData {
  summary: {
    totalTeams: number
    totalSports: number
    activeSports: number
    gamesThisWeek: number
    practicesThisWeek: number
    overallRecord: { wins: number; losses: number; ties: number }
  }
  upcomingGames: Game[]
  recentResults: Game[]
  standings: Standing[]
  weekSchedule: {
    games: Game[]
    practices: Practice[]
    weekStart: string
    weekEnd: string
  }
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
  athleticTeam: {
    id: string
    name: string
    level: string
    sport: { name: string; color: string }
  }
}

interface Practice {
  id: string
  startTime: string
  endTime: string
  location: string | null
  athleticTeam: {
    id: string
    name: string
    sport: { name: string }
  }
}

interface Standing {
  teamId: string
  teamName: string
  level: string
  sport: { id: string; name: string; color: string }
  wins: number
  losses: number
  ties: number
  gamesPlayed: number
  winPct: number
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatRelativeDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays} days ago`
}

function getResultBadge(game: Game) {
  if (game.homeScore == null || game.awayScore == null) return null
  const isHome = game.homeAway === 'HOME'
  const homeWon = game.homeScore > game.awayScore
  const tied = game.homeScore === game.awayScore

  if (tied) return { label: 'T', className: 'bg-yellow-100 text-yellow-700' }
  if ((isHome && homeWon) || (!isHome && !homeWon)) return { label: 'W', className: 'bg-green-100 text-green-700' }
  return { label: 'L', className: 'bg-red-100 text-red-700' }
}

function getScoreDisplay(game: Game) {
  if (game.homeScore == null || game.awayScore == null) return null
  const isHome = game.homeAway === 'HOME'
  const ourScore = isHome ? game.homeScore : game.awayScore
  const theirScore = isHome ? game.awayScore : game.homeScore
  return `${ourScore}-${theirScore}`
}

export default function AthleticsDashboard({ canWrite, onTabChange }: AthleticsDashboardProps) {
  const { data, isLoading } = useQuery(queryOptions.athleticsDashboard())

  if (isLoading) return <DashboardSkeleton />

  const dashboard = data as DashboardData | undefined
  if (!dashboard) return <DashboardSkeleton />

  const { summary, upcomingGames, recentResults, standings, weekSchedule } = dashboard
  const hasData = summary.totalTeams > 0 || summary.totalSports > 0

  if (!hasData) return <EmptyState onTabChange={onTabChange} />

  // Build week day list
  const weekDays = getWeekDays(weekSchedule.weekStart)

  return (
    <div className="space-y-6">
      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Teams"
          value={summary.totalTeams}
        />
        <StatCard
          icon={CalendarDays}
          label="Games This Week"
          value={summary.gamesThisWeek}
        />
        <div className="bg-gradient-to-br from-primary-50 to-primary-100 border border-primary-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-primary-800">
            {summary.overallRecord.wins}-{summary.overallRecord.losses}
            {summary.overallRecord.ties > 0 ? `-${summary.overallRecord.ties}` : ''}
          </div>
          <div className="text-xs text-primary-600 mt-1">Overall Record</div>
        </div>
        <StatCard
          icon={Dribbble}
          label="Active Sports"
          value={summary.activeSports}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Games */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Upcoming Games</h2>
              <button
                onClick={() => onTabChange('schedule')}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {upcomingGames.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No upcoming games scheduled</p>
            ) : (
              <div className="space-y-3">
                {upcomingGames.map((game) => (
                  <div key={game.id} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                    <div
                      className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: game.athleticTeam.sport.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {game.athleticTeam.name} {game.homeAway === 'AWAY' ? '@ ' : 'vs '}{game.opponentName}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(game.startTime)} &middot; {formatTime(game.startTime)}
                        </span>
                        {game.venue && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {game.homeAway === 'HOME' ? 'Home' : 'Away'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Results */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Results</h2>
            {recentResults.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No completed games yet</p>
            ) : (
              <div className="space-y-3">
                {recentResults.map((game) => {
                  const badge = getResultBadge(game)
                  const score = getScoreDisplay(game)
                  return (
                    <div key={game.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: game.athleticTeam.sport.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {game.athleticTeam.name} {game.homeAway === 'AWAY' ? '@ ' : 'vs '}{game.opponentName}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {formatRelativeDate(game.startTime)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {score && <span className="text-sm font-semibold text-gray-800">{score}</span>}
                        {badge && (
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${badge.className}`}>
                            {badge.label}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Standings */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Standings</h2>
              <button
                onClick={() => onTabChange('stats')}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {standings.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No standings data yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                      <th className="text-left pb-2 font-medium">#</th>
                      <th className="text-left pb-2 font-medium">Team</th>
                      <th className="text-center pb-2 font-medium">Record</th>
                      <th className="text-right pb-2 font-medium">Win%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s, i) => (
                      <tr key={s.teamId} className="border-b border-gray-50 last:border-0">
                        <td className="py-1.5 text-gray-400 text-xs">{i + 1}</td>
                        <td className="py-1.5">
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: s.sport.color }}
                            />
                            <span className="text-gray-800 truncate text-xs">{s.teamName}</span>
                          </div>
                        </td>
                        <td className="py-1.5 text-center text-xs text-gray-600">
                          {s.wins}-{s.losses}{s.ties > 0 ? `-${s.ties}` : ''}
                        </td>
                        <td className="py-1.5 text-right text-xs font-medium text-gray-700">
                          {s.gamesPlayed > 0 ? `.${Math.round(s.winPct * 1000).toString().padStart(3, '0')}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* This Week */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              This Week
              <span className="text-xs font-normal text-gray-500 ml-2">
                {formatWeekRange(weekSchedule.weekStart, weekSchedule.weekEnd)}
              </span>
            </h2>
            <div className="space-y-1">
              {weekDays.map((day) => {
                const dayGames = weekSchedule.games.filter((g) => isSameDay(g.startTime, day.date))
                const dayPractices = weekSchedule.practices.filter((p) => isSameDay(p.startTime, day.date))
                const isToday = isSameDay(new Date().toISOString(), day.date)
                const hasEvents = dayGames.length > 0 || dayPractices.length > 0

                return (
                  <div
                    key={day.label}
                    className={`flex items-start gap-2 py-1.5 px-2 rounded-md ${isToday ? 'bg-blue-50' : ''}`}
                  >
                    <span className={`text-xs font-medium w-8 flex-shrink-0 pt-0.5 ${isToday ? 'text-blue-700' : 'text-gray-500'}`}>
                      {day.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      {!hasEvents && <span className="text-xs text-gray-400">&mdash;</span>}
                      {dayGames.map((g) => (
                        <div key={g.id} className="text-xs text-gray-700 truncate">
                          <span className="font-medium">{formatTime(g.startTime)}</span>
                          {' '}{g.homeAway === 'AWAY' ? '@ ' : 'vs '}{g.opponentName}
                          <span className="inline-block w-1.5 h-1.5 rounded-full ml-1 align-middle"
                            style={{ backgroundColor: g.athleticTeam?.sport?.color || '#6b7280' }} />
                        </div>
                      ))}
                      {dayPractices.map((p) => (
                        <div key={p.id} className="text-xs text-gray-500 truncate">
                          <span className="font-medium">{formatTime(p.startTime)}</span>
                          {' '}{p.athleticTeam?.sport?.name} Practice
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick Actions */}
          {canWrite && (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Quick Actions</h2>
              <div className="space-y-2">
                <QuickAction label="Schedule Game" onClick={() => onTabChange('schedule')} />
                <QuickAction label="Manage Rosters" onClick={() => onTabChange('roster')} />
                <QuickAction label="Add Sport" onClick={() => onTabChange('sports')} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
      <Icon className="w-5 h-5 text-gray-400 mx-auto mb-1" />
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  )
}

function QuickAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
    >
      <span className="flex items-center gap-2">
        <Plus className="w-3.5 h-3.5 text-gray-400" />
        {label}
      </span>
      <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
    </button>
  )
}

function EmptyState({ onTabChange }: { onTabChange: (tab: AthleticsTab) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mb-4">
        <Trophy className="w-8 h-8 text-primary-500" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Welcome to Athletics</h2>
      <p className="text-sm text-gray-500 mb-6 text-center max-w-sm">
        Get started by adding your first sport, then create teams and schedules.
      </p>
      <button
        onClick={() => onTabChange('sports')}
        className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
      >
        Add First Sport
      </button>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-xl h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-100 rounded-xl h-64" />
          <div className="bg-gray-100 rounded-xl h-48" />
        </div>
        <div className="space-y-6">
          <div className="bg-gray-100 rounded-xl h-56" />
          <div className="bg-gray-100 rounded-xl h-48" />
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────

function getWeekDays(weekStartIso: string) {
  const start = new Date(weekStartIso)
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return labels.map((label, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return { label, date: d.toISOString() }
  })
}

function isSameDay(iso1: string, iso2: string) {
  const a = new Date(iso1)
  const b = new Date(iso2)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatWeekRange(startIso: string, endIso: string) {
  const s = new Date(startIso)
  const e = new Date(endIso)
  const sMonth = s.toLocaleDateString('en-US', { month: 'short' })
  const eMonth = e.toLocaleDateString('en-US', { month: 'short' })
  if (sMonth === eMonth) {
    return `${sMonth} ${s.getDate()}\u2013${e.getDate()}`
  }
  return `${sMonth} ${s.getDate()} \u2013 ${eMonth} ${e.getDate()}`
}
