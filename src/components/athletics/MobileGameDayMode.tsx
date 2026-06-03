'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { BarChart3, ClipboardList, ChevronRight, Clock, Home, MapPin, Minus, Play, Plus, RotateCcw, Shield, Sparkles, Trophy, Users, X, type LucideIcon } from 'lucide-react'
import { getAuthHeaders } from '@/lib/api-client'
import { handleAuthResponse } from '@/lib/client-auth'
import { getSportProfile, type SportAction } from '@/lib/athletics/sportProfiles'
import { useToast } from '@/components/Toast'

interface TeamSummary {
  id: string
  name: string
  sport: { name: string; color: string }
}

interface Game {
  id: string
  athleticTeamId: string
  opponentName: string
  homeAway: string
  startTime: string
  endTime: string
  venue: string | null
  homeScore: number | null
  awayScore: number | null
  isFinal: boolean
  athleticTeam?: TeamSummary
}

interface GameViewpoint {
  side: 'owning' | 'opponent'
  team: TeamSummary | undefined
  opponentLabel: string
  homeAway: 'HOME' | 'AWAY' | 'NEUTRAL'
  scoreDisplay: string | null
}

interface RosterPlayer {
  id: string
  athleteId: string
  firstName: string
  lastName: string
  jerseyNumber: string | null
  position?: string | null
  photoUrl?: string | null
}

interface AthleteRosterResponse {
  id: string
  firstName: string
  lastName: string
  photoUrl?: string | null
  rosters?: Array<{
    id: string
    athleteId: string
    athleticTeamId: string
    jerseyNumber: string | null
    position?: string | null
    isActive: boolean
  }>
}

interface ExistingStat {
  rosterId: string
  statKey: string
  statValue: number
}

interface MobileGameDayModeProps {
  game: Game | null
  viewpoint: GameViewpoint | null
  canWrite: boolean
  onCreateGame: () => void
  onEdit?: () => void
  onScore?: () => void
  onPlayerStats?: () => void
  onSaved: () => void
  presentation?: 'card' | 'fullscreen'
  onExitFullScreen?: () => void
}

type BaseballBaseKey = 'first' | 'second' | 'third'

type BaseballBases = Record<BaseballBaseKey, RosterPlayer | null>
type GameDayMode = 'home' | 'scoring' | 'field' | 'lineup' | 'stats' | 'sheet'

interface PlayLogEntry {
  id: string
  inning: number
  halfInning: 'top' | 'bottom'
  batterName: string
  result: string
  runs: number
  outs: number
  basesAfter: BaseballBases
}

interface PersistedGameState {
  currentPlayerIndex?: number
  balls?: number
  strikes?: number
  outs?: number
  pitchCount?: number
  errors?: number
  inning?: number
  halfInning?: 'top' | 'bottom'
  bases?: BaseballBases
  playLog?: PlayLogEntry[]
  lineup?: RosterPlayer[]
  lastPlay?: string
  hasLaunchedGameDay?: boolean
}

interface GameDaySessionResponse {
  status: 'NOT_STARTED' | 'LIVE' | 'PAUSED' | 'FINAL'
  currentPeriod: number
  periodLabel: string | null
  lineup: unknown
  gameState: unknown
  playLog: unknown
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function sideWasHome(game: Game, viewpoint: GameViewpoint): boolean {
  if (viewpoint.homeAway === 'NEUTRAL') return false
  return viewpoint.homeAway === 'HOME'
}

function getScoreParts(game: Game, viewpoint: GameViewpoint) {
  const homeScore = game.homeScore ?? 0
  const awayScore = game.awayScore ?? 0
  const ourIsHome = sideWasHome(game, viewpoint)
  return {
    homeScore,
    awayScore,
    ourScore: ourIsHome ? homeScore : awayScore,
    opponentScore: ourIsHome ? awayScore : homeScore,
    ourIsHome,
  }
}

function ordinal(value: number): string {
  if (value % 100 >= 11 && value % 100 <= 13) return `${value}th`
  if (value % 10 === 1) return `${value}st`
  if (value % 10 === 2) return `${value}nd`
  if (value % 10 === 3) return `${value}rd`
  return `${value}th`
}

function playerLabel(player: RosterPlayer): string {
  return `${player.jerseyNumber ? `#${player.jerseyNumber} ` : ''}${player.firstName} ${player.lastName}`.trim()
}

async function fetchWithCsrfRetry(url: string, init: RequestInit): Promise<Response> {
  const doFetch = () =>
    fetch(url, {
      ...init,
      credentials: 'include',
      headers: { ...getAuthHeaders(), ...init.headers },
    })

  let res = await doFetch()
  if (res.status !== 403) return res

  try {
    const data = await res.clone().json()
    if (data?.error?.code === 'CSRF_REQUIRED') {
      res = await doFetch()
    }
  } catch {
    // Keep the original 403 response if it was not the JSON CSRF handshake.
  }

  return res
}

function Fireworks({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 2200)
    return () => window.clearTimeout(timer)
  }, [onDone])

  return (
    <div className="pointer-events-none fixed inset-0 z-[1000] overflow-hidden">
      <div className="absolute inset-0 bg-slate-950/10 backdrop-blur-[1px]" />
      {Array.from({ length: 18 }).map((_, index) => (
        <motion.span
          key={index}
          className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-cyan-300"
          initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
          animate={{
            x: Math.cos(index) * (70 + (index % 5) * 18),
            y: Math.sin(index * 1.7) * (70 + (index % 4) * 16),
            scale: [0.4, 1.2, 0],
            opacity: [0, 1, 0],
          }}
          transition={{ duration: 1.1, delay: (index % 6) * 0.04, ease: 'easeOut' }}
        />
      ))}
      <motion.div
        className="absolute inset-x-6 top-[35%] rounded-3xl border border-white/15 bg-slate-950/90 px-5 py-4 text-center text-white shadow-2xl backdrop-blur"
        initial={{ y: 18, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -12, opacity: 0 }}
      >
        <Sparkles className="mx-auto mb-2 h-5 w-5 text-cyan-200" />
        <p className="text-lg font-bold">{message}</p>
      </motion.div>
    </div>
  )
}

