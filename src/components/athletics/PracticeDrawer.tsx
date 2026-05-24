'use client'

import { useState, useEffect } from 'react'
import DetailDrawer from '@/components/DetailDrawer'
import { Checkbox } from '@/components/ui/Checkbox'
import { FloatingInput, FloatingDropdown, FloatingTextarea, type DropdownOption } from '@/components/ui/FloatingInput'
import RRuleBuilder from '@/components/athletics/RRuleBuilder'
import LocationPicker, { defaultLocationData, type LocationData } from '@/components/events/LocationPicker'
import ConflictCard from '@/components/athletics/ConflictCard'
import OverrideReasonModal from '@/components/athletics/OverrideReasonModal'
import { useFacilityAvailability } from '@/lib/hooks/useFacilityAvailability'
import { handleAuthResponse } from '@/lib/client-auth'

interface Team {
  id: string
  name: string
  sport: { id: string; name: string; color: string }
  season: { id: string; name: string }
}

interface EditingPractice {
  id: string
  athleticTeamId: string
  startTime: string
  endTime: string
  location: string | null
  notes: string | null
  rrule: string | null
}

interface Calendar {
  id: string
  name: string
  calendarType: string
}

interface PracticeDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  teams: Team[]
  calendars?: Calendar[]
  preselectedTeamId?: string
  editingPractice?: EditingPractice | null
  onMessageBooker?: (userId: string) => void
}

function toLocalDatetime(isoStr: string): string {
  const d = new Date(isoStr)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

export default function PracticeDrawer({
  isOpen,
  onClose,
  onSaved,
  teams,
  calendars = [],
  preselectedTeamId,
  editingPractice = null,
  onMessageBooker,
}: PracticeDrawerProps) {
  const [form, setForm] = useState({
    athleticTeamId: '',
    startTime: '',
    endTime: '',
    location: '',
    notes: '',
    recurring: false,
    rrule: '',
  })
  const [locationData, setLocationData] = useState<LocationData>(defaultLocationData())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [overrideReason, setOverrideReason] = useState<string | null>(null)

  // Check facility availability when space + time are selected
  const availability = useFacilityAvailability({
    spaceId: locationData.buildingId && !locationData.areaId ? null : locationData.areaId, // areaId = spaceId in LocationPicker
    startTime: form.startTime ? new Date(form.startTime).toISOString() : null,
    endTime: form.endTime ? new Date(form.endTime).toISOString() : null,
    enabled: !!(locationData.areaId || locationData.buildingId) && !!form.startTime && !!form.endTime,
  })

  useEffect(() => {
    if (!isOpen) return
    if (editingPractice) {
      setForm({
        athleticTeamId: editingPractice.athleticTeamId,
        startTime: toLocalDatetime(editingPractice.startTime),
        endTime: toLocalDatetime(editingPractice.endTime),
        location: editingPractice.location || '',
        notes: editingPractice.notes || '',
        recurring: Boolean(editingPractice.rrule),
        rrule: editingPractice.rrule || '',
      })
    } else {
      setForm({
        athleticTeamId: preselectedTeamId || '',
        startTime: '',
        endTime: '',
        location: '',
        notes: '',
        recurring: false,
        rrule: '',
      })
    }
    setLocationData(defaultLocationData())
    setError('')
    setOverrideReason(null)
  }, [isOpen, editingPractice, preselectedTeamId])

  const teamOptions: DropdownOption[] = teams.map((t) => ({
    value: t.id,
    label: `${t.name} (${t.sport.name})`,
    color: t.sport.color,
  }))

  const handleSave = async () => {
    if (!form.athleticTeamId) { setError('Team is required'); return }
    if (!form.startTime) { setError('Start time is required'); return }
    if (!form.endTime) { setError('End time is required'); return }

    setSaving(true)
    setError('')

    try {
      const token = localStorage.getItem('auth-token')
      const payload: Record<string, unknown> = {
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        location: locationData.locationText || form.location.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }
      if (form.recurring && form.rrule) {
        payload.rrule = form.rrule
      }

      // Facility booking fields (passed through to CalendarEvent)
      if (locationData.areaId) payload.spaceId = locationData.areaId
      if (locationData.buildingId) payload.buildingId = locationData.buildingId

      let res: Response
      if (editingPractice) {
        res = await fetch(`/api/athletics/practices/${editingPractice.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        })
      } else {
        payload.athleticTeamId = form.athleticTeamId
        // Auto-link to first athletics calendar if available
        const athleticsCalendar = calendars.find((c) => c.calendarType === 'ATHLETICS')
        if (athleticsCalendar) payload.calendarId = athleticsCalendar.id
        res = await fetch('/api/athletics/practices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        })
      }

      if (handleAuthResponse(res)) return
      const data = await res.json()
      if (!data.ok) { setError(data.error?.message || `Failed to ${editingPractice ? 'update' : 'create'} practice`); return }

      onSaved()
      onClose()
    } catch {
      setError('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={editingPractice ? 'Edit Practice' : 'New Practice'}
      width="lg"
      footer={
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 transition"
        >
          {saving ? 'Saving...' : editingPractice ? 'Update Practice' : 'Create Practice'}
        </button>
      }
    >
      <div className="space-y-5">
        <FloatingDropdown
          id="practice-team"
          label="Team"
          value={form.athleticTeamId}
          onChange={(v) => setForm({ ...form, athleticTeamId: v })}
          options={teamOptions}
          required
          disabled={!!editingPractice}
        />

        <FloatingInput
          id="practice-start"
          label="Start Date/Time"
          type="datetime-local"
          value={form.startTime}
          onChange={(e) => setForm({ ...form, startTime: e.target.value })}
          required
        />

        <FloatingInput
          id="practice-end"
          label="End Date/Time"
          type="datetime-local"
          value={form.endTime}
          onChange={(e) => setForm({ ...form, endTime: e.target.value })}
          required
        />

        {/* Facility picker — replaces the plain text location input */}
        <LocationPicker
          value={locationData}
          onChange={(data) => {
            setLocationData(data)
            // Keep text location in sync for display fallback
            setForm((prev) => ({ ...prev, location: data.locationText }))
          }}
          spaceTypeFilter={['FIELD', 'COURT', 'GYM', 'POOL', 'COMMON']}
        />

        {/* Conflict card — shown when space + time are selected and there's a conflict */}
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

        <FloatingTextarea
          id="practice-notes"
          label="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
        />

        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={form.recurring}
            onChange={(e) => setForm({ ...form, recurring: e.target.checked, rrule: e.target.checked ? form.rrule : '' })}
          />
          <span className="text-sm text-stone-700">Make recurring</span>
        </label>

        {form.recurring && (
          <div className="pl-6 border-l-2 border-primary-200">
            <RRuleBuilder
              value={form.rrule}
              onChange={(rrule) => setForm({ ...form, rrule })}
            />
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <OverrideReasonModal
        isOpen={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
        onConfirm={(reason) => {
          setOverrideReason(reason)
          setShowOverrideModal(false)
          // Trigger save with override
          handleSave()
        }}
        conflictTitle={availability.data?.conflicts?.[0]?.title}
      />
    </DetailDrawer>
  )
}
