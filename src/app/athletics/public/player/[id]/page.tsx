'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import {
  User,
  Trophy,
  CalendarDays,
  MapPin,
  TrendingUp,
  ArrowLeft,
  Hash,
  Ruler,
  Weight,
  GraduationCap,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────

interface StatConfig {
  statKey: string
  label: string
}

interface RosterEntry {
  id: string
  jerseyNumber: string | null
  position: string | null
  athleticTeam: {
    id: string
    name: string
    level: string
    sport: {
      id: string
      name: string
      color: string
      abbreviation: string | null
      statConfigs: StatConfig[]
    }
  }
}

interface GameStat {
  id: string
  statKey: string
  statValue: number
  roster: {
    id: string
    jerseyNumber: string | null
    position: string | null
    athleticTeam: { id: string; name: string }
  }
  game: {
    id: string
    opponentName: string
    startTime: string
    homeAway: string
    homeScore: number | null
    awayScore: number | null
    isFinal: boolean
    venue: string | null
  }
}

interface PlayerProfile {
  id: string
  firstName: string
  lastName: string
  grade: string | null
  height: string | null
  weight: string | null
  photoUrl: string | null
  bio: string | null
  rosters: RosterEntry[]
  gameStats: GameStat[]
  organization: {
    id: string
    name: string
    slug: string
    logoUrl: string | null
  }
}

type TabKey = 'summary' | 'stats' | 'gamelog'

// ── Helpers ──────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function getGameResult(game: GameStat['game']): {
  label: string
  won: boolean | null
} | null {
  if (game.homeScore == null || game.awayScore == null || !game.isFinal)
    return null
  const isHome = game.homeAway === 'HOME'
  const tied = game.homeScore === game.awayScore
  if (tied) return { label: `T ${game.homeScore}-${game.awayScore}`, won: null }
  const homeWon = game.homeScore > game.awayScore
  const won = (isHome && homeWon) || (!isHome && !homeWon)
  return {
    label: `${won ? 'W' : 'L'} ${game.homeScore}-${game.awayScore}`,
    won,
  }
}

function aggregateStats(
  gameStats: GameStat[],
  statConfigs: StatConfig[]
): Map<string, { label: string; total: number; average: number; games: number }> {
  const map = new Map<
    string,
    { label: string; total: number; average: number; games: number }
  >()
  const gamesByKey = new Map<string, Set<string>>()

  for (const config of statConfigs) {
    map.set(config.statKey, {
      label: config.label,
      total: 0,
      average: 0,
      games: 0,
    })
    gamesByKey.set(config.statKey, new Set())
  }

  for (const stat of gameStats) {
    const entry = map.get(stat.statKey)
    const gamesSet = gamesByKey.get(stat.statKey)
    if (entry && gamesSet) {
      entry.total += stat.statValue
      gamesSet.add(stat.game.id)
    }
  }

  for (const [key, entry] of map) {
    const gamesSet = gamesByKey.get(key)
    entry.games = gamesSet?.size ?? 0
    entry.average = entry.games > 0 ? entry.total / entry.games : 0
  }

  return map
}

// Group game stats by game for the game log
function groupStatsByGame(gameStats: GameStat[]): Map<string, { game: GameStat['game']; stats: Map<string, number> }> {
  const grouped = new Map<string, { game: GameStat['game']; stats: Map<string, number> }>()
  for (const stat of gameStats) {
    let entry = grouped.get(stat.game.id)
    if (!entry) {
      entry = { game: stat.game, stats: new Map() }
      grouped.set(stat.game.id, entry)
    }
    entry.stats.set(stat.statKey, stat.statValue)
  }
  return grouped
}

// ── Component ────────────────────────────────────────────────────────────

