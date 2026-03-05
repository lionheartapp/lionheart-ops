'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { queryOptions } from '@/lib/queries'
import {
  Trophy, Users, CalendarDays, Dribbble, ArrowRight, Clock, MapPin,
  ChevronRight, CalendarPlus, ClipboardList, Medal, type LucideIcon,
} from 'lucide-react'
import AnimatedCounter from '@/components/motion/AnimatedCounter'
import { staggerContainer, cardEntrance, listItem } from '@/lib/animations'
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

  if (tied) return { label: 'T', className: 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200' }
  if ((isHome && homeWon) || (!isHome && !homeWon)) return { label: 'W', className: 'bg-green-100 text-green-700 ring-1 ring-green-200' }
  return { label: 'L', className: 'bg-red-100 text-red-700 ring-1 ring-red-200' }
}

function getScoreDisplay(game: Game) {
  if (game.homeScore == null || game.awayScore == null) return null
  const isHome = game.homeAway === 'HOME'
  const ourScore = isHome ? game.homeScore : game.awayScore
  const theirScore = isHome ? game.awayScore : game.homeScore
  return `${ourScore}-${theirScore}`
}

// ── Stat card color configs ──────────────────────────────────────────
const STAT_CONFIGS = {
  teams: {
    icon: Users,
    gradient: 'from-blue-50 to-indigo-50',
    border: 'border-blue-100',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    valueColor: 'text-blue-900',
    labelColor: 'text-blue-600',
  },
  games: {
    icon: CalendarDays,
    gradient: 'from-amber-50 to-orange-50',
    border: 'border-amber-100',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    valueColor: 'text-amber-900',
    labelColor: 'text-amber-600',
  },
  record: {
    gradient: 'from-primary-50 via-primary-100 to-indigo-100',
    border: 'border-primary-200',
    iconBg: 'bg-primary-100',
    iconColor: 'text-primary-600',
    valueColor: 'text-primary-800',
    labelColor: 'text-primary-600',
  },
  sports: {
    icon: Dribbble,
    gradient: 'from-emerald-50 to-teal-50',
    border: 'border-emerald-100',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    valueColor: 'text-emerald-900',
    labelColor: 'text-emerald-600',
  },
} as const

