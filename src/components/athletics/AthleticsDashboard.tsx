'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { queryOptions } from '@/lib/queries'
import {
  Trophy, Users, CalendarDays, Dribbble, ArrowRight, Clock, MapPin,
  ChevronRight, CalendarPlus, ClipboardList, type LucideIcon,
} from 'lucide-react'
import AnimatedCounter from '@/components/motion/AnimatedCounter'
import { staggerContainer, cardEntrance, listItem } from '@/lib/animations'
import { GlassSportTile } from './SportIcon'
import type { AthleticsTab } from '@/components/Sidebar'

// ── Glass card classes ──────────────────────────────────────────────────
const GLASS = 'bg-white/60 backdrop-blur-sm border border-gray-200/30 rounded-2xl shadow-sm'
const GLASS_HOVER = `${GLASS} hover:shadow-md hover:bg-white/70 transition-all duration-200`

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

export default function AthleticsDashboard({ activeCampusId, canWrite, onTabChange }: AthleticsDashboardProps) {
  const { data, isLoading } = useQuery(queryOptions.athleticsDashboard(activeCampusId))

  if (isLoading) return <DashboardSkeleton />

  const dashboard = data as DashboardData | undefined
  if (!dashboard) return <DashboardSkeleton />

  const { summary, upcomingGames, recentResults, standings, weekSchedule } = dashboard
  const hasData = summary.totalTeams > 0 || summary.totalSports > 0

  if (!hasData) return <EmptyState onTabChange={onTabChange} />

  const weekDays = getWeekDays(weekSchedule.weekStart)

  return (
    <div className="relative">
      {/* Ambient gradient blobs — very subtle, gives glass cards depth */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute -top-32 right-0 w-[500px] h-[500px] rounded-full blur-[120px] bg-blue-200/[0.08]" />
        <div className="absolute top-1/3 -left-32 w-[400px] h-[400px] rounded-full blur-[120px] bg-violet-200/[0.06]" />
        <div className="absolute -bottom-20 right-1/4 w-[350px] h-[350px] rounded-full blur-[100px] bg-amber-100/[0.06]" />
      </div>

      <motion.div
        className="relative space-y-6"
        initial="hidden"
        animate="visible"
        variants={staggerContainer(0.08, 0.05)}
      >
        {/* ── Summary Stats ── */}
        <motion.div variants={staggerContainer(0.06)} initial="hidden" animate="visible" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <motion.div variants={cardEntrance}>
            <StatCard icon={Users} label="Teams" value={summary.totalTeams} />
          </motion.div>
          <motion.div variants={cardEntrance}>
            <StatCard icon={CalendarDays} label="Games This Week" value={summary.gamesThisWeek} />
          </motion.div>
          <motion.div variants={cardEntrance}>
            <div className={`${GLASS_HOVER} p-5 text-center`}
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.7), rgba(59,130,246,0.06))',
              }}
            >
              <div className="w-10 h-10 rounded-xl mx-auto mb-2.5 flex items-center justify-center"
                style={{
                  background: 'linear-gradient(145deg, rgba(59,130,246,0.12), rgba(59,130,246,0.04))',
                  borderColor: 'rgba(59,130,246,0.15)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
                  border: '1px solid rgba(59,130,246,0.15)',
                }}
              >
                <Trophy className="w-5 h-5 text-primary-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900 tabular-nums">
                <AnimatedCounter value={summary.overallRecord.wins} duration={0.6} />
                <span className="text-gray-300 mx-0.5">-</span>
                <AnimatedCounter value={summary.overallRecord.losses} duration={0.6} />
                {summary.overallRecord.ties > 0 && (
                  <><span className="text-gray-300 mx-0.5">-</span><AnimatedCounter value={summary.overallRecord.ties} duration={0.6} /></>
                )}
              </div>
              <div className="text-xs font-medium text-gray-500 mt-1">Overall Record</div>
            </div>
          </motion.div>
          <motion.div variants={cardEntrance}>
            <StatCard icon={Dribbble} label="Active Sports" value={summary.activeSports} />
          </motion.div>
        </motion.div>

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">

            {/* Upcoming Games */}
            <motion.div variants={cardEntrance} className={GLASS_HOVER}>
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Upcoming Games</h2>
                <button
                  onClick={() => onTabChange('schedule')}
                  className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium"
                >
                  View all <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              {upcomingGames.length === 0 ? (
                <div className="px-6 pb-6">
                  <div className="rounded-xl bg-gray-50/50 border border-dashed border-gray-200/60 py-8 text-center">
                    <CalendarDays className="w-7 h-7 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No upcoming games scheduled</p>
                  </div>
                </div>
              ) : (
                <div className="px-4 pb-3">
                  {upcomingGames.map((game) => (
                    <motion.div
                      key={game.id}
                      variants={listItem}
                      className="group flex items-center gap-3 py-3 px-2 rounded-xl hover:bg-white/60 transition-colors duration-150"
                    >
                      <GlassSportTile
                        sport={game.athleticTeam.sport.name}
                        color={game.athleticTeam.sport.color}
                        size="md"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {game.athleticTeam.name} {game.homeAway === 'AWAY' ? '@ ' : 'vs '}{game.opponentName}
                        </div>
                        <div className="flex items-center gap-2.5 mt-0.5 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(game.startTime)} &middot; {formatTime(game.startTime)}
                          </span>
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                            game.homeAway === 'HOME'
                              ? 'bg-green-50 text-green-600'
                              : 'bg-gray-100/80 text-gray-500'
                          }`}>
                            <MapPin className="w-2.5 h-2.5" />
                            {game.homeAway === 'HOME' ? 'Home' : 'Away'}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Recent Results */}
            <motion.div variants={cardEntrance} className={GLASS_HOVER}>
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Recent Results</h2>
              </div>
              {recentResults.length === 0 ? (
                <div className="px-6 pb-6">
                  <div className="rounded-xl bg-gray-50/50 border border-dashed border-gray-200/60 py-8 text-center">
                    <Trophy className="w-7 h-7 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No completed games yet</p>
                  </div>
                </div>
              ) : (
                <div className="px-4 pb-3">
                  {recentResults.map((game) => {
                    const badge = getResultBadge(game)
                    const score = getScoreDisplay(game)
                    return (
                      <div key={game.id} className="group flex items-center gap-3 py-3 px-2 rounded-xl hover:bg-white/60 transition-colors duration-150">
                        <GlassSportTile
                          sport={game.athleticTeam.sport.name}
                          color={game.athleticTeam.sport.color}
                          size="md"
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
                            <span className={`text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-lg ${badge.className}`}>
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
            <motion.div variants={cardEntrance} className={GLASS_HOVER}>
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Standings</h2>
                <button
                  onClick={() => onTabChange('stats')}
                  className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium"
                >
                  View all <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              {standings.length === 0 ? (
                <div className="px-6 pb-6">
                  <div className="rounded-xl bg-gray-50/50 border border-dashed border-gray-200/60 py-6 text-center">
                    <Trophy className="w-7 h-7 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No standings data yet</p>
                  </div>
                </div>
              ) : (
                <div className="px-4 pb-4 space-y-0.5">
                  {standings.map((s, i) => (
                    <div key={s.teamId} className="flex items-center gap-2.5 py-2 px-2 rounded-xl hover:bg-white/60 transition-colors duration-150">
                      <span className="w-5 text-xs text-gray-400 font-medium text-center flex-shrink-0 tabular-nums">{i + 1}</span>
                      <GlassSportTile
                        sport={s.sport.name}
                        color={s.sport.color}
                        size="sm"
                      />
                      <span className="flex-1 text-sm text-gray-800 truncate">{s.teamName}</span>
                      <span className="text-xs text-gray-500 tabular-nums flex-shrink-0">
                        {s.wins}-{s.losses}{s.ties > 0 ? `-${s.ties}` : ''}
                      </span>
                      <span className="text-xs font-medium text-gray-600 tabular-nums w-8 text-right flex-shrink-0">
                        {s.gamesPlayed > 0 ? `.${Math.round(s.winPct * 1000).toString().padStart(3, '0')}` : '\u2014'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* This Week */}
            <motion.div variants={cardEntrance} className={GLASS_HOVER}>
              <div className="px-6 pt-5 pb-3">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  This Week
                  <span className="text-[10px] font-normal text-gray-400 ml-2 normal-case tracking-normal">
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
                      className={`flex items-start gap-3 py-2 px-2 rounded-xl transition-colors duration-150 ${
                        isToday
                          ? 'bg-primary-50/40 ring-1 ring-primary-200/40'
                          : hasEvents ? 'hover:bg-white/40' : ''
                      }`}
                    >
                      <span className={`text-[11px] font-semibold w-7 flex-shrink-0 pt-0.5 uppercase tracking-wider ${
                        isToday ? 'text-primary-600' : hasEvents ? 'text-gray-600' : 'text-gray-300'
                      }`}>
                        {day.label}
                      </span>
                      <div className="flex-1 min-w-0 space-y-0.5">
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
              <motion.div variants={cardEntrance} className={GLASS_HOVER}>
                <div className="px-6 pt-5 pb-3">
                  <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Quick Actions</h2>
                </div>
                <div className="px-4 pb-4 space-y-0.5">
                  <QuickAction
                    icon={CalendarPlus}
                    label="Schedule Game"
                    onClick={() => onTabChange('schedule')}
                  />
                  <QuickAction
                    icon={ClipboardList}
                    label="Manage Rosters"
                    onClick={() => onTabChange('roster')}
                  />
                  <QuickAction
                    icon={Dribbble}
                    label="Add Sport"
                    onClick={() => onTabChange('sports')}
                  />
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className={`${GLASS_HOVER} p-5 text-center`}>
      <div
        className="w-10 h-10 rounded-xl mx-auto mb-2.5 flex items-center justify-center border border-gray-200/40"
        style={{
          background: 'linear-gradient(145deg, rgba(249,250,251,0.9), rgba(243,244,246,0.6))',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
        }}
      >
        <Icon className="w-5 h-5 text-gray-500" />
      </div>
      <div className="text-2xl font-bold text-gray-900 tabular-nums">
        <AnimatedCounter value={value} duration={0.6} />
      </div>
      <div className="text-xs font-medium text-gray-500 mt-1">{label}</div>
    </div>
  )
}

function QuickAction({ icon: Icon, label, onClick }: {
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/60 transition-colors duration-150 text-left"
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-200/40"
        style={{
          background: 'linear-gradient(145deg, rgba(249,250,251,0.9), rgba(243,244,246,0.5))',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
        }}
      >
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <span className="flex-1 text-sm font-medium text-gray-700">{label}</span>
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all duration-150 flex-shrink-0" />
    </button>
  )
}

function EmptyState({ onTabChange }: { onTabChange: (tab: AthleticsTab) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 border"
        style={{
          background: 'linear-gradient(145deg, rgba(59,130,246,0.1), rgba(59,130,246,0.03))',
          borderColor: 'rgba(59,130,246,0.15)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
        }}
      >
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
          <div key={i} className="bg-white/40 rounded-2xl h-28 border border-gray-100/50" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/40 rounded-2xl border border-gray-100/50 h-80">
            <div className="h-12 bg-gray-50/30 rounded-t-2xl" />
            <div className="p-5 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gray-100/50" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-gray-100/50 rounded w-3/4" />
                    <div className="h-2.5 bg-gray-50/50 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white/40 rounded-2xl border border-gray-100/50 h-48" />
        </div>
        <div className="space-y-6">
          <div className="bg-white/40 rounded-2xl border border-gray-100/50 h-64" />
          <div className="bg-white/40 rounded-2xl border border-gray-100/50 h-56" />
          <div className="bg-white/40 rounded-2xl border border-gray-100/50 h-40" />
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
