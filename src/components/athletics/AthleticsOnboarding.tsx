'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { queryOptions, queryKeys } from '@/lib/queries'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Dribbble, CalendarDays, Users, CalendarPlus,
  Check, ChevronDown, Loader2, ArrowRight,
} from 'lucide-react'
import { FloatingInput, FloatingDropdown } from '@/components/ui/FloatingInput'
import { handleAuthResponse } from '@/lib/client-auth'

// ─── Types ──────────────────────────────────────────────────────────

interface Sport {
  id: string
  name: string
  abbreviation: string | null
  color: string
  seasonType: string
  isActive: boolean
  _count: { athleticTeams: number; athleticSeasons: number }
}

interface Season {
  id: string
  name: string
  startDate: string
  endDate: string
  isCurrent: boolean
}

interface Team {
  id: string
  name: string
  sportId: string
  seasonId: string
  level: string
}

interface OnboardingProps {
  activeCampusId: string | null
  canWrite: boolean
  onComplete: () => void
}

type Step = 'sport' | 'season' | 'team' | 'schedule'

// ─── Constants ──────────────────────────────────────────────────────

const COLOR_PRESETS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
]

const SEASON_TYPES = [
  { value: 'FALL', label: 'Fall' },
  { value: 'WINTER', label: 'Winter' },
  { value: 'SPRING', label: 'Spring' },
  { value: 'YEAR_ROUND', label: 'Year-Round' },
]

const LEVELS = [
  { value: 'VARSITY', label: 'Varsity' },
  { value: 'JUNIOR_VARSITY', label: 'Junior Varsity' },
  { value: 'FRESHMAN', label: 'Freshman' },
  { value: 'CLUB', label: 'Club' },
]

const STEPS_META: { key: Step; label: string; description: string; icon: typeof Dribbble; optional?: boolean }[] = [
  { key: 'sport', label: 'Add your first sport', description: 'What sports does your school play?', icon: Dribbble },
  { key: 'season', label: 'Create a season', description: 'Set up the current season for your sport', icon: CalendarDays },
  { key: 'team', label: 'Create a team', description: 'Build your first team', icon: Users },
  { key: 'schedule', label: 'Schedule a game', description: 'Add your first game or do this later', icon: CalendarPlus, optional: true },
]

// ─── Component ──────────────────────────────────────────────────────

