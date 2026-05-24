'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { queryOptions } from '@/lib/queries'
import {
  Trophy, Users, CalendarDays, Dribbble, ArrowRight, Clock, MapPin,
  ChevronRight, CalendarPlus, ClipboardList, type LucideIcon, AlertTriangle,
  CheckCircle2, ShieldCheck, ClipboardCheck, PlayCircle, UserCheck,
} from 'lucide-react'
import AnimatedCounter from '@/components/motion/AnimatedCounter'
import { staggerContainer, cardEntrance, listItem } from '@/lib/animations'
import { GlassSportTile } from './SportIcon'
import { IllustrationAthletics } from '@/components/illustrations'

// Glass card classes — now using global CSS utilities from globals.css
// .ui-glass and .ui-glass-hover

interface AthleticsDashboardProps {
  activeCampusId: string | null
  canWrite: boolean
  onTabChange: (tab: string) => void
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
  coachFocus: CoachFocus | null
  viewer?: {
    scope: 'mine' | 'sport' | 'all'
    canViewAll: boolean
    assignedTeamCount: number
    assignedSportIds: string[]
    primarySportName: string | null
  }
  weekSchedule: {
    games: Game[]
    practices: Practice[]
    weekStart: string
    weekEnd: string
  }
}

interface CoachFocus {
  primaryTeam: {
    id: string
    name: string
    level: string
    sport: { id?: string; name: string; color: string }
    rosterCount: number
  }
  assignedTeams: Array<{
    id: string
    name: string
    level: string
    sport: { id?: string; name: string; color: string }
    rosterCount: number
  }>
  nextGame: Game | null
  scoreDueCount: number
  missingVenueCount: number
  nextSevenDaysCount: number
  readiness: {
    rosterReady: boolean
    venueReady: boolean
    scorebookReady: boolean
  }
}

interface Game {
  id: string
  athleticTeamId: string
  opponentAthleticTeamId?: string | null
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
    campusId: string | null
    sport: { name: string; color: string }
  }
  opponentAthleticTeam?: {
    id: string
    name: string
    level: string
    campusId: string | null
    sport: { name: string; color: string }
  } | null
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

