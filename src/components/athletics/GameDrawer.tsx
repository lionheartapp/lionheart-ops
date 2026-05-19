'use client'

import { useState, useEffect, useMemo } from 'react'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput, FloatingDropdown, type DropdownOption } from '@/components/ui/FloatingInput'
import LocationPicker, { defaultLocationData, type LocationData } from '@/components/events/LocationPicker'
import ConflictCard from '@/components/athletics/ConflictCard'
import OverrideReasonModal from '@/components/athletics/OverrideReasonModal'
import { useFacilityAvailability } from '@/lib/hooks/useFacilityAvailability'
import { handleAuthResponse } from '@/lib/client-auth'

interface Team {
  id: string
  name: string
  campusId?: string | null
  sport: { id: string; name: string; color: string }
  season: { id: string; name: string }
}

interface Calendar {
  id: string
  name: string
  calendarType: string
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
  calendarEventId?: string | null
}

interface GameDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  editingGame: Game | null
  teams: Team[]
  calendars: Calendar[]
  preselectedTeamId?: string
  onMessageBooker?: (userId: string) => void
}

type OpponentType = 'in_org' | 'external'

interface FormState {
  athleticTeamId: string
  opponentType: OpponentType
  opponentAthleticTeamId: string
  opponentName: string
  homeAway: string
  startTime: string
  endTime: string
  venue: string
  calendarId: string
}