export default function AthleticsOnboarding({ activeCampusId, canWrite, onComplete }: OnboardingProps) {
  const queryClient = useQueryClient()
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null

  // ── Fetched data to track progress ────────────────────────────────
  const { data: sportsData } = useQuery(queryOptions.athleticsSports())
  const sports = (sportsData ?? []) as Sport[]

  const { data: seasonsData } = useQuery(queryOptions.athleticsSeasons())
  const allSeasons = (seasonsData ?? []) as Season[]

  const { data: teamsData } = useQuery(queryOptions.athleticsTeams())
  const teams = (teamsData ?? []) as Team[]

  // ── Progress detection ────────────────────────────────────────────
  const hasSport = sports.length > 0
  const hasSeason = allSeasons.length > 0
  const hasTeam = teams.length > 0

  const completedSteps = useMemo(() => {
    const s = new Set<Step>()
    if (hasSport) s.add('sport')
    if (hasSeason) s.add('season')
    if (hasTeam) s.add('team')
    return s
  }, [hasSport, hasSeason, hasTeam])

  const firstIncomplete: Step = !hasSport ? 'sport' : !hasSeason ? 'season' : !hasTeam ? 'team' : 'schedule'

  const [expandedStep, setExpandedStep] = useState<Step | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!expandedStep || completedSteps.has(expandedStep)) {
      setExpandedStep(firstIncomplete)
    }
  }, [firstIncomplete]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Form state ────────────────────────────────────────────────────
  const [sportName, setSportName] = useState('')
  const [sportColor, setSportColor] = useState('#3b82f6')
  const [sportSeasonType, setSportSeasonType] = useState('FALL')

  const [seasonName, setSeasonName] = useState('')
  const [seasonStart, setSeasonStart] = useState('')
  const [seasonEnd, setSeasonEnd] = useState('')

  const [teamName, setTeamName] = useState('')
  const [teamLevel, setTeamLevel] = useState('VARSITY')

  const [opponentName, setOpponentName] = useState('')
  const [gameHomeAway, setGameHomeAway] = useState('HOME')
  const [gameStart, setGameStart] = useState('')
  const [gameEnd, setGameEnd] = useState('')

  // ── API helper ────────────────────────────────────────────────────

  const apiPost = useCallback(async (url: string, body: Record<string, unknown>) => {
    if (!token) throw new Error('Not authenticated')
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    if (handleAuthResponse(res)) throw new Error('Session expired')
    const data = await res.json()
    if (!data.ok) throw new Error(data.error?.message ?? 'Something went wrong')
    return data.data
  }, [token])

  // ── Save handlers ─────────────────────────────────────────────────

  const handleCreateSport = useCallback(async () => {
    if (!sportName.trim()) return
    setSaving(true)
    setError(null)
    try {
      await apiPost('/api/athletics/sports', {
        name: sportName.trim(),
        color: sportColor,
        seasonType: sportSeasonType,
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.athleticsSports.all })
      setSportName('')
      setTimeout(() => setExpandedStep('season'), 400)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create sport')
    } finally {
      setSaving(false)
    }
  }, [sportName, sportColor, sportSeasonType, apiPost, queryClient])

  const handleCreateSeason = useCallback(async () => {
    if (!seasonName.trim() || !seasonStart || !seasonEnd || !sports[0]?.id) return
    setSaving(true)
    setError(null)
    try {
      await apiPost('/api/athletics/seasons', {
        sportId: sports[0].id,
        name: seasonName.trim(),
        startDate: new Date(seasonStart).toISOString(),
        endDate: new Date(seasonEnd).toISOString(),
        isCurrent: true,
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.athleticsSeasons.all })
      setSeasonName('')
      setSeasonStart('')
      setSeasonEnd('')
      setTimeout(() => setExpandedStep('team'), 400)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create season')
    } finally {
      setSaving(false)
    }
  }, [seasonName, seasonStart, seasonEnd, sports, apiPost, queryClient])

  const handleCreateTeam = useCallback(async () => {
    if (!teamName.trim() || !sports[0]?.id || !allSeasons[0]?.id) return
    setSaving(true)
    setError(null)
    try {
      await apiPost('/api/athletics/teams', {
        name: teamName.trim(),
        sportId: sports[0].id,
        seasonId: allSeasons[0].id,
        level: teamLevel,
        ...(activeCampusId ? { schoolId: activeCampusId } : {}),
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.athleticsTeams.all })
      setTeamName('')
      setTimeout(() => setExpandedStep('schedule'), 400)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create team')
    } finally {
      setSaving(false)
    }
  }, [teamName, sports, allSeasons, teamLevel, activeCampusId, apiPost, queryClient])

  const handleCreateGame = useCallback(async () => {
    if (!opponentName.trim() || !gameStart || !gameEnd || !teams[0]?.id) return
    setSaving(true)
    setError(null)
    try {
      await apiPost('/api/athletics/games', {
        athleticTeamId: teams[0].id,
        opponentName: opponentName.trim(),
        homeAway: gameHomeAway,
        startTime: new Date(gameStart).toISOString(),
        endTime: new Date(gameEnd).toISOString(),
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.athleticsDashboard.all })
      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to schedule game')
    } finally {
      setSaving(false)
    }
  }, [opponentName, gameHomeAway, gameStart, gameEnd, teams, apiPost, queryClient, onComplete])

  // ── Progress (based on 3 required steps — game scheduling is optional) ──
  const requiredSteps = 3
  const completedCount = completedSteps.size
  const progressPercent = Math.min(100, Math.round((completedCount / requiredSteps) * 100))

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="max-w-xl mx-auto pt-6 pb-12">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-200/50 mb-5">
          <Dribbble className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">Set up your athletics program</h2>
        <p className="text-sm text-stone-500 max-w-sm mx-auto leading-relaxed">
          Four quick steps to get your dashboard, teams, and schedules ready to go.
        </p>
      </div>

      {/* ── Progress bar ────────────────────────────────────────── */}
      <div className="mb-10 px-1">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-medium text-stone-500">{Math.min(completedCount, requiredSteps)} of {requiredSteps} steps</span>
          <span className="text-xs font-semibold text-slate-900">{progressPercent}%</span>
        </div>
        <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>

      {/* ── Error banner ────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-6 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Checklist ───────────────────────────────────────────── */}
      <div className="space-y-4">
        {STEPS_META.map((step, index) => {
          const isCompleted = completedSteps.has(step.key)
          const isExpanded = expandedStep === step.key
          const isLocked = (step.key === 'season' && !hasSport)
            || (step.key === 'team' && (!hasSport || !hasSeason))
            || (step.key === 'schedule' && (!hasSport || !hasSeason || !hasTeam))
          const StepIcon = step.icon

          return (
            <div key={step.key}>
              {/* Step card */}
              <button
                type="button"
                disabled={isLocked && !isCompleted}
                onClick={() => {
                  if (isLocked && !isCompleted) return
                  setExpandedStep(isExpanded ? null : step.key)
                  setError(null)
                }}
                className={`w-full flex items-center gap-5 px-5 py-4 rounded-2xl text-left transition-all duration-200 ${
                  isExpanded
                    ? 'bg-white border border-stone-200 shadow-md shadow-slate-200/60'
                    : isCompleted
                      ? 'bg-white border border-stone-100 hover:border-stone-200'
                      : isLocked
                        ? 'bg-stone-50/60 border border-transparent opacity-40 cursor-not-allowed'
                        : 'bg-white border border-stone-100 hover:border-stone-200 hover:shadow-md hover:shadow-slate-200/40 cursor-pointer'
                }`}
              >
                {/* Step icon circle */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  isCompleted
                    ? 'bg-emerald-50 text-emerald-500'
                    : isExpanded
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-stone-100 text-stone-400'
                }`}>
                  {isCompleted ? <Check className="w-5 h-5" strokeWidth={2.5} /> : <StepIcon className="w-5 h-5" />}
                </div>

                {/* Label + meta */}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold leading-tight flex items-center gap-2 ${
                    isCompleted ? 'text-stone-400' : 'text-slate-900'
                  }`}>
                    {step.label}
                    {step.optional && (
                      <span className="text-[10px] font-medium text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                        Optional
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-stone-400 mt-1 leading-snug">
                    {isCompleted && step.key === 'sport' && sports[0] ? (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sports[0].color }} />
                        {sports[0].name}{sports.length > 1 && ` + ${sports.length - 1} more`}
                      </span>
                    ) : isCompleted && step.key === 'season' && allSeasons[0] ? (
                      allSeasons[0].name
                    ) : isCompleted && step.key === 'team' && teams[0] ? (
                      <span>{teams[0].name}{teams.length > 1 && ` + ${teams.length - 1} more`}</span>
                    ) : (
                      step.description
                    )}
                  </div>
                </div>

                {/* Expand indicator */}
                {!isLocked && (
                  <div className={`flex-shrink-0 transition-transform duration-200 text-stone-300 ${isExpanded ? 'rotate-180' : ''}`}>
                    <ChevronDown className="w-5 h-5" />
                  </div>
                )}
              </button>

              {/* Expanded form */}
              <AnimatePresence>
                {isExpanded && !isLocked && !isCompleted && (
                  <motion.div
                    key={`form-${step.key}`}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } }}
                    exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                  >
                    <div className="pt-3 pb-1 pl-20 pr-5">
                      {step.key === 'sport' && (
                        <SportForm
                          name={sportName} setName={setSportName}
                          color={sportColor} setColor={setSportColor}
                          seasonType={sportSeasonType} setSeasonType={setSportSeasonType}
                          saving={saving} onSubmit={handleCreateSport}
                        />
                      )}
                      {step.key === 'season' && (
                        <SeasonForm
                          name={seasonName} setName={setSeasonName}
                          start={seasonStart} setStart={setSeasonStart}
                          end={seasonEnd} setEnd={setSeasonEnd}
                          sportName={sports[0]?.name ?? 'Sport'}
                          saving={saving} onSubmit={handleCreateSeason}
                        />
                      )}
                      {step.key === 'team' && (
                        <TeamForm
                          name={teamName} setName={setTeamName}
                          level={teamLevel} setLevel={setTeamLevel}
                          sportName={sports[0]?.name ?? 'Sport'}
                          seasonName={allSeasons[0]?.name ?? 'Season'}
                          saving={saving} onSubmit={handleCreateTeam}
                        />
                      )}
                      {step.key === 'schedule' && (
                        <GameForm
                          opponent={opponentName} setOpponent={setOpponentName}
                          homeAway={gameHomeAway} setHomeAway={setGameHomeAway}
                          start={gameStart} setStart={setGameStart}
                          end={gameEnd} setEnd={setGameEnd}
                          teamName={teams[0]?.name ?? 'Team'}
                          saving={saving} onSubmit={handleCreateGame}
                        />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      {/* ── Finish / Skip ──────────────────────────────────────── */}
      {hasSport && hasSeason && hasTeam ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-10 text-center space-y-3"
        >
          <button
            type="button"
            onClick={onComplete}
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-slate-900 rounded-xl hover:bg-slate-800 shadow-sm shadow-slate-300/50 transition-all duration-200 active:scale-[0.97]"
          >
            Go to Athletics Dashboard
            <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-xs text-stone-400">
            You can schedule games, add roster players, and more from there.
          </p>
        </motion.div>
      ) : completedCount >= 1 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-10 text-center"
        >
          <button
            type="button"
            onClick={onComplete}
            className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-600 transition-colors"
          >
            Skip setup and explore on your own
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      ) : null}
    </div>
  )
}

