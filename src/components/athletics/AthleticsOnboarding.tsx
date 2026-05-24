'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { queryOptions, queryKeys } from '@/lib/queries'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Dribbble, CalendarDays, Users, CalendarPlus,
  Check, Loader2, ArrowRight, MapPin,
} from 'lucide-react'
import { FloatingInput, FloatingDropdown } from '@/components/ui/FloatingInput'
import { Select } from '@/components/ui/Select'
import { handleAuthResponse } from '@/lib/client-auth'
import { useModules } from '@/lib/hooks/useModuleEnabled'

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

interface Campus {
  id: string
  name: string
  isActive: boolean
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

const STEPS_META: { key: Step; label: string; icon: typeof Dribbble; optional?: boolean }[] = [
  { key: 'sport', label: 'Add Sport', icon: Dribbble },
  { key: 'season', label: 'Create Season', icon: CalendarDays },
  { key: 'team', label: 'Create Team', icon: Users },
  { key: 'schedule', label: 'Schedule Game', icon: CalendarPlus, optional: true },
]

// ─── Component ──────────────────────────────────────────────────────

export default function AthleticsOnboarding({ activeCampusId, canWrite, onComplete }: OnboardingProps) {
  const queryClient = useQueryClient()
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null

  // ── Campus selector (only campuses with athletics enabled) ────────
  const { data: campusesRaw } = useQuery({
    queryKey: ['campuses-for-athletics'],
    queryFn: async () => {
      const res = await fetch('/api/settings/campus/campuses', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return []
      const data = await res.json()
      return data.ok ? data.data : []
    },
    staleTime: 5 * 60_000,
  })
  const allCampuses = ((campusesRaw ?? []) as Campus[]).filter((c) => c.isActive)
  const { data: enabledModules } = useModules()
  const athleticsCampusIds = useMemo(() => {
    if (!enabledModules) return new Set<string>()
    return new Set(
      enabledModules
        .filter((m) => m.moduleId === 'athletics' && m.campusId)
        .map((m) => m.campusId as string)
    )
  }, [enabledModules])
  const campuses = allCampuses.filter((c) => athleticsCampusIds.has(c.id))

  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(activeCampusId)

  // Default to first athletics-enabled campus if none selected or current selection isn't valid
  useEffect(() => {
    if (campuses.length > 0 && (!selectedCampusId || !campuses.some((c) => c.id === selectedCampusId))) {
      setSelectedCampusId(campuses[0].id)
    }
  }, [campuses, selectedCampusId])

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
  const [activeStep, setActiveStep] = useState<Step>(firstIncomplete)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setActiveStep(firstIncomplete)
  }, [firstIncomplete])

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
      setTimeout(() => setActiveStep('season'), 400)
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
      setTimeout(() => setActiveStep('team'), 400)
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
        ...(selectedCampusId ? { campusId: selectedCampusId } : {}),
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.athleticsTeams.all })
      setTeamName('')
      setTimeout(() => setActiveStep('schedule'), 400)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create team')
    } finally {
      setSaving(false)
    }
  }, [teamName, sports, allSeasons, teamLevel, selectedCampusId, apiPost, queryClient])

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

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto pt-6 pb-12">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-200/50 mb-5">
          <Dribbble className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">Set up your athletics program</h2>
        <p className="text-sm text-stone-500 max-w-sm mx-auto leading-relaxed">
          Four quick steps to get your dashboard, teams, and schedules ready to go.
        </p>
      </div>

      {/* ── Campus selector ─────────────────────────────────────── */}
      {campuses.length > 1 && (
        <div className="mb-8 flex justify-center">
          <div className="inline-flex items-center gap-2.5 bg-white border border-stone-200 rounded-full px-4 py-2 shadow-sm">
            <MapPin className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className="text-sm text-stone-500">Setting up for</span>
            <Select
              value={selectedCampusId ?? ''}
              onChange={setSelectedCampusId}
              options={campuses.map((c) => ({ value: c.id, label: c.name }))}
              size="sm"
            />
          </div>
        </div>
      )}

      {/* ── Horizontal stepper ──────────────────────────────────── */}
      <div className="mb-10 px-2">
        <div className="flex items-start">
          {STEPS_META.map((step, index) => {
            const isCompleted = completedSteps.has(step.key)
            const isActive = activeStep === step.key
            const isLocked = (step.key === 'season' && !hasSport)
              || (step.key === 'team' && (!hasSport || !hasSeason))
              || (step.key === 'schedule' && (!hasSport || !hasSeason || !hasTeam))
            const StepIcon = step.icon

            return (
              <div key={step.key} className="flex-1 flex flex-col items-center relative">
                {/* Connector line (before this step) */}
                {index > 0 && (
                  <div className="absolute top-5 -left-1/2 w-full h-0.5 -translate-y-1/2">
                    <div className={`h-full transition-colors duration-300 ${
                      completedSteps.has(STEPS_META[index - 1].key)
                        ? 'bg-emerald-400'
                        : 'bg-stone-200'
                    }`} />
                  </div>
                )}

                {/* Circle */}
                <button
                  type="button"
                  disabled={isLocked && !isCompleted}
                  onClick={() => {
                    if (!isLocked || isCompleted) {
                      setActiveStep(step.key)
                      setError(null)
                    }
                  }}
                  className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                    isCompleted
                      ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200/60'
                      : isActive
                        ? 'bg-slate-900 text-white shadow-md shadow-slate-300/60 ring-4 ring-slate-900/10'
                        : isLocked
                          ? 'bg-stone-100 text-stone-300 cursor-not-allowed'
                          : 'bg-white border-2 border-stone-200 text-stone-400 hover:border-stone-300 cursor-pointer'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" strokeWidth={2.5} />
                  ) : (
                    <StepIcon className="w-4 h-4" />
                  )}
                </button>

                {/* Label */}
                <span className={`mt-2.5 text-[11px] font-semibold text-center leading-tight ${
                  isActive ? 'text-slate-900' : isCompleted ? 'text-emerald-600' : 'text-stone-400'
                }`}>
                  {step.label}
                </span>

                {/* Status badge */}
                <span className={`mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  isCompleted
                    ? 'bg-emerald-50 text-emerald-600'
                    : isActive
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-transparent text-stone-300'
                }`}>
                  {isCompleted ? 'Done' : isActive ? 'Current' : step.optional ? 'Optional' : 'Pending'}
                </span>
              </div>
            )
          })}
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

      {/* ── Active step form ────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStep}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm"
        >
          {activeStep === 'sport' && (
            completedSteps.has('sport') ? (
              <StepComplete
                label="Sport created"
                detail={
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sports[0]?.color }} />
                    {sports[0]?.name}{sports.length > 1 && ` + ${sports.length - 1} more`}
                  </span>
                }
                onNext={() => setActiveStep('season')}
              />
            ) : (
              <SportForm
                name={sportName} setName={setSportName}
                color={sportColor} setColor={setSportColor}
                seasonType={sportSeasonType} setSeasonType={setSportSeasonType}
                saving={saving} onSubmit={handleCreateSport}
              />
            )
          )}
          {activeStep === 'season' && (
            completedSteps.has('season') ? (
              <StepComplete
                label="Season created"
                detail={allSeasons[0]?.name}
                onNext={() => setActiveStep('team')}
              />
            ) : (
              <SeasonForm
                name={seasonName} setName={setSeasonName}
                start={seasonStart} setStart={setSeasonStart}
                end={seasonEnd} setEnd={setSeasonEnd}
                sportName={sports[0]?.name ?? 'Sport'}
                saving={saving} onSubmit={handleCreateSeason}
              />
            )
          )}
          {activeStep === 'team' && (
            completedSteps.has('team') ? (
              <StepComplete
                label="Team created"
                detail={<span>{teams[0]?.name}{teams.length > 1 && ` + ${teams.length - 1} more`}</span>}
                onNext={() => setActiveStep('schedule')}
              />
            ) : (
              <TeamForm
                name={teamName} setName={setTeamName}
                level={teamLevel} setLevel={setTeamLevel}
                sportName={sports[0]?.name ?? 'Sport'}
                seasonName={allSeasons[0]?.name ?? 'Season'}
                saving={saving} onSubmit={handleCreateTeam}
              />
            )
          )}
          {activeStep === 'schedule' && (
            <GameForm
              opponent={opponentName} setOpponent={setOpponentName}
              homeAway={gameHomeAway} setHomeAway={setGameHomeAway}
              start={gameStart} setStart={setGameStart}
              end={gameEnd} setEnd={setGameEnd}
              teamName={teams[0]?.name ?? 'Team'}
              saving={saving} onSubmit={handleCreateGame}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Finish / Skip ──────────────────────────────────────── */}
      {hasSport && hasSeason && hasTeam ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 text-center space-y-3"
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
      ) : completedSteps.size >= 1 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 text-center"
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