function toLocalDatetime(isoStr: string): string {
  const d = new Date(isoStr)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

export default function GameDrawer({
  isOpen,
  onClose,
  onSaved,
  editingGame,
  teams,
  calendars,
  preselectedTeamId,
  onMessageBooker,
}: GameDrawerProps) {
  const [locationData, setLocationData] = useState<LocationData>(defaultLocationData())
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [form, setForm] = useState<FormState>({
    athleticTeamId: '',
    opponentType: 'external',
    opponentAthleticTeamId: '',
    opponentName: '',
    homeAway: 'HOME',
    startTime: '',
    endTime: '',
    venue: '',
    calendarId: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Check facility availability when space + time are selected
  const availability = useFacilityAvailability({
    spaceId: locationData.areaId,
    startTime: form.startTime ? new Date(form.startTime).toISOString() : null,
    endTime: form.endTime ? new Date(form.endTime).toISOString() : null,
    enabled: !!(locationData.areaId || locationData.buildingId) && !!form.startTime && !!form.endTime,
  })

  useEffect(() => {
    if (!isOpen) return
    if (editingGame) {
      const isInOrg = Boolean(editingGame.opponentAthleticTeamId)
      setForm({
        athleticTeamId: editingGame.athleticTeamId,
        opponentType: isInOrg ? 'in_org' : 'external',
        opponentAthleticTeamId: editingGame.opponentAthleticTeamId ?? '',
        opponentName: editingGame.opponentName,
        homeAway: editingGame.homeAway,
        startTime: toLocalDatetime(editingGame.startTime),
        endTime: toLocalDatetime(editingGame.endTime),
        venue: editingGame.venue || '',
        calendarId: '',
      })
    } else {
      setForm({
        athleticTeamId: preselectedTeamId || '',
        opponentType: 'external',
        opponentAthleticTeamId: '',
        opponentName: '',
        homeAway: 'HOME',
        startTime: '',
        endTime: '',
        venue: '',
        calendarId: '',
      })
    }
    setError('')
    setLocationData(defaultLocationData())
  }, [isOpen, editingGame, preselectedTeamId])

  const teamOptions: DropdownOption[] = teams.map((t) => ({
    value: t.id,
    label: `${t.name} (${t.sport.name})`,
    color: t.sport.color,
  }))

  // In-org opponent candidates exclude the chosen "our team" (a team can't play
  // itself). All other org teams are eligible — cross-sport is unlikely but
  // not prohibited at this layer.
  const opponentTeamOptions: DropdownOption[] = useMemo(() => {
    return teams
      .filter((t) => t.id !== form.athleticTeamId)
      .map((t) => ({
        value: t.id,
        label: `${t.name} (${t.sport.name})`,
        color: t.sport.color,
      }))
  }, [teams, form.athleticTeamId])

  const athleticsCalendars = calendars.filter((c) => c.calendarType === 'ATHLETICS')
  const calendarOptions: DropdownOption[] = [
    { value: '', label: 'None' },
    ...athleticsCalendars.map((c) => ({ value: c.id, label: c.name })),
  ]

  const handleOpponentTypeChange = (next: OpponentType): void => {
    setForm((prev) => ({
      ...prev,
      opponentType: next,
      // Clear the other channel so we don't submit stale data.
      opponentAthleticTeamId: next === 'in_org' ? prev.opponentAthleticTeamId : '',
      opponentName: next === 'external' ? prev.opponentName : '',
    }))
  }

  const handleOpponentTeamPick = (teamId: string): void => {
    // Pre-fill opponentName with the opponent team's display name so the API
    // (which still requires opponentName) has a sensible value, and so
    // external consumers that key off opponentName keep working.
    const pickedTeam = teams.find((t) => t.id === teamId)
    setForm((prev) => ({
      ...prev,
      opponentAthleticTeamId: teamId,
      opponentName: pickedTeam?.name ?? prev.opponentName,
    }))
  }

  const handleSave = async () => {
    if (!form.athleticTeamId) { setError('Team is required'); return }
    if (form.opponentType === 'in_org') {
      if (!form.opponentAthleticTeamId) { setError('Opponent team is required'); return }
    } else {
      if (!form.opponentName.trim()) { setError('Opponent name is required'); return }
    }
    if (!form.startTime) { setError('Start time is required'); return }
    if (!form.endTime) { setError('End time is required'); return }

    setSaving(true)
    setError('')

    try {
      const token = localStorage.getItem('auth-token')
      // Always send opponentName: either the free-text the user typed (external
      // opponent) or the opponent team's display name (in-org opponent). This
      // keeps the API contract and existing rendering code happy.
      const resolvedOpponentName =
        form.opponentType === 'in_org'
          ? teams.find((t) => t.id === form.opponentAthleticTeamId)?.name ?? form.opponentName.trim()
          : form.opponentName.trim()

      const payload: Record<string, unknown> = {
        opponentName: resolvedOpponentName,
        homeAway: form.homeAway,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        venue: locationData.locationText || form.venue.trim() || undefined,
      }

      // Facility booking fields
      if (locationData.areaId) payload.spaceId = locationData.areaId
      if (locationData.buildingId) payload.buildingId = locationData.buildingId
      if (locationData.roomId) payload.roomId = locationData.roomId

      if (form.opponentType === 'in_org') {
        payload.opponentAthleticTeamId = form.opponentAthleticTeamId
      } else if (editingGame) {
        // Clearing back to external — explicitly null so Prisma sets the FK to null.
        payload.opponentAthleticTeamId = null
      }

      let res: Response
      if (editingGame) {
        res = await fetch(`/api/athletics/games/${editingGame.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        })
      } else {
        payload.athleticTeamId = form.athleticTeamId
        if (form.calendarId) payload.calendarId = form.calendarId
        res = await fetch('/api/athletics/games', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        })
      }

      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!data.ok) { setError(data.error?.message || 'Failed to save game'); return }

      onSaved()
      onClose()
    } catch {
      setError('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const hasInOrgCandidates = opponentTeamOptions.length > 0

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={editingGame ? 'Edit Game' : 'New Game'}
      width="lg"
      footer={
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 transition"
        >
          {saving ? 'Saving...' : editingGame ? 'Update Game' : 'Create Game'}
        </button>
      }
    >
      <div className="space-y-5">
        <FloatingDropdown
          id="game-team"
          label="Team"
          value={form.athleticTeamId}
          onChange={(v) => setForm({ ...form, athleticTeamId: v })}
          options={teamOptions}
          required
          disabled={!!editingGame}
        />

        {/* Opponent picker — toggle between an in-org team and an external opponent. */}
        {hasInOrgCandidates && (
          <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => handleOpponentTypeChange('in_org')}
              className={`flex-1 px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                form.opponentType === 'in_org'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Another team in our org
            </button>
            <button
              type="button"
              onClick={() => handleOpponentTypeChange('external')}
              className={`flex-1 px-4 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                form.opponentType === 'external'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              External opponent
            </button>
          </div>
        )}

        {form.opponentType === 'in_org' && hasInOrgCandidates ? (
          <FloatingDropdown
            id="game-opponent-team"
            label="Opponent Team"
            value={form.opponentAthleticTeamId}
            onChange={handleOpponentTeamPick}
            options={opponentTeamOptions}
            required
          />
        ) : (
          <FloatingInput
            id="game-opponent"
            label="Opponent Name"
            value={form.opponentName}
            onChange={(e) => setForm({ ...form, opponentName: e.target.value })}
            required
          />
        )}

        <FloatingDropdown
          id="game-homeaway"
          label="Home / Away"
          value={form.homeAway}
          onChange={(v) => setForm({ ...form, homeAway: v })}
          options={[
            { value: 'HOME', label: 'Home' },
            { value: 'AWAY', label: 'Away' },
            { value: 'NEUTRAL', label: 'Neutral' },
          ]}
        />

        <FloatingInput
          id="game-start"
          label="Start Date/Time"
          type="datetime-local"
          value={form.startTime}
          onChange={(e) => setForm({ ...form, startTime: e.target.value })}
          required
        />

        <FloatingInput
          id="game-end"
          label="End Date/Time"
          type="datetime-local"
          value={form.endTime}
          onChange={(e) => setForm({ ...form, endTime: e.target.value })}
          required
        />

        {/* Facility picker — on-campus (spaces/buildings) or off-campus (Google Places) */}
        <LocationPicker
          value={locationData}
          onChange={(data) => {
            setLocationData(data)
            setForm((prev) => ({ ...prev, venue: data.locationText }))
          }}
          spaceTypeFilter={['FIELD', 'COURT', 'GYM', 'POOL', 'COMMON']}
        />

        {/* Conflict card */}
        {availability.data && !availability.data.available && (
          <ConflictCard
            conflicts={availability.data.conflicts}
            alternatives={availability.data.alternatives}
            blockedReason={availability.data.blockedReason}
            onMessage={onMessageBooker}
            onPickAlternative={(spaceId) => {
              setLocationData((prev) => ({ ...prev, areaId: spaceId, buildingId: null, roomId: null, locationText: '' }))
            }}
            onOverride={() => setShowOverrideModal(true)}
            canOverride={true}
          />
        )}

        {!editingGame && athleticsCalendars.length > 0 && (
          <FloatingDropdown
            id="game-calendar"
            label="Link to Calendar"
            value={form.calendarId}
            onChange={(v) => setForm({ ...form, calendarId: v })}
            options={calendarOptions}
          />
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <OverrideReasonModal
        isOpen={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
        onConfirm={() => {
          setShowOverrideModal(false)
          handleSave()
        }}
        conflictTitle={availability.data?.conflicts?.[0]?.title}
      />
    </DetailDrawer>
  )
}