// ─── Inline Forms ───────────────────────────────────────────────────

function SportForm({ name, setName, color, setColor, seasonType, setSeasonType, saving, onSubmit }: {
  name: string; setName: (v: string) => void
  color: string; setColor: (v: string) => void
  seasonType: string; setSeasonType: (v: string) => void
  saving: boolean; onSubmit: () => void
}) {
  return (
    <div className="space-y-4">
      <FloatingInput
        id="onboard-sport-name"
        label="Sport name (e.g. Basketball)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <FloatingDropdown
        id="onboard-season-type"
        label="Season type"
        value={seasonType}
        onChange={setSeasonType}
        options={SEASON_TYPES}
      />
      <div>
        <label className="block text-[10px] font-semibold text-stone-400 mb-2 uppercase tracking-wide">Team color</label>
        <div className="flex gap-2.5">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full transition-all duration-150 ${
                color === c
                  ? 'ring-2 ring-offset-2 ring-slate-400 scale-110'
                  : 'hover:scale-110'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <div className="pt-1">
        <SubmitButton label="Create Sport" saving={saving} disabled={!name.trim()} onSubmit={onSubmit} />
      </div>
    </div>
  )
}

function SeasonForm({ name, setName, start, setStart, end, setEnd, sportName, saving, onSubmit }: {
  name: string; setName: (v: string) => void
  start: string; setStart: (v: string) => void
  end: string; setEnd: (v: string) => void
  sportName: string
  saving: boolean; onSubmit: () => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-stone-500">
        For <span className="font-semibold text-stone-700">{sportName}</span>
      </p>
      <FloatingInput
        id="onboard-season-name"
        label="Season name (e.g. Spring 2026)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <div className="grid grid-cols-2 gap-4">
        <FloatingInput
          id="onboard-season-start"
          label="Start date"
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <FloatingInput
          id="onboard-season-end"
          label="End date"
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>
      <div className="pt-1">
        <SubmitButton label="Create Season" saving={saving} disabled={!name.trim() || !start || !end} onSubmit={onSubmit} />
      </div>
    </div>
  )
}

function TeamForm({ name, setName, level, setLevel, sportName, seasonName, saving, onSubmit }: {
  name: string; setName: (v: string) => void
  level: string; setLevel: (v: string) => void
  sportName: string; seasonName: string
  saving: boolean; onSubmit: () => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-stone-500">
        For <span className="font-semibold text-stone-700">{sportName}</span> · <span className="font-semibold text-stone-700">{seasonName}</span>
      </p>
      <FloatingInput
        id="onboard-team-name"
        label="Team name (e.g. Varsity Boys Basketball)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <FloatingDropdown
        id="onboard-team-level"
        label="Competition level"
        value={level}
        onChange={setLevel}
        options={LEVELS}
      />
      <div className="pt-1">
        <SubmitButton label="Create Team" saving={saving} disabled={!name.trim()} onSubmit={onSubmit} />
      </div>
    </div>
  )
}

function GameForm({ opponent, setOpponent, homeAway, setHomeAway, start, setStart, end, setEnd, teamName, saving, onSubmit }: {
  opponent: string; setOpponent: (v: string) => void
  homeAway: string; setHomeAway: (v: string) => void
  start: string; setStart: (v: string) => void
  end: string; setEnd: (v: string) => void
  teamName: string
  saving: boolean; onSubmit: () => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-stone-500">
        For <span className="font-semibold text-stone-700">{teamName}</span>
      </p>
      <FloatingInput
        id="onboard-opponent"
        label="Opponent name"
        value={opponent}
        onChange={(e) => setOpponent(e.target.value)}
        autoFocus
      />
      <FloatingDropdown
        id="onboard-home-away"
        label="Home / Away"
        value={homeAway}
        onChange={setHomeAway}
        options={[
          { value: 'HOME', label: 'Home' },
          { value: 'AWAY', label: 'Away' },
          { value: 'NEUTRAL', label: 'Neutral' },
        ]}
      />
      <div className="grid grid-cols-2 gap-4">
        <FloatingInput
          id="onboard-game-start"
          label="Start time"
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <FloatingInput
          id="onboard-game-end"
          label="End time"
          type="datetime-local"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>
      <div className="pt-1">
        <SubmitButton label="Schedule Game & Finish Setup" saving={saving} disabled={!opponent.trim() || !start || !end} onSubmit={onSubmit} accent />
      </div>
    </div>
  )
}

// ─── Shared submit button ───────────────────────────────────────────

function SubmitButton({ label, saving, disabled, onSubmit, accent }: {
  label: string; saving: boolean; disabled: boolean; onSubmit: () => void; accent?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onSubmit}
      disabled={disabled || saving}
      className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] ${
        accent
          ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-200/50'
          : 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm shadow-slate-300/50'
      }`}
    >
      {saving ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <ArrowRight className="w-4 h-4" />
      )}
      {saving ? 'Saving...' : label}
    </button>
  )
}