export default function AthleticsDashboard({ activeCampusId, canWrite, onTabChange }: AthleticsDashboardProps) {
  const { data, isLoading } = useQuery(queryOptions.athleticsDashboard(activeCampusId))

  if (isLoading) return <DashboardSkeleton />

  const dashboard = data as DashboardData | undefined
  if (!dashboard) return <DashboardSkeleton />

  const { summary, upcomingGames, recentResults, standings, weekSchedule } = dashboard
  const hasData = summary.totalTeams > 0 || summary.totalSports > 0

  if (!hasData) return <EmptyState onTabChange={onTabChange} />

  // Build week day list
  const weekDays = getWeekDays(weekSchedule.weekStart)

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer(0.08, 0.05)}
    >
      {/* ── Summary Stats Row ── */}
      <motion.div variants={staggerContainer(0.06)} initial="hidden" animate="visible" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <motion.div variants={cardEntrance}>
          <StatCard config={STAT_CONFIGS.teams} label="Teams" value={summary.totalTeams} />
        </motion.div>
        <motion.div variants={cardEntrance}>
          <StatCard config={STAT_CONFIGS.games} label="Games This Week" value={summary.gamesThisWeek} />
        </motion.div>
        <motion.div variants={cardEntrance}>
          <div className={`bg-gradient-to-br ${STAT_CONFIGS.record.gradient} border ${STAT_CONFIGS.record.border} rounded-xl p-4 text-center hover:shadow-md transition-shadow duration-200 group`}>
            <div className={`w-9 h-9 ${STAT_CONFIGS.record.iconBg} rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform duration-200`}>
              <Trophy className={`w-4.5 h-4.5 ${STAT_CONFIGS.record.iconColor}`} />
            </div>
            <div className={`text-2xl font-bold ${STAT_CONFIGS.record.valueColor} tabular-nums`}>
              <AnimatedCounter value={summary.overallRecord.wins} duration={0.6} />
              <span className="text-primary-400 mx-0.5">-</span>
              <AnimatedCounter value={summary.overallRecord.losses} duration={0.6} />
              {summary.overallRecord.ties > 0 && (
                <><span className="text-primary-400 mx-0.5">-</span><AnimatedCounter value={summary.overallRecord.ties} duration={0.6} /></>
              )}
            </div>
            <div className={`text-xs font-medium ${STAT_CONFIGS.record.labelColor} mt-1`}>Overall Record</div>
          </div>
        </motion.div>
        <motion.div variants={cardEntrance}>
          <StatCard config={STAT_CONFIGS.sports} label="Active Sports" value={summary.activeSports} />
        </motion.div>
      </motion.div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Games */}
          <motion.div variants={cardEntrance} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between px-6 pt-5 pb-4">
              <h2 className="text-base font-semibold text-gray-900">Upcoming Games</h2>
              <button
                onClick={() => onTabChange('schedule')}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {upcomingGames.length === 0 ? (
              <div className="px-6 pb-6">
                <div className="rounded-lg bg-gray-50 border border-dashed border-gray-200 py-8 text-center">
                  <CalendarDays className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No upcoming games scheduled</p>
                </div>
              </div>
            ) : (
              <div className="px-6 pb-2">
                {upcomingGames.map((game, i) => (
                  <motion.div
                    key={game.id}
                    variants={listItem}
                    className="group flex items-center gap-3 py-3 border-b border-gray-100 last:border-0 rounded-lg hover:bg-gray-50/50 -mx-2 px-2 transition-colors duration-150"
                  >
                    {/* Sport color accent bar */}
                    <div
                      className="w-1 h-10 rounded-full flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
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
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                          game.homeAway === 'HOME'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          <MapPin className="w-2.5 h-2.5" />
                          {game.homeAway === 'HOME' ? 'Home' : 'Away'}
                        </span>
                      </div>
                    </div>
                    {/* Sport color dot */}
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: game.athleticTeam.sport.color }}
                      title={game.athleticTeam.sport.name}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Recent Results */}
          <motion.div variants={cardEntrance} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between px-6 pt-5 pb-4">
              <h2 className="text-base font-semibold text-gray-900">Recent Results</h2>
            </div>
            {recentResults.length === 0 ? (
              <div className="px-6 pb-6">
                <div className="rounded-lg bg-gray-50 border border-dashed border-gray-200 py-8 text-center">
                  <Trophy className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No completed games yet</p>
                </div>
              </div>
            ) : (
              <div className="px-6 pb-2">
                {recentResults.map((game) => {
                  const badge = getResultBadge(game)
                  const score = getScoreDisplay(game)
                  return (
                    <div key={game.id} className="group flex items-center gap-3 py-3 border-b border-gray-100 last:border-0 rounded-lg hover:bg-gray-50/50 -mx-2 px-2 transition-colors duration-150">
                      <div
                        className="w-1 h-10 rounded-full flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
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
                        {score && <span className="text-sm font-bold text-gray-800 tabular-nums">{score}</span>}
                        {badge && (
                          <span className={`text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-md ${badge.className}`}>
                            {badge.label}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Standings */}
          <motion.div variants={cardEntrance} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center justify-between px-6 pt-5 pb-4">
              <h2 className="text-base font-semibold text-gray-900">Standings</h2>
              <button
                onClick={() => onTabChange('stats')}
                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {standings.length === 0 ? (
              <div className="px-6 pb-6">
                <div className="rounded-lg bg-gray-50 border border-dashed border-gray-200 py-6 text-center">
                  <Medal className="w-7 h-7 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No standings data yet</p>
                </div>
              </div>
            ) : (
              <div className="px-6 pb-4">
                <div className="space-y-1">
                  {standings.map((s, i) => {
                    const rankStyle = i === 0
                      ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
                      : i === 1
                        ? 'bg-gray-100 text-gray-600 ring-1 ring-gray-200'
                        : i === 2
                          ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-200'
                          : 'bg-gray-50 text-gray-400'
                    return (
                      <div key={s.teamId} className="flex items-center gap-2.5 py-2 px-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors duration-150">
                        <span className={`w-6 h-6 flex items-center justify-center rounded-md text-[10px] font-bold flex-shrink-0 ${rankStyle}`}>
                          {i + 1}
                        </span>
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: s.sport.color }}
                        />
                        <span className="flex-1 text-sm text-gray-800 truncate font-medium">{s.teamName}</span>
                        <span className="text-xs text-gray-500 tabular-nums flex-shrink-0">
                          {s.wins}-{s.losses}{s.ties > 0 ? `-${s.ties}` : ''}
                        </span>
                        <span className="text-xs font-semibold text-gray-700 tabular-nums w-8 text-right flex-shrink-0">
                          {s.gamesPlayed > 0 ? `.${Math.round(s.winPct * 1000).toString().padStart(3, '0')}` : '\u2014'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </motion.div>

          {/* This Week */}
          <motion.div variants={cardEntrance} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow duration-200">
            <div className="px-6 pt-5 pb-4">
              <h2 className="text-base font-semibold text-gray-900">
                This Week
                <span className="text-xs font-normal text-gray-400 ml-2">
                  {formatWeekRange(weekSchedule.weekStart, weekSchedule.weekEnd)}
                </span>
              </h2>
            </div>
            <div className="px-4 pb-4 space-y-0.5">
              {weekDays.map((day) => {
                const dayGames = weekSchedule.games.filter((g) => isSameDay(g.startTime, day.date))
                const dayPractices = weekSchedule.practices.filter((p) => isSameDay(p.startTime, day.date))
                const isToday = isSameDay(new Date().toISOString(), day.date)
                const hasEvents = dayGames.length > 0 || dayPractices.length > 0

                return (
                  <div
                    key={day.label}
                    className={`flex items-start gap-3 py-2 px-2 rounded-lg transition-colors duration-150 ${
                      isToday
                        ? 'bg-primary-50/70 ring-1 ring-primary-200/60'
                        : hasEvents
                          ? 'hover:bg-gray-50'
                          : ''
                    }`}
                  >
                    <span className={`text-xs font-semibold w-8 flex-shrink-0 pt-0.5 uppercase tracking-wide ${
                      isToday ? 'text-primary-700' : hasEvents ? 'text-gray-700' : 'text-gray-400'
                    }`}>
                      {day.label}
                    </span>
                    <div className="flex-1 min-w-0 space-y-1">
                      {!hasEvents && <span className="text-xs text-gray-300">&mdash;</span>}
                      {dayGames.map((g) => (
                        <div key={g.id} className="flex items-center gap-1.5">
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: g.athleticTeam?.sport?.color || '#6b7280' }}
                          />
                          <span className="text-xs text-gray-700 truncate">
                            <span className="font-semibold">{formatTime(g.startTime)}</span>
                            {' '}{g.homeAway === 'AWAY' ? '@ ' : 'vs '}{g.opponentName}
                          </span>
                        </div>
                      ))}
                      {dayPractices.map((p) => (
                        <div key={p.id} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-gray-300" />
                          <span className="text-xs text-gray-500 truncate">
                            <span className="font-medium">{formatTime(p.startTime)}</span>
                            {' '}{p.athleticTeam?.sport?.name} Practice
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>

          {/* Quick Actions */}
          {canWrite && (
            <motion.div variants={cardEntrance} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow duration-200">
              <div className="px-6 pt-5 pb-4">
                <h2 className="text-base font-semibold text-gray-900">Quick Actions</h2>
              </div>
              <div className="px-4 pb-4 space-y-1">
                <QuickAction
                  icon={CalendarPlus}
                  label="Schedule Game"
                  desc="Add a new game to the schedule"
                  color="blue"
                  onClick={() => onTabChange('schedule')}
                />
                <QuickAction
                  icon={ClipboardList}
                  label="Manage Rosters"
                  desc="Add or edit players"
                  color="emerald"
                  onClick={() => onTabChange('roster')}
                />
                <QuickAction
                  icon={Dribbble}
                  label="Add Sport"
                  desc="Create a new sport program"
                  color="purple"
                  onClick={() => onTabChange('sports')}
                />
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────

function StatCard({ config, label, value }: {
  config: { icon: LucideIcon; gradient: string; border: string; iconBg: string; iconColor: string; valueColor: string; labelColor: string }
  label: string
  value: number
}) {
  const Icon = config.icon
  return (
    <div className={`bg-gradient-to-br ${config.gradient} border ${config.border} rounded-xl p-4 text-center hover:shadow-md transition-shadow duration-200 group`}>
      <div className={`w-9 h-9 ${config.iconBg} rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform duration-200`}>
        <Icon className={`w-4.5 h-4.5 ${config.iconColor}`} />
      </div>
      <div className={`text-2xl font-bold ${config.valueColor} tabular-nums`}>
        <AnimatedCounter value={value} duration={0.6} />
      </div>
      <div className={`text-xs font-medium ${config.labelColor} mt-1`}>{label}</div>
    </div>
  )
}

const QUICK_ACTION_COLORS = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', hover: 'group-hover:bg-blue-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', hover: 'group-hover:bg-emerald-100' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', hover: 'group-hover:bg-purple-100' },
} as const

function QuickAction({ icon: Icon, label, desc, color, onClick }: {
  icon: LucideIcon
  label: string
  desc: string
  color: keyof typeof QUICK_ACTION_COLORS
  onClick: () => void
}) {
  const c = QUICK_ACTION_COLORS[color]
  return (
    <button
      onClick={onClick}
      className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors duration-150 text-left"
    >
      <div className={`w-8 h-8 ${c.bg} ${c.hover} rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-200`}>
        <Icon className={`w-4 h-4 ${c.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800">{label}</div>
        <div className="text-[11px] text-gray-500 leading-tight">{desc}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all duration-150 flex-shrink-0" />
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
          <div key={i} className="rounded-xl h-[104px] bg-gradient-to-br from-gray-100 to-gray-50 border border-gray-100" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-100 rounded-xl h-80">
            <div className="h-12 bg-gray-50 rounded-t-xl" />
            <div className="p-6 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-1 h-10 rounded-full bg-gray-100" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-gray-100 rounded w-3/4" />
                    <div className="h-2.5 bg-gray-50 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white border border-gray-100 rounded-xl h-48">
            <div className="h-12 bg-gray-50 rounded-t-xl" />
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-white border border-gray-100 rounded-xl h-64">
            <div className="h-12 bg-gray-50 rounded-t-xl" />
          </div>
          <div className="bg-white border border-gray-100 rounded-xl h-56">
            <div className="h-12 bg-gray-50 rounded-t-xl" />
          </div>
          <div className="bg-white border border-gray-100 rounded-xl h-44">
            <div className="h-12 bg-gray-50 rounded-t-xl" />
          </div>
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