export default function PublicPlayerProfilePage() {
  const params = useParams()
  const playerId = params.id as string

  const [player, setPlayer] = useState<PlayerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('summary')

  useEffect(() => {
    async function fetchPlayer() {
      try {
        const res = await fetch(`/api/public/athletics/player/${playerId}`)
        const json = await res.json()
        if (json.ok) {
          setPlayer(json.data)
        } else {
          setError(json.error?.message || 'Player not found')
        }
      } catch {
        setError('Failed to load player profile')
      } finally {
        setLoading(false)
      }
    }
    fetchPlayer()
  }, [playerId])

  // Merge stat configs from all sports the player is on
  const statConfigs = useMemo(() => {
    if (!player) return []
    const seen = new Set<string>()
    const configs: StatConfig[] = []
    for (const roster of player.rosters ?? []) {
      for (const c of roster.athleticTeam.sport.statConfigs ?? []) {
        if (!seen.has(c.statKey)) {
          seen.add(c.statKey)
          configs.push(c)
        }
      }
    }
    return configs
  }, [player])

  // Primary roster entry (first team)
  const primaryRoster = player?.rosters?.[0]
  const sportColor = primaryRoster?.athleticTeam.sport.color ?? '#3b82f6'
  const aggregated = useMemo(
    () => (player ? aggregateStats(player.gameStats, statConfigs) : new Map()),
    [player, statConfigs]
  )
  const gameLog = useMemo(
    () => (player ? groupStatsByGame(player.gameStats) : new Map()),
    [player]
  )

  // Pick the top 4 stats for the hero highlight cards
  const heroStats = useMemo(() => {
    const entries = Array.from(aggregated.entries())
    return entries.slice(0, 4)
  }, [aggregated])

  // Count games played (unique game IDs in stats)
  const gamesPlayed = useMemo(() => {
    if (!player) return 0
    const gameIds = new Set(player.gameStats.map((s) => s.game.id))
    return gameIds.size
  }, [player])

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'summary', label: 'Summary' },
    { key: 'stats', label: 'Season Stats' },
    { key: 'gamelog', label: 'Game Log' },
  ]

  // ── Loading ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-24 h-24 bg-stone-200 rounded-full" />
          <div className="w-48 h-6 bg-stone-200 rounded" />
          <div className="w-32 h-4 bg-stone-200 rounded" />
        </div>
      </div>
    )
  }

  if (error || !player) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <User className="w-16 h-16 text-stone-300 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-stone-700 mb-2">
            Player Not Found
          </h1>
          <p className="text-sm text-stone-500">
            {error || 'This player profile could not be found.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* ── Dark Hero Banner ─────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, #0f172a 0%, #1e293b 40%, ${sportColor}22 100%)`,
        }}
      >
        {/* Ambient glow from sport color */}
        <div
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full blur-[120px] opacity-20"
          style={{ backgroundColor: sportColor }}
        />
        <div
          className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full blur-[100px] opacity-10"
          style={{ backgroundColor: sportColor }}
        />

        {/* Back link */}
        {player.organization.slug && (
          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-4">
            <a
              href={`/athletics/public/${player.organization.slug}`}
              className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {player.organization.name} Athletics
            </a>
          </div>
        )}

        {/* Hero content */}
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8">
            {/* Player photo */}
            <div className="relative flex-shrink-0">
              <div
                className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden ring-2 ring-white/10 shadow-2xl"
                style={{
                  boxShadow: `0 20px 60px ${sportColor}30`,
                }}
              >
                {player.photoUrl ? (
                  <img
                    src={player.photoUrl}
                    alt={`${player.firstName} ${player.lastName}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-5xl font-bold text-white/30"
                    style={{
                      background: `linear-gradient(135deg, ${sportColor}40 0%, ${sportColor}15 100%)`,
                    }}
                  >
                    {player.firstName[0]}
                    {player.lastName[0]}
                  </div>
                )}
              </div>
              {/* Jersey number badge */}
              {primaryRoster?.jerseyNumber && (
                <div
                  className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg ring-2 ring-slate-900"
                  style={{ backgroundColor: sportColor }}
                >
                  {primaryRoster.jerseyNumber}
                </div>
              )}
            </div>

            {/* Player info */}
            <div className="flex-1 text-center sm:text-left pb-1">
              {/* Team name + org */}
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1.5">
                {player.organization.logoUrl && (
                  <img
                    src={player.organization.logoUrl}
                    alt={player.organization.name}
                    className="w-5 h-5 rounded object-cover"
                  />
                )}
                <span className="text-sm text-white/60 font-medium">
                  {player.organization.name}
                </span>
              </div>

              {/* Player name */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight">
                {player.firstName}{' '}
                <span className="text-white/90">{player.lastName}</span>
              </h1>

              {/* Meta line */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1 mt-2 text-sm text-white/50">
                {primaryRoster?.position && (
                  <span className="font-medium text-white/70">
                    {primaryRoster.position}
                  </span>
                )}
                {primaryRoster?.jerseyNumber && (
                  <>
                    <span className="text-white/20">|</span>
                    <span>#{primaryRoster.jerseyNumber}</span>
                  </>
                )}
                {player.height && (
                  <>
                    <span className="text-white/20">|</span>
                    <span>{player.height}</span>
                  </>
                )}
                {player.weight && (
                  <>
                    <span className="text-white/20">|</span>
                    <span>{player.weight}</span>
                  </>
                )}
                {player.grade && (
                  <>
                    <span className="text-white/20">|</span>
                    <span>Grade: {player.grade}</span>
                  </>
                )}
              </div>

              {/* Teams */}
              <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                {player.rosters?.map((r) => (
                  <div key={r.id} className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: r.athleticTeam.sport.color }}
                    />
                    <span className="text-sm text-white/60">
                      {r.athleticTeam.name}{' '}
                      <span className="text-white/40">
                        {r.athleticTeam.sport.name}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero stat highlight cards */}
            {heroStats.length > 0 && (
              <div className="hidden lg:flex items-end gap-2 pb-1">
                {heroStats.map(([key, stat]) => (
                  <div
                    key={key}
                    className="w-[100px] rounded-xl px-3 py-3 text-center backdrop-blur-md"
                    style={{
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-1">
                      {stat.label}
                    </div>
                    <div className="text-2xl font-bold text-white tabular-nums">
                      {Number.isInteger(stat.total)
                        ? stat.total
                        : stat.total.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-white/30 mt-0.5">
                      {stat.average.toFixed(1)}/game
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tab bar — sits at the bottom of the hero */}
        <div className="relative z-10 border-t border-white/5">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <nav className="flex gap-0 -mb-px" aria-label="Player profile tabs">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative px-5 py-3.5 text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === tab.key
                      ? 'text-white'
                      : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.key && (
                    <span
                      className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                      style={{ backgroundColor: sportColor }}
                    />
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* ── Tab Content ──────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'summary' && (
          <SummaryTab
            player={player}
            aggregated={aggregated}
            gamesPlayed={gamesPlayed}
            sportColor={sportColor}
            statConfigs={statConfigs}
            gameLog={gameLog}
          />
        )}
        {activeTab === 'stats' && (
          <StatsTab
            aggregated={aggregated}
            gamesPlayed={gamesPlayed}
            sportColor={sportColor}
          />
        )}
        {activeTab === 'gamelog' && (
          <GameLogTab
            gameLog={gameLog}
            statConfigs={statConfigs}
            sportColor={sportColor}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-400">
        {player.organization.name} Athletics
      </footer>
    </div>
  )
}

// ── Summary Tab ──────────────────────────────────────────────────────────

function SummaryTab({
  player,
  aggregated,
  gamesPlayed,
  sportColor,
  statConfigs,
  gameLog,
}: {
  player: PlayerProfile
  aggregated: ReturnType<typeof aggregateStats>
  gamesPlayed: number
  sportColor: string
  statConfigs: StatConfig[]
  gameLog: ReturnType<typeof groupStatsByGame>
}) {
  const primaryRoster = player?.rosters?.[0]
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column: Bio + Info cards */}
      <div className="lg:col-span-2 space-y-6">
        {/* Bio */}
        {player.bio && (
          <div className="bg-white border border-stone-200 rounded-xl p-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">
              About
            </h2>
            <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line">
              {player.bio}
            </p>
          </div>
        )}

        {/* Season stats grid (mobile-friendly version of hero cards) */}
        <div className="bg-white border border-stone-200 rounded-xl p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-4">
            Season Stats
          </h2>
          {aggregated.size === 0 ? (
            <p className="text-sm text-stone-400">No stats recorded yet</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Array.from(aggregated.entries()).map(([key, stat]) => (
                <div
                  key={key}
                  className="rounded-xl p-4 text-center"
                  style={{
                    background: `linear-gradient(135deg, ${sportColor}08 0%, ${sportColor}03 100%)`,
                    border: `1px solid ${sportColor}15`,
                  }}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">
                    {stat.label}
                  </div>
                  <div
                    className="text-2xl font-bold tabular-nums"
                    style={{ color: sportColor }}
                  >
                    {Number.isInteger(stat.total)
                      ? stat.total
                      : stat.total.toFixed(1)}
                  </div>
                  <div className="text-[10px] text-stone-400 mt-0.5">
                    {stat.average.toFixed(1)} avg
                  </div>
                </div>
              ))}
              {/* Games played card */}
              <div className="rounded-xl p-4 text-center bg-stone-50 border border-stone-100">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-1">
                  Games
                </div>
                <div className="text-2xl font-bold tabular-nums text-stone-700">
                  {gamesPlayed}
                </div>
                <div className="text-[10px] text-stone-400 mt-0.5">played</div>
              </div>
            </div>
          )}
        </div>

        {/* Recent games */}
        {gameLog.size > 0 && (
          <div className="bg-white border border-stone-200 rounded-xl p-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-4">
              Recent Games
            </h2>
            <div className="space-y-2">
              {Array.from(gameLog.entries())
                .slice(0, 5)
                .map(([gameId, entry]) => {
                  const result = getGameResult(entry.game)
                  return (
                    <div
                      key={gameId}
                      className="flex items-center justify-between gap-3 py-2.5 border-b border-stone-50 last:border-0"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs text-stone-400 w-[80px] flex-shrink-0">
                          {formatDate(entry.game.startTime)}
                        </span>
                        <span className="text-sm font-medium text-stone-700 truncate">
                          {entry.game.homeAway === 'AWAY' ? '@' : 'vs'}{' '}
                          {entry.game.opponentName}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {/* Top stat for this game */}
                        {statConfigs.length > 0 && (
                          <span className="text-xs text-stone-400 tabular-nums">
                            {statConfigs
                              .slice(0, 3)
                              .map((c) => {
                                const val = entry.stats.get(c.statKey)
                                return val != null
                                  ? `${Number.isInteger(val) ? val : val.toFixed(1)} ${c.label}`
                                  : null
                              })
                              .filter(Boolean)
                              .join(' / ')}
                          </span>
                        )}
                        {result && (
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded ${
                              result.won === true
                                ? 'bg-green-50 text-green-700'
                                : result.won === false
                                  ? 'bg-red-50 text-red-700'
                                  : 'bg-stone-100 text-stone-600'
                            }`}
                          >
                            {result.label}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
      </div>

      {/* Right column: Player details card */}
      <div className="space-y-6">
        {/* Player info card */}
        <div className="bg-white border border-stone-200 rounded-xl p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-4">
            Player Info
          </h2>
          <div className="space-y-3">
            {primaryRoster?.position && (
              <InfoRow icon={User} label="Position" value={primaryRoster.position} />
            )}
            {primaryRoster?.jerseyNumber && (
              <InfoRow
                icon={Hash}
                label="Number"
                value={`#${primaryRoster.jerseyNumber}`}
              />
            )}
            {player.height && (
              <InfoRow icon={Ruler} label="Height" value={player.height} />
            )}
            {player.weight && (
              <InfoRow icon={Weight} label="Weight" value={player.weight} />
            )}
            {player.grade && (
              <InfoRow
                icon={GraduationCap}
                label="Grade"
                value={player.grade}
              />
            )}
          </div>
        </div>

        {/* Teams card */}
        <div className="bg-white border border-stone-200 rounded-xl p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">
            Teams
          </h2>
          <div className="space-y-3">
            {player.rosters?.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{
                  background: `linear-gradient(135deg, ${r.athleticTeam.sport.color}08 0%, transparent 100%)`,
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${r.athleticTeam.sport.color}15` }}
                >
                  <Trophy className="w-4 h-4" style={{ color: r.athleticTeam.sport.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-stone-800 truncate">
                    {r.athleticTeam.name}
                  </div>
                  <div className="text-xs text-stone-500">
                    {r.athleticTeam.level} {r.athleticTeam.sport.name}
                    {r.jerseyNumber && <span className="ml-1 text-stone-400">#{r.jerseyNumber}</span>}
                    {r.position && <span className="ml-1 text-stone-400">{r.position}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick numbers */}
        <div className="bg-white border border-stone-200 rounded-xl p-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-3">
            Season Overview
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-stone-50 rounded-lg">
              <div className="text-xl font-bold text-stone-800 tabular-nums">
                {gamesPlayed}
              </div>
              <div className="text-[10px] text-stone-400 uppercase tracking-wider mt-0.5">
                Games
              </div>
            </div>
            <div className="text-center p-3 bg-stone-50 rounded-lg">
              <div className="text-xl font-bold text-stone-800 tabular-nums">
                {aggregated.size}
              </div>
              <div className="text-[10px] text-stone-400 uppercase tracking-wider mt-0.5">
                Categories
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Stats Tab ────────────────────────────────────────────────────────────

function StatsTab({
  aggregated,
  gamesPlayed,
  sportColor,
}: {
  aggregated: ReturnType<typeof aggregateStats>
  gamesPlayed: number
  sportColor: string
}) {
  if (aggregated.size === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-12 text-center">
        <TrendingUp className="w-12 h-12 text-stone-300 mx-auto mb-3" />
        <p className="text-sm text-stone-500">No stats recorded yet</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-stone-100">
            <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-stone-400">
              Stat
            </th>
            <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-stone-400">
              Total
            </th>
            <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-stone-400">
              Per Game
            </th>
            <th className="px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-stone-400">
              Games
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-50">
          {Array.from(aggregated.entries()).map(([key, stat]) => (
            <tr key={key} className="hover:bg-stone-50/50 transition-colors">
              <td className="px-6 py-3.5 text-sm font-medium text-stone-800">
                {stat.label}
              </td>
              <td className="px-6 py-3.5 text-right tabular-nums">
                <span
                  className="text-lg font-bold"
                  style={{ color: sportColor }}
                >
                  {Number.isInteger(stat.total)
                    ? stat.total
                    : stat.total.toFixed(1)}
                </span>
              </td>
              <td className="px-6 py-3.5 text-right text-sm text-stone-600 tabular-nums">
                {stat.average.toFixed(1)}
              </td>
              <td className="px-6 py-3.5 text-right text-sm text-stone-400 tabular-nums">
                {stat.games}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Game Log Tab ─────────────────────────────────────────────────────────

function GameLogTab({
  gameLog,
  statConfigs,
  sportColor,
}: {
  gameLog: ReturnType<typeof groupStatsByGame>
  statConfigs: StatConfig[]
  sportColor: string
}) {
  if (gameLog.size === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-xl p-12 text-center">
        <CalendarDays className="w-12 h-12 text-stone-300 mx-auto mb-3" />
        <p className="text-sm text-stone-500">No game stats recorded yet</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-stone-100">
            <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-stone-400 whitespace-nowrap sticky left-0 bg-white">
              Date
            </th>
            <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-stone-400 whitespace-nowrap">
              Opponent
            </th>
            <th className="px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-stone-400 whitespace-nowrap">
              Result
            </th>
            {statConfigs.map((config) => (
              <th
                key={config.statKey}
                className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-stone-400 whitespace-nowrap"
              >
                {config.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-50">
          {Array.from(gameLog.entries()).map(([gameId, entry]) => {
            const result = getGameResult(entry.game)
            return (
              <tr
                key={gameId}
                className="hover:bg-stone-50/50 transition-colors"
              >
                <td className="px-4 py-3 text-xs text-stone-500 whitespace-nowrap sticky left-0 bg-white">
                  {formatDate(entry.game.startTime)}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-stone-700 whitespace-nowrap">
                  <span className="text-stone-400 mr-1">
                    {entry.game.homeAway === 'AWAY' ? '@' : 'vs'}
                  </span>
                  {entry.game.opponentName}
                </td>
                <td className="px-4 py-3 text-center whitespace-nowrap">
                  {result ? (
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        result.won === true
                          ? 'bg-green-50 text-green-700'
                          : result.won === false
                            ? 'bg-red-50 text-red-700'
                            : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {result.label}
                    </span>
                  ) : (
                    <span className="text-xs text-stone-300">--</span>
                  )}
                </td>
                {statConfigs.map((config) => {
                  const val = entry.stats.get(config.statKey)
                  return (
                    <td
                      key={config.statKey}
                      className="px-4 py-3 text-right text-sm tabular-nums"
                      style={{
                        color: val != null ? sportColor : undefined,
                        fontWeight: val != null ? 600 : 400,
                      }}
                    >
                      {val != null
                        ? Number.isInteger(val)
                          ? val
                          : val.toFixed(1)
                        : '--'}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Shared Components ────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 text-stone-400 flex-shrink-0" />
      <span className="text-xs text-stone-400 w-16">{label}</span>
      <span className="text-sm font-medium text-stone-700">{value}</span>
    </div>
  )
}