// ─── Step Complete Card ─────────────────────────────────────────────

function StepComplete({ label, detail, onNext }: {
  label: string
  detail: React.ReactNode
  onNext: () => void
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold text-slate-900">{label}</span>
        </div>
        <div className="text-sm text-stone-500 ml-8">{detail}</div>
      </div>
      <button
        type="button"
        onClick={onNext}
        className="text-sm font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 transition-colors"
      >
        Next step
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
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
      <div className="mb-1">
        <h3 className="text-sm font-semibold text-slate-900">Add your first sport</h3>
        <p className="text-xs text-stone-400 mt-0.5">What sports does your school play?</p>
      </div>
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
      <div className="mb-1">
        <h3 className="text-sm font-semibold text-slate-900">Create a season</h3>
        <p className="text-xs text-stone-400 mt-0.5">
          For <span className="font-semibold text-stone-600">{sportName}</span>
        </p>
      </div>
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
      <div className="mb-1">
        <h3 className="text-sm font-semibold text-slate-900">Create a team</h3>
        <p className="text-xs text-stone-400 mt-0.5">
          For <span className="font-semibold text-stone-600">{sportName}</span> · <span className="font-semibold text-stone-600">{seasonName}</span>
        </p>
      </div>
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
      <div className="mb-1">
        <h3 className="text-sm font-semibold text-slate-900">Schedule a game</h3>
        <p className="text-xs text-stone-400 mt-0.5">
          For <span className="font-semibold text-stone-600">{teamName}</span>
          <span className="ml-2 text-[10px] font-medium text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-md uppercase tracking-wide">Optional</span>
        </p>
      </div>
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