function FlipScoreNumber({
  value,
  tone,
  reduceMotion,
}: {
  value: number
  tone: 'home' | 'away'
  reduceMotion: boolean | null
}) {
  const glow = tone === 'home' ? 'text-sky-100 drop-shadow-[0_0_18px_rgba(56,189,248,0.55)]' : 'text-fuchsia-100 drop-shadow-[0_0_18px_rgba(217,70,239,0.55)]'
  const border = tone === 'home' ? 'border-sky-300/20 bg-sky-300/[0.07]' : 'border-fuchsia-300/20 bg-fuchsia-300/[0.07]'

  return (
    <span className={`relative inline-flex min-w-[88px] justify-center overflow-hidden rounded-2xl border ${border} px-3 py-1 tabular-nums`}>
      <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white/10" />
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          className={`font-black leading-none ${glow}`}
          initial={reduceMotion ? false : { y: -28, rotateX: 76, opacity: 0 }}
          animate={{ y: 0, rotateX: 0, opacity: 1 }}
          exit={reduceMotion ? undefined : { y: 28, rotateX: -76, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

function CountDots({ label, count, max, tone }: { label: string; count: number; max: number; tone: 'green' | 'pink' | 'amber' }) {
  const active = {
    green: 'bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.55)]',
    pink: 'bg-fuchsia-300 shadow-[0_0_12px_rgba(240,171,252,0.55)]',
    amber: 'bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.55)]',
  }[tone]

  return (
    <div className="rounded-2xl bg-white/[0.06] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">{label}</p>
        <span className="text-xs font-black tabular-nums text-white/85">{count}</span>
      </div>
      <div className="mt-2 flex gap-1.5">
        {Array.from({ length: max }).map((_, index) => (
          <span
            key={index}
            className={`h-2.5 flex-1 rounded-full ${index < count ? active : 'bg-white/20'}`}
          />
        ))}
      </div>
    </div>
  )
}

function BaseballDiamond({ bases }: { bases: BaseballBases }) {
  return (
    <div className="relative mx-auto h-24 w-24">
      <div className="absolute inset-4 rotate-45 rounded-sm border-2 border-sky-100/35 bg-white/[0.03]" />
      <span className={`absolute left-1/2 top-2 h-4 w-4 -translate-x-1/2 rotate-45 rounded-sm ${bases.second ? 'bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.75)]' : 'bg-white/18'}`} title={bases.second ? playerLabel(bases.second) : 'Second base empty'} />
      <span className={`absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 rounded-sm ${bases.first ? 'bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.75)]' : 'bg-white/18'}`} title={bases.first ? playerLabel(bases.first) : 'First base empty'} />
      <span className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 rounded-sm ${bases.third ? 'bg-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.75)]' : 'bg-white/18'}`} title={bases.third ? playerLabel(bases.third) : 'Third base empty'} />
      <span className="absolute bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 rounded-sm bg-white/30" />
    </div>
  )
}

function actionTone(action: SportAction): string {
  if (action.key === 'hr') return 'border-amber-200/50 bg-amber-300 text-slate-950 shadow-[0_0_22px_rgba(252,211,77,0.28)]'
  if (action.key === 'out') return 'border-red-300/30 bg-red-400/20 text-red-50'
  if (action.key === 'strikeout') return 'border-fuchsia-300/35 bg-fuchsia-400/20 text-fuchsia-50'
  if (action.key === 'walk') return 'border-amber-200/35 bg-amber-300/18 text-amber-50'
  if (['single', 'double', 'triple'].includes(action.key)) return 'border-sky-200/35 bg-sky-300/16 text-sky-50'
  return action.celebration ? 'border-cyan-200/50 bg-cyan-300 text-slate-950' : 'border-white/10 bg-white/[0.08] text-white'
}

function emptyBases(): BaseballBases {
  return { first: null, second: null, third: null }
}

function countOccupiedBases(bases: BaseballBases): number {
  return [bases.first, bases.second, bases.third].filter(Boolean).length
}

function makeOpponentRunner(label: string): RosterPlayer {
  return {
    id: `opponent-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    athleteId: 'opponent',
    firstName: label,
    lastName: '',
    jerseyNumber: null,
  }
}

function reconcileLineup(currentLineup: RosterPlayer[], rosterList: RosterPlayer[]): RosterPlayer[] {
  if (!rosterList.length) return []

  const rosterById = new Map(rosterList.map((player) => [player.id, player]))
  const seen = new Set<string>()
  const activeLineup = currentLineup
    .map((player) => rosterById.get(player.id))
    .filter((player): player is RosterPlayer => Boolean(player))
    .filter((player) => {
      if (seen.has(player.id)) return false
      seen.add(player.id)
      return true
    })

  const newPlayers = rosterList.filter((player) => !seen.has(player.id))
  return [...activeLineup, ...newPlayers]
}

const BASEBALL_POSITIONS = [
  { key: 'P', label: 'Pitcher', x: 50, y: 53 },
  { key: 'C', label: 'Catcher', x: 50, y: 82 },
  { key: '1B', label: 'First base', x: 72, y: 58 },
  { key: '2B', label: 'Second base', x: 60, y: 38 },
  { key: 'SS', label: 'Shortstop', x: 38, y: 38 },
  { key: '3B', label: 'Third base', x: 28, y: 58 },
  { key: 'LF', label: 'Left field', x: 20, y: 18 },
  { key: 'CF', label: 'Center field', x: 50, y: 12 },
  { key: 'RF', label: 'Right field', x: 80, y: 18 },
] as const

function normalizePosition(position?: string | null): string | null {
  if (!position) return null
  const value = position.trim().toUpperCase()
  const aliases: Record<string, string> = {
    PITCHER: 'P',
    CATCHER: 'C',
    FIRST: '1B',
    'FIRST BASE': '1B',
    SECOND: '2B',
    'SECOND BASE': '2B',
    SHORTSTOP: 'SS',
    THIRD: '3B',
    'THIRD BASE': '3B',
    LEFT: 'LF',
    'LEFT FIELD': 'LF',
    CENTER: 'CF',
    'CENTER FIELD': 'CF',
    RIGHT: 'RF',
    'RIGHT FIELD': 'RF',
  }
  return aliases[value] ?? value
}

export default function MobileGameDayMode({
  game,
  viewpoint,
  canWrite,
  onCreateGame,
  onEdit,
  onScore,
  onPlayerStats,
  onSaved,
  presentation = 'card',
  onExitFullScreen,
}: MobileGameDayModeProps) {
  const { toast } = useToast()
  const [roster, setRoster] = useState<RosterPlayer[]>([])
  const [lineup, setLineup] = useState<RosterPlayer[]>([])
  const [stats, setStats] = useState<Record<string, Record<string, number>>>({})
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [balls, setBalls] = useState(0)
  const [strikes, setStrikes] = useState(0)
  const [outs, setOuts] = useState(0)
  const [pitchCount, setPitchCount] = useState(0)
  const [errors, setErrors] = useState(0)
  const [inning, setInning] = useState(1)
  const [halfInning, setHalfInning] = useState<'top' | 'bottom'>('top')
  const [saving, setSaving] = useState(false)
  const [celebration, setCelebration] = useState<string | null>(null)
  const [lastScore, setLastScore] = useState<{ homeScore: number; awayScore: number } | null>(null)
  const [liveScore, setLiveScore] = useState<{ homeScore: number; awayScore: number } | null>(null)
  const [liveIsFinal, setLiveIsFinal] = useState(false)
  const [lastPlay, setLastPlay] = useState('')
  const [bases, setBases] = useState<BaseballBases>(() => emptyBases())
  const [playLog, setPlayLog] = useState<PlayLogEntry[]>([])
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [isFullScreenClosing, setIsFullScreenClosing] = useState(false)
  const [hasLaunchedGameDay, setHasLaunchedGameDay] = useState(false)
  const [gameDayMode, setGameDayMode] = useState<GameDayMode>('home')
  const [betweenInnings, setBetweenInnings] = useState(false)
  const [substitutionOpen, setSubstitutionOpen] = useState(false)
  const [substitutionSlotIndex, setSubstitutionSlotIndex] = useState(0)
  const [errorDrawerOpen, setErrorDrawerOpen] = useState(false)
  const [fielderDrawerOpen, setFielderDrawerOpen] = useState(false)
  const [selectedFielderId, setSelectedFielderId] = useState<string | null>(null)
  const [gameDayLoaded, setGameDayLoaded] = useState(false)
  const halfInningAdvancePendingRef = useRef(false)
  const halfInningTimerRef = useRef<number | null>(null)
  const outsRef = useRef(0)
  const inningRef = useRef(1)
  const halfInningRef = useRef<'top' | 'bottom'>('top')
  const basesRef = useRef<BaseballBases>(emptyBases())
  const playLogRef = useRef<PlayLogEntry[]>([])
  const lineupRef = useRef<RosterPlayer[]>([])
  const autosaveTimerRef = useRef<number | null>(null)
  const shouldReduceMotion = useReducedMotion()

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  const sportName = viewpoint?.team?.sport?.name ?? game?.athleticTeam?.sport?.name
  const profile = useMemo(() => getSportProfile(sportName), [sportName])
  const battingOrder = lineup.length ? lineup : roster
  const currentPlayer = battingOrder[currentPlayerIndex] ?? null
  const isExpanded = presentation === 'fullscreen'
  const launchStorageKey = game ? `athletics-game-day-launched:${game.id}` : null
  const gameStateStorageKey = game ? `athletics-game-state:${game.id}` : null
  const currentPlayerStats = currentPlayer ? stats[currentPlayer.id] ?? {} : {}
  const fieldAssignments = useMemo(() => {
    const assigned = new Map<string, RosterPlayer>()
    const remaining = [...roster]
    for (const player of roster) {
      const position = normalizePosition(player.position)
      if (!position || assigned.has(position)) continue
      assigned.set(position, player)
      const index = remaining.findIndex((item) => item.id === player.id)
      if (index >= 0) remaining.splice(index, 1)
    }
    for (const position of BASEBALL_POSITIONS) {
      if (assigned.has(position.key)) continue
      const next = remaining.shift()
      if (next) assigned.set(position.key, next)
    }
    return assigned
  }, [roster])
  const selectedFielder = selectedFielderId
    ? roster.find((player) => player.id === selectedFielderId) ?? null
    : fieldAssignments.get('P') ?? roster[0] ?? null

  const syncLineup = useCallback((nextLineup: RosterPlayer[]) => {
    lineupRef.current = nextLineup
    setLineup(nextLineup)
  }, [])

  useEffect(() => {
    if (!launchStorageKey || typeof window === 'undefined') return
    setHasLaunchedGameDay(sessionStorage.getItem(launchStorageKey) === 'true')
  }, [launchStorageKey])

  useEffect(() => {
    if (!game) return
    setLiveScore({
      homeScore: game.homeScore ?? 0,
      awayScore: game.awayScore ?? 0,
    })
    setLiveIsFinal(game.isFinal)
  }, [game])

  const applyPersistedState = useCallback((saved: PersistedGameState) => {
    if (Number.isFinite(saved.currentPlayerIndex)) setCurrentPlayerIndex(saved.currentPlayerIndex ?? 0)
    if (Number.isFinite(saved.balls)) setBalls(saved.balls ?? 0)
    if (Number.isFinite(saved.strikes)) setStrikes(saved.strikes ?? 0)
    if (Number.isFinite(saved.pitchCount)) setPitchCount(saved.pitchCount ?? 0)
    if (Number.isFinite(saved.errors)) setErrors(saved.errors ?? 0)
    if (typeof saved.lastPlay === 'string') setLastPlay(saved.lastPlay)
    if (saved.hasLaunchedGameDay) setHasLaunchedGameDay(true)
    if (Number.isFinite(saved.outs)) {
      outsRef.current = saved.outs ?? 0
      setOuts(saved.outs ?? 0)
    }
    if (Number.isFinite(saved.inning)) {
      inningRef.current = saved.inning ?? 1
      setInning(saved.inning ?? 1)
    }
    if (saved.halfInning === 'top' || saved.halfInning === 'bottom') {
      halfInningRef.current = saved.halfInning
      setHalfInning(saved.halfInning)
    }
    if (saved.bases) {
      basesRef.current = saved.bases
      setBases(saved.bases)
    }
    if (Array.isArray(saved.playLog)) {
      playLogRef.current = saved.playLog
      setPlayLog(saved.playLog)
    }
    if (Array.isArray(saved.lineup)) {
      syncLineup(saved.lineup)
    }
  }, [syncLineup])

  useEffect(() => {
    if (!game || !token || !gameStateStorageKey) return
    let cancelled = false
    setGameDayLoaded(false)

    const loadGameDaySession = async () => {
      try {
        const res = await fetchWithCsrfRetry(`/api/athletics/games/${game.id}/game-day`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (handleAuthResponse(res) || cancelled) return
        const data = await res.json()
        if (data.ok && data.data) {
          const session = data.data as GameDaySessionResponse
          if (session.status === 'LIVE' || session.status === 'FINAL') setHasLaunchedGameDay(true)
          if (session.status === 'FINAL') setLiveIsFinal(true)
          if (Number.isFinite(session.currentPeriod)) {
            inningRef.current = session.currentPeriod
            setInning(session.currentPeriod)
          }
          if (session.gameState && typeof session.gameState === 'object') {
            applyPersistedState(session.gameState as PersistedGameState)
          }
          if (Array.isArray(session.lineup)) syncLineup(session.lineup as RosterPlayer[])
          if (Array.isArray(session.playLog)) {
            playLogRef.current = session.playLog as PlayLogEntry[]
            setPlayLog(playLogRef.current)
          }
        } else {
          const raw = sessionStorage.getItem(gameStateStorageKey)
          if (raw) applyPersistedState(JSON.parse(raw) as PersistedGameState)
        }
      } catch {
        try {
          const raw = sessionStorage.getItem(gameStateStorageKey)
          if (raw) applyPersistedState(JSON.parse(raw) as PersistedGameState)
        } catch {
          sessionStorage.removeItem(gameStateStorageKey)
        }
      } finally {
        if (!cancelled) setGameDayLoaded(true)
      }
    }

    loadGameDaySession()
    return () => {
      cancelled = true
    }
  }, [applyPersistedState, game, gameStateStorageKey, syncLineup, token])

  useEffect(() => {
    if (!game || !token || !gameStateStorageKey || !gameDayLoaded || typeof window === 'undefined') return
    const persistedState: PersistedGameState = {
      currentPlayerIndex,
      balls,
      strikes,
      outs,
      pitchCount,
      errors,
      inning,
      halfInning,
      bases,
      playLog,
      lineup,
      lastPlay,
      hasLaunchedGameDay,
    }
    sessionStorage.setItem(gameStateStorageKey, JSON.stringify(persistedState))

    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = window.setTimeout(async () => {
      const status = liveIsFinal ? 'FINAL' : hasLaunchedGameDay ? 'LIVE' : 'NOT_STARTED'
      try {
        await fetchWithCsrfRetry(`/api/athletics/games/${game.id}/game-day`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            status,
            currentPeriod: inning,
            periodLabel: profile.kind === 'baseball'
              ? `${halfInning === 'top' ? 'Top' : 'Bottom'} ${ordinal(inning)}`
              : `${profile.periodLabel} ${inning}`,
            lineup,
            playLog,
            gameState: persistedState,
          }),
        })
      } catch {
        // Local session storage remains as a fallback if the court/field has a bad connection.
      }
    }, 700)

    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current)
    }
  }, [balls, bases, currentPlayerIndex, errors, game, gameDayLoaded, gameStateStorageKey, halfInning, hasLaunchedGameDay, inning, lastPlay, lineup, liveIsFinal, outs, pitchCount, playLog, profile.kind, profile.periodLabel, strikes, token])

  useEffect(() => {
    if (!isFullScreen && !isExpanded) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isFullScreen, isExpanded])

  useEffect(() => {
    if (!game || !token) return

    const fetchRosterAndStats = async () => {
      try {
        const [rosterRes, statsRes] = await Promise.all([
          fetch(`/api/athletics/roster?teamId=${game.athleticTeamId}&isActive=true`, {
            credentials: 'include',
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/athletics/games/${game.id}/stats`, {
            credentials: 'include',
            headers: { Authorization: `Bearer ${token}` },
          }),
        ])

        if (handleAuthResponse(rosterRes) || handleAuthResponse(statsRes)) return

        const [rosterData, statsData] = await Promise.all([rosterRes.json(), statsRes.json()])
        const rosterList: RosterPlayer[] = rosterData.ok
          ? (rosterData.data as AthleteRosterResponse[])
            .map((athlete): RosterPlayer | null => {
              const teamRoster = athlete.rosters?.find((item) => item.athleticTeamId === game.athleticTeamId && item.isActive)
              if (!teamRoster) return null
              return {
                id: teamRoster.id,
                athleteId: athlete.id,
                firstName: athlete.firstName,
                lastName: athlete.lastName,
                jerseyNumber: teamRoster.jerseyNumber,
                position: teamRoster.position ?? null,
                photoUrl: athlete.photoUrl ?? null,
              }
            })
            .filter((player): player is RosterPlayer => player !== null)
          : []

        const nextStats: Record<string, Record<string, number>> = {}
        if (statsData.ok) {
          for (const stat of statsData.data as ExistingStat[]) {
            nextStats[stat.rosterId] = {
              ...(nextStats[stat.rosterId] ?? {}),
              [stat.statKey]: stat.statValue,
            }
          }
        }

        setRoster(rosterList)
        syncLineup(reconcileLineup(lineupRef.current, rosterList))
        setStats(nextStats)
      } catch {
        toast('Could not load roster for game day', 'warning')
      }
    }

    fetchRosterAndStats()
  }, [game, syncLineup, token, toast])

  useEffect(() => {
    if (!battingOrder.length || currentPlayerIndex < battingOrder.length) return
    setCurrentPlayerIndex(0)
  }, [battingOrder.length, currentPlayerIndex])

  const nextHalfInning = useCallback(() => {
    if (halfInningTimerRef.current) {
      window.clearTimeout(halfInningTimerRef.current)
      halfInningTimerRef.current = null
    }
    halfInningAdvancePendingRef.current = false
    setBetweenInnings(false)
    outsRef.current = 0
    const nextHalf = halfInningRef.current === 'top' ? 'bottom' : 'top'
    const nextInning = halfInningRef.current === 'top' ? inningRef.current : inningRef.current + 1
    halfInningRef.current = nextHalf
    inningRef.current = nextInning
    setHalfInning(nextHalf)
    setInning(nextInning)
    setLastPlay(`${nextHalf === 'top' ? 'Top' : 'Bottom'} ${ordinal(nextInning)}`)
    setBalls(0)
    setStrikes(0)
    setOuts(0)
    basesRef.current = emptyBases()
    setBases(emptyBases())
  }, [])

  const queueHalfInningAdvance = useCallback(() => {
    if (halfInningAdvancePendingRef.current) return
    halfInningAdvancePendingRef.current = true
    setBetweenInnings(true)
    setGameDayMode('home')
    setLastPlay('3 outs. Review, make changes, then start next half.')
  }, [])

  const requestHalfInningChange = useCallback(() => {
    if (betweenInnings) {
      nextHalfInning()
      return
    }
    halfInningAdvancePendingRef.current = true
    setBetweenInnings(true)
    setGameDayMode('home')
    setLastPlay('Ready to end this half. Review, then start next half.')
  }, [betweenInnings, nextHalfInning])

  const advancePeriod = useCallback(() => {
    const next = inningRef.current + 1
    inningRef.current = next
    setInning(next)
    setLastPlay(`${profile.periodLabel} ${next}`)
  }, [profile.periodLabel])

  useEffect(() => {
    return () => {
      if (halfInningTimerRef.current) window.clearTimeout(halfInningTimerRef.current)
    }
  }, [])

  if (!game || !viewpoint) {
    return (
      <section className="lg:hidden mb-5 rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-400">Coach game day</p>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">No game today</h2>
        <p className="mt-2 text-base leading-snug text-stone-500">
          When a game is scheduled, the details and scoring tools will show here.
        </p>
        {canWrite && (
          <button
            type="button"
            onClick={onCreateGame}
            className="mt-5 min-h-12 w-full rounded-2xl bg-slate-950 px-5 text-base font-semibold text-white transition-colors duration-200 hover:bg-slate-800 active:scale-[0.98] cursor-pointer"
          >
            Schedule game
          </button>
        )}
      </section>
    )
  }

  const displayGame: Game = {
    ...game,
    homeScore: liveScore?.homeScore ?? game.homeScore,
    awayScore: liveScore?.awayScore ?? game.awayScore,
    isFinal: liveIsFinal,
  }
  const { homeScore, awayScore, ourScore, opponentScore, ourIsHome } = getScoreParts(displayGame, viewpoint)
  const isOurAtBat = profile.kind === 'baseball'
    ? (ourIsHome ? halfInning === 'bottom' : halfInning === 'top')
    : true
  const isPast = new Date(game.endTime).getTime() < Date.now()
  const missingVenue = !game.venue?.trim()
  const scoreDue = isPast && !liveIsFinal
  const scoringLocked = liveIsFinal
  const scoreKey = `${ourScore}-${opponentScore}`
  const occupiedBases = countOccupiedBases(bases)
  const baseSummary = occupiedBases
    ? [
      bases.first ? `1B ${bases.first.jerseyNumber ? `#${bases.first.jerseyNumber}` : bases.first.firstName}` : null,
      bases.second ? `2B ${bases.second.jerseyNumber ? `#${bases.second.jerseyNumber}` : bases.second.firstName}` : null,
      bases.third ? `3B ${bases.third.jerseyNumber ? `#${bases.third.jerseyNumber}` : bases.third.firstName}` : null,
    ].filter(Boolean).join(' · ')
    : 'Bases empty'
  const halfInningMode = profile.kind === 'baseball'
    ? isOurAtBat
      ? 'Batting'
      : 'Fielding'
    : `${profile.periodLabel} mode`
  const substitutionSlotPlayer = battingOrder[substitutionSlotIndex] ?? null
  const pressMotion = shouldReduceMotion
    ? {}
    : {
      whileHover: { y: -1 },
      whileTap: { scale: 0.98 },
      transition: { type: 'spring' as const, stiffness: 460, damping: 34 },
    }
  const gameDayModes: Array<{ key: GameDayMode; label: string; icon: LucideIcon }> = [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'scoring', label: 'Scoring', icon: Trophy },
    ...(profile.kind === 'baseball' ? [{ key: 'field' as const, label: 'Field', icon: Shield }] : []),
    { key: 'lineup', label: profile.gameStructure === 'events' ? 'Results' : 'Lineup', icon: Users },
    { key: 'stats', label: 'Stats', icon: BarChart3 },
    { key: 'sheet', label: 'Sheet', icon: ClipboardList },
  ]
  const activeGameDayModeIndex = Math.max(0, gameDayModes.findIndex((mode) => mode.key === gameDayMode))
  const opponentScoreActions = profile.quickActions
    .filter((action) => typeof action.scoreDelta === 'number' && action.scoreDelta > 0)
    .slice(0, 6)

  const saveScore = async (nextHome: number, nextAway: number, final = liveIsFinal, celebrateWin = false) => {
    if (!token) return
    const previousScore = { homeScore, awayScore }
    const previousFinal = liveIsFinal
    flushSync(() => {
      setSaving(true)
      setLastScore(previousScore)
      setLiveScore({ homeScore: nextHome, awayScore: nextAway })
      setLiveIsFinal(final)
    })
    try {
      const res = await fetchWithCsrfRetry(`/api/athletics/games/${game.id}/score`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ homeScore: nextHome, awayScore: nextAway, isFinal: final }),
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!data.ok) {
        setLiveScore(previousScore)
        setLiveIsFinal(previousFinal)
        toast(data.error?.message || 'Could not save score', 'error')
        return
      }
      onSaved()
      if (celebrateWin) setCelebration(`Final: ${viewpoint.team?.name ?? 'We'} win ${ourIsHome ? nextHome : nextAway}-${ourIsHome ? nextAway : nextHome}`)
    } catch {
      setLiveScore(previousScore)
      setLiveIsFinal(previousFinal)
      toast('Could not save score', 'error')
    } finally {
      setSaving(false)
    }
  }

  const changeScore = async (
    side: 'ours' | 'opponent',
    delta: number,
    options: { log?: boolean; label?: string } = {},
  ) => {
    const targetHome = side === 'ours' ? ourIsHome : !ourIsHome
    const nextHome = Math.max(0, homeScore + (targetHome ? delta : 0))
    const nextAway = Math.max(0, awayScore + (!targetHome ? delta : 0))
    const shouldLog = options.log ?? true
    if (shouldLog && delta !== 0) {
      const teamLabel = side === 'ours' ? viewpoint.team?.name ?? 'Our team' : viewpoint.opponentLabel
      const unit = Math.abs(delta) === 1 ? profile.scoreUnit.toLowerCase() : `${profile.scoreUnit.toLowerCase()}s`
      const direction = delta > 0 ? '+' : '-'
      addPlayLogEntry({
        batterName: teamLabel,
        result: options.label ?? `${teamLabel} ${direction}${Math.abs(delta)} ${unit}`,
        runs: delta,
      })
      setLastPlay(options.label ?? `${teamLabel} ${direction}${Math.abs(delta)}`)
    }
    await saveScore(nextHome, nextAway)
  }

  const undoScore = async () => {
    if (!lastScore) return
    await saveScore(lastScore.homeScore, lastScore.awayScore)
    setLastScore(null)
  }

  const saveStatIncrement = async (player: RosterPlayer, statKey: string, amount: number) => {
    if (!token) return
    const currentValue = stats[player.id]?.[statKey] ?? 0
    const nextValue = currentValue + amount
    setStats((prev) => ({
      ...prev,
      [player.id]: {
        ...(prev[player.id] ?? {}),
        [statKey]: (prev[player.id]?.[statKey] ?? currentValue) + amount,
      },
    }))
    try {
      const res = await fetchWithCsrfRetry(`/api/athletics/games/${game.id}/stats`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          stats: [{
            athleteId: player.athleteId,
            rosterId: player.id,
            statKey,
            statValue: nextValue,
          }],
        }),
      })
      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!data.ok) toast(data.error?.message || 'Could not save stat', 'error')
    } catch {
      toast('Could not save stat', 'error')
    }
  }

  const setBaseState = (nextBases: BaseballBases) => {
    basesRef.current = nextBases
    setBases(nextBases)
  }

  const addPlayLogEntry = (entry: Omit<PlayLogEntry, 'id' | 'inning' | 'halfInning' | 'outs' | 'basesAfter'>) => {
    const nextEntry: PlayLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      inning: inningRef.current,
      halfInning: halfInningRef.current,
      outs: outsRef.current,
      basesAfter: basesRef.current,
    }
    playLogRef.current = [nextEntry, ...playLogRef.current].slice(0, 12)
    setPlayLog(playLogRef.current)
  }

  const resetCount = () => {
    setBalls(0)
    setStrikes(0)
  }

  const recordPitch = () => {
    setPitchCount((current) => current + 1)
  }

  const nextPlayer = (message = 'Next batter') => {
    const orderLength = lineupRef.current.length || roster.length
    setCurrentPlayerIndex((current) => orderLength ? (current + 1) % orderLength : 0)
    resetCount()
    setLastPlay(message)
  }

  const addOut = () => {
    const next = Math.min(3, outsRef.current + 1)
    outsRef.current = next
    setOuts(next)
    if (next >= 3) queueHalfInningAdvance()
  }

  const recordRuns = async (runs: number) => {
    if (runs <= 0) return
    await changeScore('ours', runs, { log: false })
  }

  const applyHitToBases = (batter: RosterPlayer, basesBefore: BaseballBases, totalBases: 1 | 2 | 3 | 4) => {
    const runners: Array<{ player: RosterPlayer; start: number }> = []
    if (basesBefore.third) runners.push({ player: basesBefore.third, start: 3 })
    if (basesBefore.second) runners.push({ player: basesBefore.second, start: 2 })
    if (basesBefore.first) runners.push({ player: basesBefore.first, start: 1 })
    runners.push({ player: batter, start: 0 })

    const nextBases = emptyBases()
    const scoringPlayers: RosterPlayer[] = []

    for (const runner of runners) {
      const destination = runner.start + totalBases
      if (destination >= 4) {
        scoringPlayers.push(runner.player)
      } else if (destination === 3) {
        nextBases.third = runner.player
      } else if (destination === 2) {
        nextBases.second = runner.player
      } else if (destination === 1) {
        nextBases.first = runner.player
      }
    }

    return { nextBases, scoringPlayers }
  }

  const applyWalkToBases = (batter: RosterPlayer, basesBefore: BaseballBases) => {
    const nextBases = { ...basesBefore }
    const scoringPlayers: RosterPlayer[] = []

    if (!basesBefore.first) {
      nextBases.first = batter
      return { nextBases, scoringPlayers }
    }

    if (!basesBefore.second) {
      nextBases.second = basesBefore.first
      nextBases.first = batter
      return { nextBases, scoringPlayers }
    }

    if (!basesBefore.third) {
      nextBases.third = basesBefore.second
      nextBases.second = basesBefore.first
      nextBases.first = batter
      return { nextBases, scoringPlayers }
    }

    scoringPlayers.push(basesBefore.third)
    nextBases.third = basesBefore.second
    nextBases.second = basesBefore.first
    nextBases.first = batter
    return { nextBases, scoringPlayers }
  }

  const recordPlateAppearance = async ({
    label,
    statKey,
    totalBases,
    isWalk = false,
    isOut = false,
    isStrikeout = false,
    isHomeRun = false,
  }: {
    label: string
    statKey?: string
    totalBases?: 1 | 2 | 3 | 4
    isWalk?: boolean
    isOut?: boolean
    isStrikeout?: boolean
    isHomeRun?: boolean
  }) => {
    if (!currentPlayer) {
      setLastPlay(`${label} recorded`)
      return
    }

    const batter = currentPlayer
    let nextBases = basesRef.current
    let scoringPlayers: RosterPlayer[] = []

    if (isWalk) {
      const next = applyWalkToBases(batter, basesRef.current)
      nextBases = next.nextBases
      scoringPlayers = next.scoringPlayers
    } else if (totalBases) {
      const next = applyHitToBases(batter, basesRef.current, totalBases)
      nextBases = next.nextBases
      scoringPlayers = next.scoringPlayers
    }

    setBaseState(nextBases)
    if (isOut || isStrikeout) addOut()
    const message = `${label} recorded for ${playerLabel(batter)}${scoringPlayers.length ? `, ${scoringPlayers.length} ${scoringPlayers.length === 1 ? 'run' : 'runs'}` : ''}`
    setLastPlay(message)
    addPlayLogEntry({
      batterName: playerLabel(batter),
      result: label,
      runs: scoringPlayers.length,
    })
    nextPlayer(message)
    if (isHomeRun) setCelebration(scoringPlayers.length > 1 ? `${scoringPlayers.length}-run home run!` : 'Home run!')

    const saves: Array<Promise<void>> = []
    if (statKey) saves.push(saveStatIncrement(batter, statKey, 1))
    if (isHomeRun) saves.push(saveStatIncrement(batter, 'runs', 1))
    if (isStrikeout) saves.push(saveStatIncrement(batter, 'strikeouts', 1))
    if (isOut || isStrikeout) saves.push(saveStatIncrement(batter, 'outs', 1))
    if (scoringPlayers.length > 0) saves.push(saveStatIncrement(batter, 'rbi', scoringPlayers.length))
    for (const scorer of scoringPlayers) {
      if (scorer.id !== batter.id || !isHomeRun) saves.push(saveStatIncrement(scorer, 'runs', 1))
    }
    if (scoringPlayers.length > 0) saves.push(recordRuns(scoringPlayers.length))

    void Promise.all(saves)
  }

  const addBall = async () => {
    recordPitch()
    const next = balls + 1
    setBalls(next)
    setLastPlay(`Ball ${Math.min(next, 4)}`)
    if (next >= 4 && isOurAtBat) {
      await recordPlateAppearance({ label: 'Walk', statKey: 'walks', isWalk: true })
    } else if (next >= 4) {
      const walk = applyWalkToBases(makeOpponentRunner('Opponent runner'), basesRef.current)
      setBaseState(walk.nextBases)
      resetCount()
      setLastPlay('Walk allowed')
      addPlayLogEntry({
        batterName: viewpoint.opponentLabel,
        result: 'Walk allowed',
        runs: walk.scoringPlayers.length,
      })
      if (walk.scoringPlayers.length > 0) void changeScore('opponent', walk.scoringPlayers.length)
    }
  }

  const addStrike = async () => {
    recordPitch()
    const next = strikes + 1
    setStrikes(next)
    setLastPlay(`Strike ${Math.min(next, 3)}`)
    if (next >= 3 && isOurAtBat) {
      await recordPlateAppearance({ label: 'K', isStrikeout: true })
    } else if (next >= 3) {
      addOut()
      resetCount()
      setLastPlay('Strikeout recorded')
      addPlayLogEntry({
        batterName: viewpoint.opponentLabel,
        result: 'Strikeout',
        runs: 0,
      })
    }
  }

  const recordOut = async () => {
    if (isOurAtBat) {
      await recordPlateAppearance({ label: 'Out', isOut: true })
      return
    }
    addOut()
    resetCount()
    setLastPlay('Defensive out recorded')
    addPlayLogEntry({
      batterName: viewpoint.opponentLabel,
      result: 'Defensive out',
      runs: 0,
    })
  }

  const recordFoul = () => {
    recordPitch()
    if (strikes < 2) {
      setStrikes((current) => current + 1)
      setLastPlay(`Foul ball, strike ${strikes + 1}`)
      return
    }
    setLastPlay('Foul ball, count holds at two strikes')
    addPlayLogEntry({
      batterName: isOurAtBat && currentPlayer ? playerLabel(currentPlayer) : viewpoint.opponentLabel,
      result: 'Foul',
      runs: 0,
    })
  }

  const recordError = (fielder?: RosterPlayer) => {
    const nextBases = { ...basesRef.current }
    if (!nextBases.first) {
      nextBases.first = makeOpponentRunner('Opponent runner')
    }
    setBaseState(nextBases)
    setErrors((current) => current + 1)
    resetCount()
    const errorLabel = fielder ? `Error by ${playerLabel(fielder)}` : 'Team error recorded'
    setLastPlay(errorLabel)
    addPlayLogEntry({
      batterName: fielder ? playerLabel(fielder) : viewpoint.team?.name ?? 'Our team',
      result: fielder ? 'Error' : 'Team error',
      runs: 0,
    })
    if (fielder) void saveStatIncrement(fielder, 'errors', 1)
    setErrorDrawerOpen(false)
  }

  const recordPutout = (fielder: RosterPlayer | null = selectedFielder) => {
    if (!fielder) return
    addOut()
    resetCount()
    const message = `Putout by ${playerLabel(fielder)}`
    setLastPlay(message)
    addPlayLogEntry({
      batterName: playerLabel(fielder),
      result: 'Putout',
      runs: 0,
    })
    void saveStatIncrement(fielder, 'putouts', 1)
  }

  const recordAssist = (fielder: RosterPlayer | null = selectedFielder) => {
    if (!fielder) return
    const message = `Assist by ${playerLabel(fielder)}`
    setLastPlay(message)
    addPlayLogEntry({
      batterName: playerLabel(fielder),
      result: 'Assist',
      runs: 0,
    })
    void saveStatIncrement(fielder, 'assists', 1)
  }

  const handleSportAction = async (action: SportAction) => {
    if (action.key === 'out') {
      await recordOut()
      return
    }
    if (action.key === 'strikeout') {
      await recordPlateAppearance({ label: 'K', isStrikeout: true })
      return
    }
    if (action.key === 'single') {
      await recordPlateAppearance({ label: '1B', statKey: 'singles', totalBases: 1 })
      return
    }
    if (action.key === 'double') {
      await recordPlateAppearance({ label: '2B', statKey: 'doubles', totalBases: 2 })
      return
    }
    if (action.key === 'triple') {
      await recordPlateAppearance({ label: '3B', statKey: 'triples', totalBases: 3 })
      return
    }
    if (action.key === 'hr') {
      await recordPlateAppearance({ label: 'HR', statKey: 'home_runs', totalBases: 4, isHomeRun: true })
      return
    }
    if (action.key === 'walk') {
      await recordPlateAppearance({ label: 'Walk', statKey: 'walks', isWalk: true })
      return
    }
    const actionMessage = currentPlayer ? `${action.label} recorded for ${playerLabel(currentPlayer)}` : `${action.label} recorded`
    setLastPlay(actionMessage)
    addPlayLogEntry({
      batterName: currentPlayer ? playerLabel(currentPlayer) : viewpoint.team?.name ?? 'Our team',
      result: action.label,
      runs: action.scoreDelta ?? 0,
    })
    if (action.celebration === 'homeRun') setCelebration('Home run!')
    if (action.statKey && currentPlayer) await saveStatIncrement(currentPlayer, action.statKey, action.statKey === 'points' ? action.scoreDelta ?? 1 : 1)
    if (action.key === 'hr' && currentPlayer) {
      await saveStatIncrement(currentPlayer, 'runs', 1)
      await saveStatIncrement(currentPlayer, 'rbi', 1)
    }
    if (action.scoreDelta) await changeScore('ours', action.scoreDelta, { log: false })
    if (action.advancesPlayer) nextPlayer(actionMessage)
  }

  const markFinal = async () => {
    const weWon = ourScore > opponentScore
    await saveScore(homeScore, awayScore, true, weWon)
    if (!weWon) toast('Final score saved', 'success')
  }

  const openSubstitution = (slotIndex = currentPlayerIndex) => {
    const orderLength = lineupRef.current.length || battingOrder.length || 1
    setSubstitutionSlotIndex(Math.min(Math.max(slotIndex, 0), orderLength - 1))
    setSubstitutionOpen(true)
  }

  const commitSubstitution = (replacement: RosterPlayer) => {
    const currentOrder = lineupRef.current.length ? [...lineupRef.current] : [...battingOrder]
    const outgoing = currentOrder[substitutionSlotIndex]

    if (!outgoing || outgoing.id === replacement.id) {
      setSubstitutionOpen(false)
      return
    }

    const existingIndex = currentOrder.findIndex((player) => player.id === replacement.id)
    if (existingIndex >= 0) {
      currentOrder[existingIndex] = outgoing
    }
    currentOrder[substitutionSlotIndex] = replacement
    syncLineup(currentOrder)

    const message = `Sub: ${playerLabel(replacement)} for ${playerLabel(outgoing)}`
    setLastPlay(message)
    addPlayLogEntry({
      batterName: playerLabel(replacement),
      result: `Sub for ${playerLabel(outgoing)}`,
      runs: 0,
    })
    setSubstitutionOpen(false)
  }

  const openGameDay = () => {
    if (launchStorageKey && typeof window !== 'undefined') {
      sessionStorage.setItem(launchStorageKey, 'true')
    }
    setHasLaunchedGameDay(true)
    setIsFullScreenClosing(false)
    setIsFullScreen(true)
  }

  const closeGameDay = () => {
    setIsFullScreenClosing(true)
  }

  return (
    <>
    {presentation === 'card' ? (
      <div className="lg:hidden mb-5">
        <section className="overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/20">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200/80">{profile.label} game day</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight">
                {viewpoint.homeAway === 'AWAY' ? '@' : 'vs'} {viewpoint.opponentLabel}
              </h2>
              {viewpoint.team && <p className="mt-1 truncate text-sm font-medium text-white/60">{viewpoint.team.name}</p>}
              <p className="mt-4 text-4xl font-bold tabular-nums">
                {ourScore}<span className="mx-2 text-white/30">-</span>{opponentScore}
              </p>
              <p className="mt-1 text-sm font-medium text-white/45">{profile.kind === 'baseball' ? `${halfInning === 'top' ? 'Top' : 'Bottom'} ${ordinal(inning)} · ${halfInningMode}` : `${profile.periodLabel} mode`}</p>
            </div>
            <span className="shrink-0 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold text-white">
              {liveIsFinal ? 'Final' : scoreDue ? 'Score due' : 'Ready'}
            </span>
          </div>
          <button
            type="button"
            onClick={openGameDay}
            className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-sky-400 px-5 text-lg font-bold text-slate-950 transition active:scale-[0.98] cursor-pointer"
          >
            <Play className="h-5 w-5 fill-current" />
            {hasLaunchedGameDay ? 'Resume game' : 'Launch game'}
          </button>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-medium text-white/55">
            <div className="truncate rounded-2xl bg-white/[0.06] px-3 py-3">{formatShortDate(game.startTime)}, {formatTime(game.startTime)}</div>
            <div className="truncate rounded-2xl bg-white/[0.06] px-3 py-3">{game.venue?.trim() || 'Venue needed'}</div>
          </div>
        </section>
      </div>
    ) : (
    <motion.section
      initial={shouldReduceMotion ? false : { y: '100vh' }}
      animate={isFullScreenClosing && isExpanded ? { y: '100vh' } : { y: 0 }}
      exit={shouldReduceMotion ? undefined : { y: '100vh' }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={() => {
        if (isFullScreenClosing && isExpanded) onExitFullScreen?.()
      }}
      className={`${isExpanded ? '' : 'lg:hidden'} relative overflow-hidden border border-slate-800 bg-slate-950 text-white shadow-2xl transition-all duration-300 ${
        isExpanded
          ? '!fixed !inset-0 !z-[70] overflow-y-auto rounded-none border-0 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-6 lg:p-8'
          : 'mb-5 rounded-[28px] p-5'
      }`}
    >
      <AnimatePresence>
        {celebration && <Fireworks message={celebration} onDone={() => setCelebration(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {substitutionOpen && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-end bg-slate-950/65 p-3 backdrop-blur-sm sm:items-center sm:justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSubstitutionOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Make substitution"
              className="max-h-[86vh] w-full overflow-hidden rounded-[28px] border border-white/12 bg-slate-950 text-white shadow-2xl sm:max-w-xl"
              initial={shouldReduceMotion ? false : { y: 34, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={shouldReduceMotion ? undefined : { y: 24, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-white/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-200/70">Substitution</p>
                    <h3 className="mt-2 text-2xl font-black tracking-tight">Batting spot {substitutionSlotIndex + 1}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubstitutionOpen(false)}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.08] text-white/70 transition-colors hover:bg-white/[0.12] cursor-pointer"
                    aria-label="Close substitution drawer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.05] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Currently in this spot</p>
                  <p className="mt-1 truncate text-lg font-bold">{substitutionSlotPlayer ? playerLabel(substitutionSlotPlayer) : 'Empty spot'}</p>
                  <p className="mt-1 text-sm font-semibold text-white/45">
                    The batting spot stays the same. The player changes from this point forward.
                  </p>
                </div>
              </div>

              <div className="max-h-[52vh] space-y-2 overflow-y-auto p-4">
                {roster.length ? roster.map((player) => {
                  const candidateIndex = battingOrder.findIndex((lineupPlayer) => lineupPlayer.id === player.id)
                  const isCurrentSpot = substitutionSlotPlayer?.id === player.id
                  const actionLabel = isCurrentSpot
                    ? 'Current'
                    : candidateIndex >= 0
                      ? `Swap spot ${candidateIndex + 1}`
                      : 'Replace'

                  return (
                    <motion.button
                      key={player.id}
                      type="button"
                      onClick={() => commitSubstitution(player)}
                      disabled={isCurrentSpot}
                      {...pressMotion}
                      className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl px-3 text-left transition-colors disabled:cursor-default disabled:opacity-55 ${
                        isCurrentSpot
                          ? 'border border-sky-200/25 bg-sky-300/12 text-sky-50'
                          : 'border border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.09] cursor-pointer'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-base font-bold">{playerLabel(player)}</span>
                        <span className="mt-0.5 block text-xs font-semibold text-white/45">
                          {candidateIndex >= 0 ? `Currently batting ${candidateIndex + 1}` : 'Bench / available'}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-white/[0.08] px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-white/70">
                        {actionLabel}
                      </span>
                    </motion.button>
                  )
                }) : (
                  <p className="rounded-2xl bg-white/[0.05] px-3 py-4 text-sm font-semibold text-white/55">
                    No active roster players are loaded yet.
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {errorDrawerOpen && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-end bg-slate-950/65 p-3 backdrop-blur-sm sm:items-center sm:justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setErrorDrawerOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Assign fielding error"
              className="max-h-[86vh] w-full overflow-hidden rounded-[28px] border border-white/12 bg-slate-950 text-white shadow-2xl sm:max-w-xl"
              initial={shouldReduceMotion ? false : { y: 34, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={shouldReduceMotion ? undefined : { y: 24, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-white/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200/75">Fielding error</p>
                    <h3 className="mt-2 text-2xl font-black tracking-tight">Who made the error?</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorDrawerOpen(false)}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.08] text-white/70 transition-colors hover:bg-white/[0.12] cursor-pointer"
                    aria-label="Close error drawer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className="mt-3 text-sm font-semibold text-white/50">
                  This adds an opponent runner and records the error in the play log.
                </p>
              </div>

              <div className="max-h-[52vh] space-y-2 overflow-y-auto p-4">
                <motion.button
                  type="button"
                  onClick={() => recordError()}
                  {...pressMotion}
                  className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.05] px-3 text-left transition-colors hover:bg-white/[0.09] cursor-pointer"
                >
                  <span>
                    <span className="block text-base font-bold">Team error</span>
                    <span className="mt-0.5 block text-xs font-semibold text-white/45">Use when the scorer does not know the fielder yet</span>
                  </span>
                  <span className="rounded-full bg-white/[0.08] px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-white/70">Log</span>
                </motion.button>
                {roster.map((player) => (
                  <motion.button
                    key={player.id}
                    type="button"
                    onClick={() => recordError(player)}
                    {...pressMotion}
                    className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.05] px-3 text-left transition-colors hover:bg-white/[0.09] cursor-pointer"
                  >
                    <span className="truncate text-base font-bold">{playerLabel(player)}</span>
                    <span className="shrink-0 rounded-full bg-white/[0.08] px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-white/70">Assign</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {fielderDrawerOpen && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-end bg-slate-950/65 p-3 backdrop-blur-sm sm:items-center sm:justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setFielderDrawerOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Choose fielder"
              className="max-h-[86vh] w-full overflow-hidden rounded-[28px] border border-white/12 bg-slate-950 text-white shadow-2xl sm:max-w-xl"
              initial={shouldReduceMotion ? false : { y: 34, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={shouldReduceMotion ? undefined : { y: 24, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-white/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-200/70">Field player</p>
                    <h3 className="mt-2 text-2xl font-black tracking-tight">Choose the fielder</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFielderDrawerOpen(false)}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.08] text-white/70 transition-colors hover:bg-white/[0.12] cursor-pointer"
                    aria-label="Close fielder drawer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className="mt-3 text-sm font-semibold text-white/50">
                  This only changes the selected defender for quick actions. Substitutions still live in Lineup.
                </p>
              </div>

              <div className="max-h-[52vh] space-y-2 overflow-y-auto p-4">
                {roster.length ? roster.map((player) => {
                  const position = BASEBALL_POSITIONS.find((item) => fieldAssignments.get(item.key)?.id === player.id)
                  const selected = selectedFielder?.id === player.id
                  return (
                    <motion.button
                      key={player.id}
                      type="button"
                      onClick={() => {
                        setSelectedFielderId(player.id)
                        setFielderDrawerOpen(false)
                        setLastPlay(`Fielder set to ${playerLabel(player)}`)
                      }}
                      disabled={selected}
                      {...pressMotion}
                      className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl px-3 text-left transition-colors disabled:cursor-default disabled:opacity-55 ${
                        selected
                          ? 'border border-sky-200/25 bg-sky-300/12 text-sky-50'
                          : 'border border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.09] cursor-pointer'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-base font-bold">{playerLabel(player)}</span>
                        <span className="mt-0.5 block text-xs font-semibold text-white/45">
                          {position ? position.label : 'Bench / available'}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-white/[0.08] px-3 py-1 text-xs font-black uppercase tracking-[0.1em] text-white/70">
                        {selected ? 'Selected' : 'Choose'}
                      </span>
                    </motion.button>
                  )
                }) : (
                  <p className="rounded-2xl bg-white/[0.05] px-3 py-4 text-sm font-semibold text-white/55">
                    No active roster players are loaded yet.
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="absolute inset-x-0 top-0 h-48 bg-gradient-to-br from-sky-500/30 via-slate-900 to-emerald-400/10"
        animate={shouldReduceMotion ? undefined : { opacity: [0.68, 0.92, 0.68] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="relative mx-auto w-full max-w-[1280px]"
        initial={shouldReduceMotion ? false : { y: 14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      >
        <motion.div
          className="flex items-start justify-between gap-3"
          initial={shouldReduceMotion ? false : { y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: shouldReduceMotion ? 0 : 0.06, duration: 0.22 }}
        >
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-200/80">{profile.label} game day</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">
              {viewpoint.homeAway === 'AWAY' ? '@' : 'vs'} {viewpoint.opponentLabel}
            </h2>
            {viewpoint.team && <p className="mt-1 truncate text-sm font-medium text-white/60">{viewpoint.team.name}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold text-white">
              {liveIsFinal ? 'Final' : scoreDue ? 'Score due' : 'Live tools'}
            </span>
            <motion.button
              type="button"
              onClick={closeGameDay}
              {...pressMotion}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition active:scale-[0.96] cursor-pointer"
              aria-label="Exit full screen game day"
            >
              <X className="h-4 w-4" />
            </motion.button>
          </div>
        </motion.div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[86px_minmax(0,1fr)] lg:items-start">
	          <nav
	            className="fixed inset-x-3 bottom-3 z-30 grid gap-1 rounded-[28px] border border-white/10 bg-slate-900/90 p-2 shadow-2xl shadow-slate-950/35 backdrop-blur-xl lg:sticky lg:inset-x-auto lg:bottom-auto lg:top-6 lg:flex lg:h-auto lg:max-h-[560px] lg:flex-col lg:items-stretch lg:gap-2 lg:bg-slate-900/70 lg:backdrop-blur"
	            style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))', gridTemplateColumns: `repeat(${gameDayModes.length}, minmax(0, 1fr))` }}
          >
            <motion.span
              className="pointer-events-none absolute left-2 right-2 top-2 hidden h-[76px] rounded-2xl border border-sky-200/25 bg-sky-300/14 lg:block"
              animate={{ y: activeGameDayModeIndex * 84 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
            {gameDayModes.map((mode) => {
              const Icon = mode.icon
              const active = gameDayMode === mode.key
              return (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setGameDayMode(mode.key)}
                  className={`relative flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-bold transition-colors cursor-pointer lg:h-[76px] lg:px-2 lg:text-xs ${
                    active ? 'text-sky-100' : 'text-white/45 hover:bg-white/[0.06] hover:text-white/75'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="game-day-mode"
                      className="absolute inset-0 rounded-2xl border border-sky-200/25 bg-sky-300/14 lg:hidden"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <Icon className="relative h-5 w-5" />
                  <span className="relative">{mode.label}</span>
                </button>
              )
            })}
          </nav>
          <div className="min-w-0 pb-24 lg:pb-0">
        {betweenInnings && (
          <motion.div
            className="mt-5 rounded-3xl border border-amber-200/25 bg-amber-300/12 p-4"
            initial={shouldReduceMotion ? false : { y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100/70">Between innings</p>
                <p className="mt-1 text-lg font-black text-white">3 outs. Review defense or make changes before starting the next half.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setGameDayMode('field')} className="min-h-11 rounded-2xl bg-white/[0.08] px-4 text-sm font-black text-white transition-colors hover:bg-white/[0.12] cursor-pointer">
                  Review field
                </button>
                <button type="button" onClick={nextHalfInning} disabled={scoringLocked} className="min-h-11 rounded-2xl bg-amber-300 px-4 text-sm font-black text-slate-950 transition-colors hover:bg-amber-200 disabled:opacity-40 cursor-pointer">
                  Start next half
                </button>
              </div>
            </div>
          </motion.div>
        )}

        <div className={`${betweenInnings ? 'mt-4' : ''} grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,420px)] lg:items-start`}>
          <div className="space-y-4">
        <motion.div
          className="relative overflow-hidden rounded-3xl border border-sky-200/15 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.18),transparent_34%),linear-gradient(145deg,rgba(15,23,42,0.95),rgba(2,6,23,0.92))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_24px_70px_rgba(2,6,23,0.35)] lg:p-5"
          initial={shouldReduceMotion ? false : { y: 16, opacity: 0, scale: 0.985 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ delay: shouldReduceMotion ? 0 : 0.1, type: 'spring', stiffness: 240, damping: 28 }}
        >
          <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:38px_38px]" />
          {profile.kind === 'baseball' && (
            <div className="pointer-events-none absolute inset-x-8 top-20 hidden h-48 rounded-t-full border-t border-sky-100/10 lg:block" />
          )}
          <div className="text-center">
            <div className="mx-auto mb-3 inline-flex rounded-full border border-sky-200/20 bg-slate-950/40 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-sky-100/80">
              {formatShortDate(game.startTime)} · {formatTime(game.startTime)}
            </div>
            <motion.p
              key={scoreKey}
              className="flex items-center justify-center gap-2 text-6xl font-bold leading-none tabular-nums lg:text-7xl"
              initial={shouldReduceMotion ? false : { y: 8, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 360, damping: 24 }}
            >
              <FlipScoreNumber value={ourScore} tone="home" reduceMotion={shouldReduceMotion} />
              <span className="text-white/28 drop-shadow-none">-</span>
              <FlipScoreNumber value={opponentScore} tone="away" reduceMotion={shouldReduceMotion} />
            </motion.p>
            <p className="mt-3 text-sm font-black uppercase tracking-[0.14em] text-sky-100/70">
              {profile.kind === 'baseball' ? `${halfInning === 'top' ? 'Top' : 'Bottom'} ${ordinal(inning)} · ${halfInningMode}` : `${profile.periodLabel} mode`}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="min-w-0 rounded-2xl bg-white/[0.05] px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Us</p>
              <p className="mt-0.5 truncate font-semibold">{viewpoint.team?.name ?? 'Our team'}</p>
            </div>
            <div className="min-w-0 rounded-2xl bg-white/[0.05] px-3 py-2 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Them</p>
              <p className="mt-0.5 truncate font-semibold">{viewpoint.opponentLabel}</p>
            </div>
          </div>
	          {profile.kind === 'baseball' && (
	            <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
              <div className="grid grid-cols-[auto_1fr] items-center gap-3 rounded-2xl bg-white/[0.05] px-3 py-2">
                <BaseballDiamond bases={bases} />
                <div className="grid gap-2">
                  <CountDots label="Balls" count={balls} max={3} tone="green" />
                  <CountDots label="Strikes" count={strikes} max={2} tone="pink" />
                  <CountDots label="Outs" count={outs} max={3} tone="amber" />
                </div>
              </div>
              <motion.button
                type="button"
                onClick={requestHalfInningChange}
                disabled={scoringLocked}
                {...pressMotion}
                className="min-h-11 rounded-2xl bg-white/[0.12] px-4 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-40 cursor-pointer"
              >
                {betweenInnings ? 'Start next' : 'End half'}
              </motion.button>
              <p className="col-span-2 truncate rounded-2xl bg-slate-950/35 px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.12em] text-sky-100/65">
                {baseSummary}
              </p>
              <div className="col-span-2 grid grid-cols-2 gap-2 text-center text-xs font-black uppercase tracking-[0.12em] text-white/55">
                <div className="rounded-2xl bg-white/[0.05] px-3 py-2">Pitches {pitchCount}</div>
                <div className="rounded-2xl bg-white/[0.05] px-3 py-2">Errors {errors}</div>
              </div>
	            </div>
	          )}
	          {profile.kind !== 'baseball' && (
	            <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl bg-white/[0.05] px-3 py-2">
	              <div className="min-w-0">
	                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{profile.periodLabel}</p>
		                <p className="mt-0.5 truncate text-sm font-black text-white">
		                  {profile.periodLabel} {inning}{profile.maxRegularPeriods ? ` of ${profile.maxRegularPeriods}` : ''}
		                </p>
	              </div>
	              <motion.button
	                type="button"
	                onClick={advancePeriod}
	                disabled={scoringLocked}
	                {...pressMotion}
	                className="min-h-10 rounded-2xl bg-white/[0.12] px-4 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-40 cursor-pointer"
	              >
		                Next {profile.periodLabel}
	              </motion.button>
	            </div>
	          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <motion.button type="button" onClick={() => changeScore('ours', 1)} disabled={saving || scoringLocked} {...pressMotion} className="min-h-12 rounded-2xl bg-sky-400 px-4 text-base font-bold text-slate-950 transition active:scale-[0.98] disabled:opacity-60 cursor-pointer">
              <Plus className="mr-1 inline h-4 w-4" /> Our {profile.scoreUnit}
            </motion.button>
            <motion.button type="button" onClick={() => changeScore('opponent', 1)} disabled={saving || scoringLocked} {...pressMotion} className="min-h-12 rounded-2xl bg-white/10 px-4 text-base font-bold text-white transition active:scale-[0.98] disabled:opacity-60 cursor-pointer">
              <Plus className="mr-1 inline h-4 w-4" /> Their {profile.scoreUnit}
            </motion.button>
            <motion.button type="button" onClick={() => changeScore('ours', -1)} disabled={saving || scoringLocked || ourScore <= 0} {...pressMotion} className="min-h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white/80 transition active:scale-[0.98] disabled:opacity-40 cursor-pointer">
              <Minus className="mr-1 inline h-4 w-4" /> Our score
            </motion.button>
            <motion.button type="button" onClick={() => changeScore('opponent', -1)} disabled={saving || scoringLocked || opponentScore <= 0} {...pressMotion} className="min-h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white/80 transition active:scale-[0.98] disabled:opacity-40 cursor-pointer">
              <Minus className="mr-1 inline h-4 w-4" /> Their score
            </motion.button>
          </div>
          <div className="mt-3 flex gap-2">
            <motion.button type="button" onClick={undoScore} disabled={!lastScore || saving || scoringLocked} {...pressMotion} className="min-h-10 flex-1 rounded-2xl bg-white/[0.06] px-3 text-sm font-semibold text-white/70 transition active:scale-[0.98] disabled:opacity-40 cursor-pointer">
              <RotateCcw className="mr-1 inline h-4 w-4" /> Undo
            </motion.button>
            <motion.button type="button" onClick={markFinal} disabled={saving || liveIsFinal} {...pressMotion} className="min-h-10 flex-1 rounded-2xl bg-emerald-300 px-3 text-sm font-bold text-slate-950 transition active:scale-[0.98] disabled:opacity-60 cursor-pointer">
              {liveIsFinal ? 'Final saved' : 'Mark final'}
            </motion.button>
          </div>
        </motion.div>

        {gameDayMode === 'field' && (
          <motion.div
            className="relative overflow-hidden rounded-3xl border border-emerald-200/15 bg-[radial-gradient(circle_at_50%_35%,rgba(16,185,129,0.18),transparent_36%),linear-gradient(145deg,rgba(4,16,28,0.96),rgba(2,6,23,0.94))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_70px_rgba(2,6,23,0.3)] lg:min-h-[520px]"
            initial={shouldReduceMotion ? false : { y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200/70">Field view</p>
                <h3 className="mt-1 text-2xl font-black tracking-tight">Defensive board</h3>
              </div>
              <span className="rounded-full bg-white/[0.08] px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-white/60">
                {halfInningMode}
              </span>
            </div>
            <div className="relative mt-5 aspect-[1.25/1] overflow-hidden rounded-[28px] border border-white/10 bg-emerald-950/20">
              <div className="absolute left-1/2 top-[58%] h-[42%] w-[42%] -translate-x-1/2 rotate-45 rounded-sm border-2 border-white/20 bg-white/[0.025]" />
              <div className="absolute inset-x-[18%] top-[8%] h-[58%] rounded-t-full border-t border-white/15" />
              {BASEBALL_POSITIONS.map((position) => {
                const player = fieldAssignments.get(position.key)
                const active = selectedFielder?.id === player?.id
                return (
                  <button
                    key={position.key}
                    type="button"
                    onClick={() => player && setSelectedFielderId(player.id)}
                    className={`absolute flex min-h-14 w-28 -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-2xl border px-2 text-left shadow-lg transition-colors cursor-pointer ${
                      active
                        ? 'border-sky-200/60 bg-sky-300/20 text-sky-50'
                        : 'border-white/12 bg-slate-950/70 text-white/75 hover:bg-slate-900'
                    }`}
                    style={{ left: `${position.x}%`, top: `${position.y}%` }}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-xs font-black">{position.key}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-black">{player ? playerLabel(player) : 'Open'}</span>
                      <span className="block truncate text-[10px] font-bold uppercase tracking-[0.1em] text-white/40">{position.label}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <motion.button type="button" onClick={() => setGameDayMode('stats')} {...pressMotion} className="min-h-12 rounded-2xl border border-white/10 bg-white/10 px-4 text-base font-semibold text-white transition active:scale-[0.98] cursor-pointer">
            Full stats
          </motion.button>
          <motion.button type="button" onClick={() => setGameDayMode('sheet')} {...pressMotion} className="min-h-12 rounded-2xl border border-white/10 bg-white/10 px-4 text-base font-semibold text-white transition active:scale-[0.98] cursor-pointer">
            Score sheet
          </motion.button>
        </div>
          </div>

          <aside className="space-y-4">
        <div className="grid gap-2 text-sm font-medium text-white/70">
          <div className="flex min-h-11 items-center gap-3 rounded-2xl bg-white/[0.06] px-3">
            <Clock className="h-4 w-4 text-white/40" />
            <span>{formatShortDate(game.startTime)}, {formatTime(game.startTime)}</span>
          </div>
          <div className={`flex min-h-11 items-center gap-3 rounded-2xl px-3 ${missingVenue ? 'bg-amber-300/15 text-amber-100' : 'bg-white/[0.06]'}`}>
            <MapPin className="h-4 w-4 text-white/40" />
            <span>{game.venue?.trim() || 'Venue needed'}</span>
          </div>
        </div>

        {(gameDayMode === 'home' || gameDayMode === 'scoring') && (
        <motion.div
          className="rounded-3xl border border-white/10 bg-black/20 p-4"
          initial={shouldReduceMotion ? false : { x: 14, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: shouldReduceMotion ? 0 : 0.16, type: 'spring', stiffness: 250, damping: 30 }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">{isOurAtBat ? profile.primaryStatLabel : 'Defense'}</p>
              <p className="mt-1 truncate text-lg font-bold">
                {isOurAtBat
                  ? currentPlayer
                    ? `${currentPlayer.jerseyNumber ? `#${currentPlayer.jerseyNumber} ` : ''}${currentPlayer.firstName} ${currentPlayer.lastName}`
                    : 'No roster yet'
                  : `${viewpoint.opponentLabel} at bat`}
              </p>
              <AnimatePresence mode="wait">
                {lastPlay && (
                  <motion.p
                    key={lastPlay}
                    className="mt-2 inline-flex rounded-2xl bg-emerald-300/10 px-3 py-1.5 text-sm font-semibold text-emerald-100"
                    initial={shouldReduceMotion ? false : { y: 5, opacity: 0, scale: 0.98 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={shouldReduceMotion ? undefined : { y: -4, opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                  >
                    {lastPlay}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            {isOurAtBat && battingOrder.length > 0 && (
              <motion.button type="button" onClick={() => nextPlayer()} {...pressMotion} className="min-h-11 shrink-0 rounded-2xl bg-white/10 px-3 text-sm font-bold transition active:scale-[0.98] cursor-pointer">
                Next <ChevronRight className="inline h-4 w-4" />
              </motion.button>
            )}
          </div>

          {profile.kind === 'baseball' && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              <motion.button type="button" onClick={addBall} disabled={scoringLocked} {...pressMotion} className="min-h-12 rounded-2xl bg-white/[0.08] text-sm font-bold disabled:opacity-40 cursor-pointer">Balls {balls}</motion.button>
              <motion.button type="button" onClick={addStrike} disabled={scoringLocked} {...pressMotion} className="min-h-12 rounded-2xl bg-white/[0.08] text-sm font-bold disabled:opacity-40 cursor-pointer">Strikes {strikes}</motion.button>
              <motion.button type="button" onClick={recordOut} disabled={scoringLocked} {...pressMotion} className="min-h-12 rounded-2xl bg-white/[0.08] text-sm font-bold disabled:opacity-40 cursor-pointer">Outs {outs}</motion.button>
              <motion.button type="button" onClick={recordFoul} disabled={scoringLocked} {...pressMotion} className="min-h-12 rounded-2xl bg-white/[0.08] text-sm font-bold disabled:opacity-40 cursor-pointer">Foul</motion.button>
            </div>
          )}

          {!isOurAtBat && profile.kind === 'baseball' && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <motion.button type="button" onClick={() => setErrorDrawerOpen(true)} disabled={scoringLocked} {...pressMotion} className="min-h-12 rounded-2xl border border-amber-200/35 bg-amber-300/18 px-3 text-sm font-bold text-amber-50 transition active:scale-[0.98] disabled:opacity-40 cursor-pointer">
                Error {errors ? <span className="ml-1 rounded-full bg-white/15 px-1.5 text-[11px]">{errors}</span> : null}
              </motion.button>
              <motion.button type="button" onClick={() => changeScore('opponent', 1)} disabled={saving || scoringLocked} {...pressMotion} className="min-h-12 rounded-2xl border border-fuchsia-300/30 bg-fuchsia-400/18 px-3 text-sm font-bold text-fuchsia-50 transition active:scale-[0.98] disabled:opacity-60 cursor-pointer">
                Their Run
              </motion.button>
              <div className="col-span-2 rounded-2xl bg-white/[0.05] px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.12em] text-white/45">
                {pitchCount} pitches tracked
              </div>
            </div>
          )}

	          {isOurAtBat && (
	            <div className="mt-3 grid grid-cols-4 gap-2">
	              {profile.quickActions.map((action) => (
	              <motion.button
	                key={action.key}
	                type="button"
	                onClick={() => handleSportAction(action)}
	                disabled={scoringLocked || Boolean(action.statKey && !currentPlayer && !action.scoreDelta)}
	                {...pressMotion}
	                className={`min-h-12 rounded-2xl border px-2 text-sm font-bold transition active:scale-[0.98] disabled:opacity-40 cursor-pointer ${actionTone(action)}`}
	              >
                <span>{action.label}</span>
                {action.statKey && currentPlayer && (currentPlayerStats[action.statKey] ?? 0) > 0 && (
                  <motion.span
                    key={`${action.key}-${currentPlayerStats[action.statKey]}`}
                    className="ml-1 inline-flex min-w-5 justify-center rounded-full bg-white/15 px-1.5 text-[11px]"
                    initial={shouldReduceMotion ? false : { scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  >
                    {currentPlayerStats[action.statKey]}
                  </motion.span>
                )}
              </motion.button>
	              ))}
	            </div>
	          )}

	          {profile.kind !== 'baseball' && opponentScoreActions.length > 0 && (
	            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
	              <div className="flex items-center justify-between gap-3">
	                <p className="text-xs font-black uppercase tracking-[0.14em] text-white/40">Opponent scoring</p>
	                <span className="truncate text-xs font-semibold text-white/45">{viewpoint.opponentLabel}</span>
	              </div>
	              <div className="mt-3 grid grid-cols-3 gap-2">
	                {opponentScoreActions.map((action) => (
	                  <motion.button
	                    key={`opponent-${action.key}`}
	                    type="button"
	                    onClick={() => changeScore('opponent', action.scoreDelta ?? 1, { label: `${viewpoint.opponentLabel} ${action.label}` })}
	                    disabled={saving || scoringLocked}
	                    {...pressMotion}
	                    className="min-h-11 rounded-2xl border border-white/10 bg-white/[0.07] px-2 text-sm font-bold text-white/80 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
	                  >
	                    {action.label}
	                  </motion.button>
	                ))}
	              </div>
	            </div>
	          )}
	        </motion.div>
	        )}

        {gameDayMode === 'field' && profile.kind === 'baseball' && (
          <motion.div
            className="rounded-3xl border border-white/10 bg-black/20 p-4"
            initial={shouldReduceMotion ? false : { x: 14, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.16, type: 'spring', stiffness: 250, damping: 30 }}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-sky-300/14 text-xl font-black text-sky-100">
                {selectedFielder?.photoUrl ? (
                  <span
                    className="h-full w-full rounded-2xl bg-cover bg-center"
                    style={{ backgroundImage: `url(${selectedFielder.photoUrl})` }}
                    aria-hidden="true"
                  />
                ) : (
                  selectedFielder ? playerLabel(selectedFielder).split(' ').map((part) => part[0]).join('').slice(0, 2) : 'P'
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">Selected fielder</p>
                <p className="mt-1 truncate text-lg font-black">{selectedFielder ? playerLabel(selectedFielder) : 'Choose a player'}</p>
                <p className="mt-1 text-sm font-semibold text-white/45">Putout, assist, error, or change player.</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <motion.button type="button" onClick={() => recordPutout(selectedFielder)} disabled={scoringLocked || !selectedFielder} {...pressMotion} className="min-h-12 rounded-2xl bg-emerald-300 px-3 text-sm font-black text-slate-950 transition disabled:opacity-50 cursor-pointer">
                Catch / Putout
              </motion.button>
              <motion.button type="button" onClick={() => recordAssist(selectedFielder)} disabled={scoringLocked || !selectedFielder} {...pressMotion} className="min-h-12 rounded-2xl bg-white/[0.09] px-3 text-sm font-black text-white transition disabled:opacity-50 cursor-pointer">
                Assist
              </motion.button>
              <motion.button type="button" onClick={() => selectedFielder ? recordError(selectedFielder) : setErrorDrawerOpen(true)} disabled={scoringLocked} {...pressMotion} className="min-h-12 rounded-2xl border border-amber-200/35 bg-amber-300/18 px-3 text-sm font-black text-amber-50 transition disabled:opacity-50 cursor-pointer">
                Error
              </motion.button>
              <motion.button type="button" onClick={() => setFielderDrawerOpen(true)} {...pressMotion} className="min-h-12 rounded-2xl bg-white/[0.09] px-3 text-sm font-black text-white transition cursor-pointer">
                Change player
              </motion.button>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black uppercase tracking-[0.12em] text-white/55">
              <div className="rounded-2xl bg-white/[0.05] px-2 py-2">PO {selectedFielder ? stats[selectedFielder.id]?.putouts ?? 0 : 0}</div>
              <div className="rounded-2xl bg-white/[0.05] px-2 py-2">A {selectedFielder ? stats[selectedFielder.id]?.assists ?? 0 : 0}</div>
              <div className="rounded-2xl bg-white/[0.05] px-2 py-2">E {selectedFielder ? stats[selectedFielder.id]?.errors ?? 0 : 0}</div>
            </div>
          </motion.div>
        )}

        {(gameDayMode === 'lineup' || (profile.kind === 'baseball' && isOurAtBat && gameDayMode === 'home')) && (
          <motion.div
            className="rounded-3xl border border-white/10 bg-black/20 p-4"
            initial={shouldReduceMotion ? false : { x: 14, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.2, type: 'spring', stiffness: 250, damping: 30 }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
	                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">{profile.gameStructure === 'events' ? 'Results roster' : 'Lineup'}</p>
	                <p className="mt-1 text-sm font-semibold text-white/70">{battingOrder.length ? `${battingOrder.length} ${profile.kind === 'baseball' ? 'batting spots' : 'players'}` : 'No roster loaded'}</p>
              </div>
              <motion.button
                type="button"
                onClick={() => openSubstitution(currentPlayerIndex)}
                {...pressMotion}
                className="min-h-10 rounded-2xl border border-white/10 bg-white/[0.06] px-3 text-sm font-bold text-white/75 transition active:scale-[0.98] cursor-pointer"
              >
                Sub
              </motion.button>
            </div>
            <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
              {battingOrder.length ? battingOrder.map((player, index) => (
                <button
                  key={`${player.id}-${index}`}
                  type="button"
                  onClick={() => {
                    setCurrentPlayerIndex(index)
                    resetCount()
                    setLastPlay(`Batter set to ${playerLabel(player)}`)
                  }}
                  className={`flex min-h-10 w-full items-center justify-between rounded-2xl px-3 text-left text-sm transition-colors cursor-pointer ${
                    index === currentPlayerIndex ? 'bg-sky-300/16 text-sky-50' : 'bg-white/[0.04] text-white/65 hover:bg-white/[0.08]'
                  }`}
                >
                  <span className="truncate font-semibold">{index + 1}. {playerLabel(player)}</span>
                  {index === currentPlayerIndex && <span className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-100/70">Up</span>}
                </button>
              )) : (
                <p className="rounded-2xl bg-white/[0.04] px-3 py-3 text-sm text-white/55">Add athletes to build the batting order.</p>
              )}
            </div>
          </motion.div>
        )}

        {gameDayMode === 'stats' && (
          <motion.div
            className="rounded-3xl border border-white/10 bg-black/20 p-4"
            initial={shouldReduceMotion ? false : { x: 14, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.18, type: 'spring', stiffness: 250, damping: 30 }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">Stats</p>
                <p className="mt-1 text-sm font-semibold text-white/70">Review player totals from this game.</p>
              </div>
              <motion.button type="button" onClick={onPlayerStats} {...pressMotion} className="min-h-10 rounded-2xl bg-white/[0.08] px-3 text-sm font-bold text-white transition cursor-pointer">
                Full stats
              </motion.button>
            </div>
	            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
	              {roster.map((player) => (
	                <div key={player.id} className="rounded-2xl bg-white/[0.04] px-3 py-2">
	                  <p className="truncate text-sm font-black text-white">{playerLabel(player)}</p>
	                  <p className="mt-1 text-xs font-semibold text-white/45">
	                    {profile.kind === 'baseball'
	                      ? (
	                        <>
	                          H {(stats[player.id]?.singles ?? 0) + (stats[player.id]?.doubles ?? 0) + (stats[player.id]?.triples ?? 0) + (stats[player.id]?.home_runs ?? 0)}
	                          {' · '}RBI {stats[player.id]?.rbi ?? 0}
	                          {' · '}E {stats[player.id]?.errors ?? 0}
	                        </>
	                      )
	                      : profile.quickActions
	                        .filter((action) => action.statKey)
	                        .slice(0, 4)
	                        .map((action) => `${action.label} ${stats[player.id]?.[action.statKey as string] ?? 0}`)
	                        .join(' · ')}
	                  </p>
	                </div>
	              ))}
            </div>
          </motion.div>
        )}

        {(gameDayMode === 'home' || gameDayMode === 'sheet') && (
          <motion.div
            className="rounded-3xl border border-white/10 bg-black/20 p-4"
            initial={shouldReduceMotion ? false : { x: 14, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: shouldReduceMotion ? 0 : 0.24, type: 'spring', stiffness: 250, damping: 30 }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/40">Play log</p>
              <span className="text-xs font-semibold text-white/35">{playLog.length ? `${playLog.length} plays` : 'Empty'}</span>
            </div>
            <div className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1">
              {playLog.length ? playLog.map((play) => (
                <div key={play.id} className="rounded-2xl bg-white/[0.04] px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-bold text-white">{play.result} · {play.batterName}</p>
	                    <span className="shrink-0 text-xs font-black uppercase tracking-[0.12em] text-sky-100/55">
	                      {profile.kind === 'baseball' ? `${play.halfInning === 'top' ? 'Top' : 'Bot'} ${play.inning}` : `${profile.periodLabel} ${play.inning}`}
	                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-white/45">
	                    {profile.kind === 'baseball'
	                      ? `${play.runs ? `${play.runs} ${play.runs === 1 ? 'run' : 'runs'} · ` : ''}${play.outs} outs · ${countOccupiedBases(play.basesAfter)} on`
	                      : play.runs ? `${play.runs} ${play.runs === 1 ? profile.scoreUnit.toLowerCase() : `${profile.scoreUnit.toLowerCase()}s`}` : 'Stat recorded'}
	                  </p>
                </div>
              )) : (
                <p className="rounded-2xl bg-white/[0.04] px-3 py-3 text-sm text-white/55">Plays will appear here as the game is scored.</p>
              )}
            </div>
          </motion.div>
        )}

        {canWrite && onEdit && (
          <motion.button type="button" onClick={onEdit} {...pressMotion} className="min-h-11 w-full rounded-2xl bg-white/[0.06] px-4 text-sm font-semibold text-white/70 transition active:scale-[0.98] cursor-pointer">
            Edit game details
          </motion.button>
        )}
          </aside>
        </div>
          </div>
        </div>
      </motion.div>
    </motion.section>
    )}
    {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {isFullScreen && (
          <motion.div
            className="fixed inset-0 z-[70] bg-slate-950/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
          >
          <MobileGameDayMode
            key={game.id}
            game={game}
            viewpoint={viewpoint}
            canWrite={canWrite}
            onCreateGame={onCreateGame}
            onEdit={onEdit}
            onScore={onScore}
            onPlayerStats={onPlayerStats}
            onSaved={onSaved}
            presentation="fullscreen"
            onExitFullScreen={() => {
              setIsFullScreenClosing(false)
              setIsFullScreen(false)
            }}
          />
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
    )}
    </>
  )
}