interface AttentionItem {
  id: string
  title: string
  detail: string
  tone: 'warning' | 'neutral' | 'success'
  action: string
  tab: string
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

// ── Viewpoint resolution ──────────────────────────��───────────────────────────
// For cross-school games, the dashboard viewer may be on the opponent side.
// We flip home/away and scores accordingly so stats aren't double-counted or
// shown from the wrong perspective.

type GameSide = 'owning' | 'opponent'

interface GameViewpoint {
  side: GameSide
  teamName: string
  sportName: string
  sportColor: string
  opponentLabel: string
  homeAway: string
}

/**
 * Determines whether the viewer is on the owning or opponent side.
 * Uses `activeCampusId` to check campusId on each side — if the owning team
 * doesn't belong to the active campus but the opponent does, flip the viewpoint.
 * Phase 1c Pass 5: AthleticTeam.schoolId → AthleticTeam.campusId.
 */
function resolveGameViewpoint(game: Game, activeCampusId: string | null): GameViewpoint {
  let side: GameSide = 'owning'

  if (activeCampusId && game.opponentAthleticTeamId) {
    const owningBelongs = game.athleticTeam.campusId === activeCampusId || !game.athleticTeam.campusId
    const opponentBelongs = game.opponentAthleticTeam?.campusId === activeCampusId
    if (!owningBelongs && opponentBelongs) side = 'opponent'
  }

  if (side === 'owning') {
    return {
      side,
      teamName: game.athleticTeam.name,
      sportName: game.athleticTeam.sport.name,
      sportColor: game.athleticTeam.sport.color,
      opponentLabel: game.opponentAthleticTeam?.name ?? game.opponentName,
      homeAway: game.homeAway,
    }
  }

  // Flipped — render from opponent's perspective.
  const flippedHA = game.homeAway === 'HOME' ? 'AWAY' : game.homeAway === 'AWAY' ? 'HOME' : 'NEUTRAL'
  return {
    side,
    teamName: game.opponentAthleticTeam?.name ?? game.opponentName,
    sportName: game.opponentAthleticTeam?.sport?.name ?? game.athleticTeam.sport.name,
    sportColor: game.opponentAthleticTeam?.sport?.color ?? game.athleticTeam.sport.color,
    opponentLabel: game.athleticTeam.name,
    homeAway: flippedHA,
  }
}

function getResultBadge(game: Game, side: GameSide = 'owning') {
  if (game.homeScore == null || game.awayScore == null) return null
  const owningWasHome = game.homeAway === 'HOME'
  const isHome = side === 'owning' ? owningWasHome : !owningWasHome
  const homeWon = game.homeScore > game.awayScore
  const tied = game.homeScore === game.awayScore

  if (tied) return { label: 'T', className: 'bg-yellow-100 text-yellow-700' }
  if ((isHome && homeWon) || (!isHome && !homeWon)) return { label: 'W', className: 'bg-green-100 text-green-700' }
  return { label: 'L', className: 'bg-red-100 text-red-700' }
}

function getScoreDisplay(game: Game, side: GameSide = 'owning') {
  if (game.homeScore == null || game.awayScore == null) return null
  const owningWasHome = game.homeAway === 'HOME'
  const isHome = side === 'owning' ? owningWasHome : !owningWasHome
  const ourScore = isHome ? game.homeScore : game.awayScore
  const theirScore = isHome ? game.awayScore : game.homeScore
  return `${ourScore}-${theirScore}`
}

export default function AthleticsDashboard({ activeCampusId, canWrite, onTabChange }: AthleticsDashboardProps) {
  const [coachScope, setCoachScope] = useState<'mine' | 'sport'>('mine')
  const { data, isLoading } = useQuery(queryOptions.athleticsDashboard(activeCampusId, coachScope))

  if (isLoading) return <DashboardSkeleton />

  const dashboard = data as DashboardData | undefined
  if (!dashboard) return <DashboardSkeleton />

  const { summary, upcomingGames, recentResults, standings, weekSchedule } = dashboard
  const viewer = dashboard.viewer
  const isCoachView = viewer && !viewer.canViewAll
  const primarySportName = viewer?.primarySportName ?? 'sport'
  const coachFocus = dashboard.coachFocus
  const hasData = summary.totalTeams > 0 || summary.totalSports > 0

  if (!hasData) return <EmptyState onTabChange={onTabChange} />

  const weekDays = getWeekDays(weekSchedule.weekStart)
  const todayGames = weekSchedule.games.filter((g) => isSameDay(g.startTime, new Date().toISOString()))
  const todayPractices = weekSchedule.practices.filter((p) => isSameDay(p.startTime, new Date().toISOString()))
  const weekItemCount = weekSchedule.games.length + weekSchedule.practices.length
  const missingVenueGames = upcomingGames.filter((g) => !g.venue?.trim())
  const scoreDueGames = weekSchedule.games.filter((g) => new Date(g.startTime) < new Date() && !g.isFinal)
  const attentionItems = buildAttentionItems({
    missingVenueGames,
    scoreDueGames,
    activeCampusId,
  })
  const attentionSummary = `${attentionItems.length} ${attentionItems.length === 1 ? 'item' : 'items'} ${attentionItems.length === 1 ? 'needs' : 'need'} attention`
  const nextReadyGame = upcomingGames[0] ?? null
  const nextReadyViewpoint = nextReadyGame ? resolveGameViewpoint(nextReadyGame, activeCampusId) : null
  const statusTitle = attentionItems.length
    ? attentionSummary
    : nextReadyGame
      ? `Next ${isCoachView ? primarySportName.toLowerCase() : ''} game ready`.replace(/\s+/g, ' ').trim()
      : 'Clear for today'
  const statusDetail = attentionItems.length
    ? attentionItems[0]?.detail ?? 'Review athletics items.'
    : nextReadyGame && nextReadyViewpoint
      ? `${formatDate(nextReadyGame.startTime)} · ${nextReadyViewpoint.teamName} ${nextReadyViewpoint.homeAway === 'AWAY' ? '@' : 'vs'} ${nextReadyViewpoint.opponentLabel}`
      : 'No games or practices today.'
  const statusIsActionable = attentionItems.length > 0 || Boolean(nextReadyGame)

  return (
    <div className="relative">
      <motion.div
        className="relative space-y-6"
        initial="hidden"
        animate="visible"
        variants={staggerContainer(0.08, 0.05)}
      >
        {/* ── Today command strip ── */}
        <motion.div
          variants={cardEntrance}
          className="overflow-visible lg:overflow-hidden lg:rounded-3xl lg:border lg:border-stone-200/70 lg:bg-white/75 lg:shadow-sm lg:backdrop-blur"
        >
          <div className="px-0 py-1 lg:p-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-stone-600 ring-1 ring-stone-200/70 lg:bg-stone-100 lg:ring-0">
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  {isCoachView ? `${primarySportName} coach` : 'Today in Athletics'}
                </div>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 lg:text-3xl">
                  {isCoachView ? `Your ${primarySportName.toLowerCase()} day.` : 'Today in athletics.'}
                </h2>
                <p className="mt-2 text-base text-stone-500">
                  {todayGames.length || todayPractices.length
                    ? `${todayGames.length} games and ${todayPractices.length} practices are on today.`
                    : upcomingGames.length
                      ? 'No games or practices today.'
                      : weekItemCount
                        ? `No games or practices today. ${weekItemCount} ${weekItemCount === 1 ? 'item is' : 'items are'} coming up.`
                      : 'No games or practices today. The next 7 days are quiet.'}
                </p>
              </div>

              {!coachFocus && (
                <button
                  type="button"
                  onClick={() => statusIsActionable && onTabChange('schedule')}
                  disabled={!statusIsActionable}
                  className="group w-full rounded-2xl border border-stone-200/80 bg-white/75 p-4 text-left shadow-sm transition-colors duration-200 enabled:hover:bg-white enabled:cursor-pointer disabled:cursor-default xl:w-[360px] lg:bg-stone-50/70 lg:shadow-none"
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border ${
                      attentionItems.length
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}>
                      {attentionItems.length ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-950">
                        {statusTitle}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-stone-500">{statusDetail}</p>
                    </div>
                    {statusIsActionable && (
                      <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-stone-400 transition-transform duration-200 group-hover:translate-x-0.5" />
                    )}
                  </div>
                </button>
              )}
            </div>

            {isCoachView && viewer.assignedTeamCount > 0 && (
              <div className="mt-5 inline-flex w-full rounded-full bg-white/70 p-1 ring-1 ring-stone-200/70 sm:w-auto">
                {([
                  { key: 'mine' as const, label: 'My teams' },
                  { key: 'sport' as const, label: `All ${primarySportName}` },
                ]).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setCoachScope(item.key)}
                    className={`min-h-10 flex-1 rounded-full px-5 text-sm font-semibold transition-colors duration-200 cursor-pointer sm:flex-none ${
                      coachScope === item.key
                        ? 'bg-slate-950 text-white'
                        : 'text-stone-500 hover:text-slate-950'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}

            {isCoachView && coachFocus && (
              <CoachFocusPanel
                focus={coachFocus}
                activeCampusId={activeCampusId}
                onTabChange={onTabChange}
              />
            )}

            <div className="mt-5 rounded-2xl border border-stone-200/70 bg-white/70 p-4 lg:mt-6">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Today + next 6</p>
                <button
                  type="button"
                  onClick={() => onTabChange('schedule')}
                  className="text-xs font-semibold text-stone-500 transition-colors hover:text-slate-900 cursor-pointer"
                >
                  View schedule
                </button>
              </div>
              <WeekStrip weekDays={weekDays} games={weekSchedule.games} practices={weekSchedule.practices} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 lg:mt-6 lg:grid-cols-4">
              <CommandStat icon={attentionItems.length ? AlertTriangle : CheckCircle2} label="Needs attention" value={attentionItems.length} tone={attentionItems.length ? 'warning' : 'success'} />
              <CommandStat icon={CalendarDays} label="Games this week" value={summary.gamesThisWeek} />
              <CommandStat icon={Users} label="Teams" value={summary.totalTeams} />
              <CommandStat icon={Dribbble} label="Active sports" value={summary.activeSports} />
            </div>
          </div>
        </motion.div>

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">

            {/* Needs Attention */}
            <motion.div variants={cardEntrance} className="ui-glass-hover">
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Needs Attention</h2>
                <button
                  onClick={() => onTabChange('schedule')}
                  className="text-xs text-stone-500 hover:text-stone-700 flex items-center gap-1 font-medium cursor-pointer"
                >
                  Review <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="px-4 pb-4">
                {attentionItems.length === 0 ? (
                  <OperationalEmptyState
                    icon={ShieldCheck}
                    title="No open athletics items"
                    description="Missing venues and late scores will appear here."
                  />
                ) : (
                  <div className="space-y-2">
                    {attentionItems.map((item) => (
                      <AttentionRow key={item.id} item={item} onTabChange={onTabChange} />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>

            {/* Upcoming Games */}
            <motion.div variants={cardEntrance} className="ui-glass-hover">
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Upcoming Games</h2>
                <button
                  onClick={() => onTabChange('schedule')}
                  className="text-xs text-stone-500 hover:text-stone-700 flex items-center gap-1 font-medium"
                >
                  View all <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              {upcomingGames.length === 0 ? (
                <div className="px-6 pb-6">
                  <OperationalEmptyState
                    icon={CalendarPlus}
                    title="No upcoming games"
                    description="Schedule the next game when the season is ready."
                    actionLabel="Schedule game"
                    onAction={() => onTabChange('schedule')}
                  />
                </div>
              ) : (
                <div className="px-4 pb-3">
                  {upcomingGames.map((game) => {
                    const vp = resolveGameViewpoint(game, activeCampusId)
                    return (
                      <motion.div
                        key={game.id}
                        variants={listItem}
                        className="group flex items-center gap-3 py-3 px-2 rounded-xl hover:bg-white/60 transition-colors duration-150"
                      >
                        <GlassSportTile
                          sport={vp.sportName}
                          color={vp.sportColor}
                          size="md"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {vp.teamName} {vp.homeAway === 'AWAY' ? '@ ' : 'vs '}{vp.opponentLabel}
                          </div>
                          <div className="flex items-center gap-2.5 mt-0.5 text-xs text-stone-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDate(game.startTime)} &middot; {formatTime(game.startTime)}
                            </span>
                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                              vp.homeAway === 'HOME'
                                ? 'bg-green-50 text-green-600'
                                : 'bg-stone-100/80 text-stone-500'
                            }`}>
                              <MapPin className="w-2.5 h-2.5" />
                              {vp.homeAway === 'HOME' ? 'Home' : 'Away'}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </motion.div>

            {/* Recent Results */}
            <motion.div variants={cardEntrance} className="ui-glass-hover">
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Recent Results</h2>
              </div>
              {recentResults.length === 0 ? (
                <div className="px-6 pb-6">
                  <OperationalEmptyState
                    icon={Trophy}
                    title="No completed games yet"
                    description="Scores will appear here after the first final result."
                  />
                </div>
              ) : (
                <div className="px-4 pb-3">
                  {recentResults.map((game) => {
                    const vp = resolveGameViewpoint(game, activeCampusId)
                    const badge = getResultBadge(game, vp.side)
                    const score = getScoreDisplay(game, vp.side)
                    return (
                      <div key={game.id} className="group flex items-center gap-3 py-3 px-2 rounded-xl hover:bg-white/60 transition-colors duration-150">
                        <GlassSportTile
                          sport={vp.sportName}
                          color={vp.sportColor}
                          size="md"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">
                            {vp.teamName} {vp.homeAway === 'AWAY' ? '@ ' : 'vs '}{vp.opponentLabel}
                          </div>
                          <div className="text-xs text-stone-500 mt-0.5">
                            {formatRelativeDate(game.startTime)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {score && <span className="text-sm font-bold text-slate-800 tabular-nums">{score}</span>}
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
            <motion.div variants={cardEntrance} className="ui-glass-hover">
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Standings</h2>
                <button
                  onClick={() => onTabChange('stats')}
                  className="text-xs text-stone-500 hover:text-stone-700 flex items-center gap-1 font-medium"
                >
                  View all <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              {standings.length === 0 ? (
                <div className="px-6 pb-6">
                  <OperationalEmptyState
                    icon={Trophy}
                    title="No standings yet"
                    description="Standings will build as final scores are entered."
                  />
                </div>
              ) : (
                <div className="px-4 pb-4 space-y-1">
                  {standings.map((s, i) => (
                    <div key={s.teamId} className="grid grid-cols-[1.25rem_auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl px-2 py-2.5 transition-colors duration-150 hover:bg-white/60">
                      <span className="text-center text-xs font-medium tabular-nums text-stone-400">{i + 1}</span>
                      <GlassSportTile
                        sport={s.sport.name}
                        color={s.sport.color}
                        size="sm"
                      />
                      <span className="min-w-0 text-sm leading-snug text-slate-800">{s.teamName}</span>
                      <span className="text-right text-xs tabular-nums text-stone-500">
                        {s.wins}-{s.losses}{s.ties > 0 ? `-${s.ties}` : ''}
                        <span className="ml-2 font-medium text-stone-600">
                          {s.gamesPlayed > 0 ? `.${Math.round(s.winPct * 1000).toString().padStart(3, '0')}` : '\u2014'}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Quick Actions */}
            {canWrite && (
              <motion.div variants={cardEntrance} className="ui-glass-hover">
                <div className="px-6 pt-5 pb-3">
                  <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Quick Actions</h2>
                </div>
                <div className="px-4 pb-4 space-y-0.5">
                  <QuickAction
                    icon={CalendarPlus}
                    label="Schedule game"
                    onClick={() => onTabChange('schedule')}
                  />
                  <QuickAction
                    icon={ClipboardList}
                    label="Review rosters"
                    onClick={() => onTabChange('roster')}
                  />
                  <QuickAction
                    icon={CalendarDays}
                    label="Season setup"
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

function CoachFocusPanel({
  focus,
  activeCampusId,
  onTabChange,
}: {
  focus: CoachFocus
  activeCampusId: string | null
  onTabChange: (tab: string) => void
}) {
  const game = focus.nextGame
  const viewpoint = game ? resolveGameViewpoint(game, activeCampusId) : null
  const readinessItems = [
    {
      label: 'Roster',
      value: focus.readiness.rosterReady ? `${focus.primaryTeam.rosterCount} athletes` : 'Needs players',
      ready: focus.readiness.rosterReady,
      tab: 'roster',
    },
    {
      label: 'Venue',
      value: focus.readiness.venueReady ? game?.venue || 'No game yet' : 'Missing location',
      ready: focus.readiness.venueReady,
      tab: 'schedule',
    },
    {
      label: 'Game day',
      value: game?.isFinal ? 'Score saved' : focus.readiness.scorebookReady ? 'Ready to launch' : 'No game queued',
      ready: focus.readiness.scorebookReady,
      tab: 'schedule',
    },
  ]

  return (
    <div className="mt-5 overflow-hidden rounded-[1.75rem] border border-slate-900/10 bg-slate-950 text-white shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: focus.primaryTeam.sport.color }}
                />
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-200">
                  {focus.primaryTeam.sport.name} coach
                </p>
              </div>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                {focus.primaryTeam.name}
              </h3>
              <p className="mt-1 text-sm font-medium text-white/55">
                {focus.assignedTeams.length} {focus.assignedTeams.length === 1 ? 'team' : 'teams'} assigned · {focus.nextSevenDaysCount} next 7 days
              </p>
            </div>
            <button
              type="button"
              onClick={() => onTabChange('teams')}
              className="shrink-0 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition-colors duration-200 hover:bg-white/15 cursor-pointer"
            >
              My teams
            </button>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2">
            <CoachMetric label="Roster" value={focus.primaryTeam.rosterCount} />
            <CoachMetric label="Needs" value={focus.missingVenueCount + focus.scoreDueCount} />
            <CoachMetric label="Week" value={focus.nextSevenDaysCount} />
          </div>
        </div>

        <div className="border-t border-white/10 bg-white/[0.06] p-5 sm:p-6 lg:border-l lg:border-t-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/45">
                {game ? 'Next game' : 'No game queued'}
              </p>
              <h4 className="mt-2 text-xl font-semibold leading-tight">
                {game && viewpoint
                  ? `${viewpoint.homeAway === 'AWAY' ? '@' : 'vs'} ${viewpoint.opponentLabel}`
                  : 'Schedule the next matchup'}
              </h4>
              <p className="mt-2 text-sm font-medium text-white/55">
                {game
                  ? `${formatDate(game.startTime)} · ${formatTime(game.startTime)}${game.venue ? ` · ${game.venue}` : ''}`
                  : 'Once a game is scheduled, this becomes the coach launch point.'}
              </p>
            </div>
            {game && (
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold text-white">
                {game.isFinal ? 'Final' : 'Ready'}
              </span>
            )}
          </div>

          <div className="mt-5 grid gap-2">
            {readinessItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => onTabChange(item.tab)}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl bg-white/[0.07] px-3 py-3 text-left transition-colors duration-200 hover:bg-white/[0.1] cursor-pointer"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  item.ready ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-200'
                }`}>
                  {item.ready ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <p className="truncate text-xs font-medium text-white/45">{item.value}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-white/35" />
              </button>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onTabChange('schedule')}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-sky-400 px-4 text-sm font-bold text-slate-950 transition-colors duration-200 hover:bg-sky-300 cursor-pointer"
            >
              <PlayCircle className="h-4 w-4" />
              {game?.isFinal ? 'Review game' : game ? 'Game day' : 'Schedule'}
            </button>
            <button
              type="button"
              onClick={() => onTabChange('roster')}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 text-sm font-bold text-white transition-colors duration-200 hover:bg-white/15 cursor-pointer"
            >
              <UserCheck className="h-4 w-4" />
              Roster
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CoachMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-white/45">{label}</p>
    </div>
  )
}

function CommandStat({ icon: Icon, label, value, tone = 'neutral' }: {
  icon: LucideIcon
  label: string
  value: number
  tone?: 'neutral' | 'warning' | 'success'
}) {
  const toneClasses = {
    neutral: 'border-stone-200 bg-white text-stone-500',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  }

  return (
    <div className="rounded-2xl border border-stone-200/70 bg-white/80 p-3 shadow-sm lg:p-4">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl border ${toneClasses[tone]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="text-2xl font-bold leading-none text-slate-950 tabular-nums">
        <AnimatedCounter value={value} duration={0.6} />
      </div>
      <div className="mt-2 text-xs font-semibold leading-tight text-stone-500">{label}</div>
    </div>
  )
}

function AttentionRow({ item, onTabChange }: { item: AttentionItem; onTabChange: (tab: string) => void }) {
  const toneClasses = {
    warning: 'border-amber-200 bg-amber-50/70 text-amber-700',
    neutral: 'border-stone-200 bg-white/80 text-stone-600',
    success: 'border-emerald-200 bg-emerald-50/70 text-emerald-700',
  }

  return (
    <button
      type="button"
      onClick={() => onTabChange(item.tab)}
      className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-stone-200/80 bg-white/75 px-4 py-3 text-left transition-colors duration-200 hover:bg-white cursor-pointer"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${toneClasses[item.tone]}`}>
        {item.tone === 'warning' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-950">{item.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-stone-500">{item.detail}</p>
      </div>
      <div className="flex items-center gap-2 text-xs font-semibold text-stone-500">
        <span className="hidden sm:inline">{item.action}</span>
        <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
      </div>
    </button>
  )
}

function OperationalEmptyState({ icon: Icon, title, description, actionLabel, onAction }: {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/50 px-5 py-6">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-200 bg-white text-stone-500 shadow-sm">
          <Icon className="w-5 h-5" />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-stone-500">{description}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-slate-950 px-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800 cursor-pointer"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}

function WeekStrip({ weekDays, games, practices }: {
  weekDays: { label: string; date: string }[]
  games: Game[]
  practices: Practice[]
}) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {weekDays.map((day) => {
        const dayGames = games.filter((g) => isSameDay(g.startTime, day.date))
        const dayPractices = practices.filter((p) => isSameDay(p.startTime, day.date))
        const total = dayGames.length + dayPractices.length
        const isToday = isSameDay(new Date().toISOString(), day.date)

        return (
          <div
            key={day.date}
            className={`min-h-16 rounded-xl border px-1 py-2 text-center ${
              isToday
                ? 'border-slate-900 bg-slate-950 text-white'
                : total
                  ? 'border-stone-200 bg-white text-slate-900'
                  : 'border-stone-200/70 bg-white/50 text-stone-400'
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wide">{day.label.slice(0, 3)}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{new Date(day.date).getDate()}</p>
            <div className="mt-1 flex h-4 items-center justify-center">
              {total > 0 ? (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                  isToday ? 'bg-white/15 text-white' : 'bg-stone-100 text-stone-600'
                }`}>
                  {total}
                </span>
              ) : (
                <span className={`h-1 w-1 rounded-full ${isToday ? 'bg-white/40' : 'bg-stone-300/70'}`} />
              )}
            </div>
          </div>
        )
      })}
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
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border border-stone-200/40"
        style={{
          background: 'linear-gradient(145deg, rgba(249,250,251,0.9), rgba(243,244,246,0.5))',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)',
        }}
      >
        <Icon className="w-4 h-4 text-stone-500" />
      </div>
      <span className="flex-1 text-sm font-medium text-stone-700">{label}</span>
      <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-stone-400 group-hover:translate-x-0.5 transition-all duration-150 flex-shrink-0" />
    </button>
  )
}

function EmptyState({ onTabChange }: { onTabChange: (tab: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <IllustrationAthletics className="w-52 h-44 mb-2" />
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Welcome to Athletics</h2>
      <p className="text-sm text-stone-500 mb-6 text-center max-w-sm">
        Get started by adding your first sport, then create teams and schedules.
      </p>
      <button
        onClick={() => onTabChange('sports')}
        className="px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-full hover:bg-slate-800 transition-colors active:scale-[0.97]"
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
          <div key={i} className="bg-white/40 rounded-2xl h-28 border border-stone-100/50" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/40 rounded-2xl border border-stone-100/50 h-80">
            <div className="h-12 bg-stone-50/30 rounded-t-2xl" />
            <div className="p-5 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-stone-100/50" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-stone-100/50 rounded w-3/4" />
                    <div className="h-2.5 bg-stone-50/50 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white/40 rounded-2xl border border-stone-100/50 h-48" />
        </div>
        <div className="space-y-6">
          <div className="bg-white/40 rounded-2xl border border-stone-100/50 h-64" />
          <div className="bg-white/40 rounded-2xl border border-stone-100/50 h-56" />
          <div className="bg-white/40 rounded-2xl border border-stone-100/50 h-40" />
        </div>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────

function getWeekDays(_weekStartIso: string) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return {
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      date: d.toISOString(),
    }
  })
}

function isSameDay(iso1: string, iso2: string) {
  const a = new Date(iso1)
  const b = new Date(iso2)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function buildAttentionItems({
  missingVenueGames,
  scoreDueGames,
  activeCampusId,
}: {
  missingVenueGames: Game[]
  scoreDueGames: Game[]
  activeCampusId: string | null
}): AttentionItem[] {
  const items: AttentionItem[] = []

  for (const game of missingVenueGames.slice(0, 2)) {
    const vp = resolveGameViewpoint(game, activeCampusId)
    items.push({
      id: `venue-${game.id}`,
      title: `${vp.teamName} needs a game location`,
      detail: `${formatDate(game.startTime)} at ${formatTime(game.startTime)} ${vp.homeAway === 'AWAY' ? '@' : 'vs'} ${vp.opponentLabel}`,
      tone: 'warning',
      action: 'Add venue',
      tab: 'schedule',
    })
  }

  for (const game of scoreDueGames.slice(0, 2)) {
    const vp = resolveGameViewpoint(game, activeCampusId)
    items.push({
      id: `score-${game.id}`,
      title: `${vp.teamName} score is due`,
      detail: `${formatDate(game.startTime)} ${vp.homeAway === 'AWAY' ? '@' : 'vs'} ${vp.opponentLabel} has not been marked final.`,
      tone: 'warning',
      action: 'Enter score',
      tab: 'schedule',
    })
  }

  return items.slice(0, 4)
}
