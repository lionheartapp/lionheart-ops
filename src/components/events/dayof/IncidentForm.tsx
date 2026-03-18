'use client'

/**
 * IncidentForm — structured incident logging form for day-of operations.
 *
 * Works offline: if offline, saves to Dexie queue with toast feedback.
 * Supports: type, severity, involved participants, description, actions taken,
 * follow-up needed, and an optional photo attachment.
 */

import { useState, useRef } from 'react'
import {
  HeartPulse,
  ShieldAlert,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  X,
  Camera,
  Loader2,
} from 'lucide-react'
import type { CreateIncidentData } from '@/lib/hooks/useIncidents'
import type { ParticipantStatusEntry } from '@/lib/hooks/useCheckIn'
import type { EventIncidentType, EventIncidentSeverity } from '@/lib/types/events-phase21'

// ─── Types ────────────────────────────────────────────────────────────────────

interface IncidentFormProps {
  eventProjectId: string
  participants: ParticipantStatusEntry[]
  isOnline: boolean
  onSubmit: (data: CreateIncidentData) => Promise<{ success: boolean; offline: boolean }>
  onSuccess?: () => void
}

// ─── Type config ──────────────────────────────────────────────────────────────

const INCIDENT_TYPES: Array<{
  value: EventIncidentType
  label: string
  Icon: React.ComponentType<{ className?: string }>
  color: string
  selectedColor: string
}> = [
  {
    value: 'MEDICAL',
    label: 'Medical',
    Icon: HeartPulse,
    color: 'border-slate-200 text-slate-600',
    selectedColor: 'border-red-400 bg-red-50 text-red-700 ring-2 ring-red-200',
  },
  {
    value: 'BEHAVIORAL',
    label: 'Behavioral',
    Icon: AlertTriangle,
    color: 'border-slate-200 text-slate-600',
    selectedColor: 'border-amber-400 bg-amber-50 text-amber-700 ring-2 ring-amber-200',
  },
  {
    value: 'SAFETY',
    label: 'Safety',
    Icon: ShieldAlert,
    color: 'border-slate-200 text-slate-600',
    selectedColor: 'border-orange-400 bg-orange-50 text-orange-700 ring-2 ring-orange-200',
  },
  {
    value: 'OTHER',
    label: 'Other',
    Icon: HelpCircle,
    color: 'border-slate-200 text-slate-600',
    selectedColor: 'border-blue-400 bg-blue-50 text-blue-700 ring-2 ring-blue-200',
  },
]

const SEVERITY_OPTIONS: Array<{
  value: EventIncidentSeverity
  label: string
  color: string
  selectedColor: string
  dot: string
}> = [
  {
    value: 'MINOR',
    label: 'Minor',
    color: 'border-slate-200 text-slate-600',
    selectedColor: 'border-blue-400 bg-blue-50 text-blue-700 ring-2 ring-blue-200',
    dot: 'bg-blue-400',
  },
  {
    value: 'MODERATE',
    label: 'Moderate',
    color: 'border-slate-200 text-slate-600',
    selectedColor: 'border-amber-400 bg-amber-50 text-amber-700 ring-2 ring-amber-200',
    dot: 'bg-amber-400',
  },
  {
    value: 'SERIOUS',
    label: 'Serious',
    color: 'border-slate-200 text-slate-600',
    selectedColor: 'border-red-400 bg-red-50 text-red-700 ring-2 ring-red-200',
    dot: 'bg-red-500',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function IncidentForm({
  participants,
  isOnline,
  onSubmit,
  onSuccess,
}: IncidentFormProps) {
  const [type, setType] = useState<EventIncidentType>('MEDICAL')
  const [severity, setSeverity] = useState<EventIncidentSeverity>('MINOR')
  const [description, setDescription] = useState('')
  const [actionsTaken, setActionsTaken] = useState('')
  const [followUpNeeded, setFollowUpNeeded] = useState(false)
  const [followUpNotes, setFollowUpNotes] = useState('')
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([])
  const [participantSearch, setParticipantSearch] = useState('')
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'offline' } | null>(null)

  const photoInputRef = useRef<HTMLInputElement | null>(null)

  // ─── Participant selection ───────────────────────────────────────────

  const filteredParticipants = participants.filter((p) => {
    const name = `${p.firstName} ${p.lastName}`.toLowerCase()
    return (
      !selectedParticipantIds.includes(p.registrationId) &&
      (participantSearch === '' || name.includes(participantSearch.toLowerCase()))
    )
  })

  const addParticipant = (id: string) => {
    setSelectedParticipantIds((prev) => [...prev, id])
    setParticipantSearch('')
    setShowParticipantDropdown(false)
  }

  const removeParticipant = (id: string) => {
    setSelectedParticipantIds((prev) => prev.filter((x) => x !== id))
  }

  const getParticipantName = (id: string) => {
    const p = participants.find((p) => p.registrationId === id)
    return p ? `${p.firstName} ${p.lastName}` : id
  }

  // ─── Photo ───────────────────────────────────────────────────────────

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  // ─── Submit ──────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const result = await onSubmit({
        type,
        severity,
        description: description.trim(),
        actionsTaken: actionsTaken.trim() || undefined,
        followUpNeeded,
        followUpNotes: followUpNeeded && followUpNotes.trim() ? followUpNotes.trim() : undefined,
        photoUrl: photoPreview ?? undefined,
        participantIds: selectedParticipantIds,
      })

      if (result.success) {
        if (result.offline) {
          setToast({ message: 'Incident saved offline — will sync when connected', type: 'offline' })
        } else {
          setToast({ message: 'Incident logged successfully', type: 'success' })
        }
        // Reset form
        setType('MEDICAL')
        setSeverity('MINOR')
        setDescription('')
        setActionsTaken('')
        setFollowUpNeeded(false)
        setFollowUpNotes('')
        setSelectedParticipantIds([])
        setPhotoPreview(null)
        setTimeout(() => setToast(null), 3_000)
        onSuccess?.()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-5 px-4 py-5">
      {/* Toast */}
      {toast && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
            toast.type === 'offline'
              ? 'bg-amber-50 border border-amber-200 text-amber-700'
              : 'bg-green-50 border border-green-200 text-green-700'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Offline indicator */}
      {!isOnline && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-600 text-xs">
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
          Offline — incident will be saved locally and synced when connected
        </div>
      )}

      {/* Incident type */}
      <fieldset>
        <legend className="text-sm font-semibold text-slate-700 mb-2">Incident Type</legend>
        <div className="grid grid-cols-4 gap-2">
          {INCIDENT_TYPES.map(({ value, label, Icon, color, selectedColor }) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value)}
              className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                type === value ? selectedColor : `${color} hover:bg-slate-50`
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Severity */}
      <fieldset>
        <legend className="text-sm font-semibold text-slate-700 mb-2">Severity</legend>
        <div className="grid grid-cols-3 gap-2">
          {SEVERITY_OPTIONS.map(({ value, label, color, selectedColor, dot }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSeverity(value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all cursor-pointer ${
                severity === value ? selectedColor : `${color} hover:bg-slate-50`
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Involved participants */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Involved Participants
        </label>

        {/* Selected chips */}
        {selectedParticipantIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedParticipantIds.map((id) => (
              <span
                key={id}
                className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium rounded-full"
              >
                {getParticipantName(id)}
                <button
                  type="button"
                  onClick={() => removeParticipant(id)}
                  className="cursor-pointer hover:text-blue-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Searchable dropdown */}
        <div className="relative">
          <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400">
            <input
              type="text"
              value={participantSearch}
              onChange={(e) => {
                setParticipantSearch(e.target.value)
                setShowParticipantDropdown(true)
              }}
              onFocus={() => setShowParticipantDropdown(true)}
              placeholder="Search participants..."
              className="flex-1 px-3 py-2 text-sm outline-none bg-transparent"
            />
            <ChevronDown className="w-4 h-4 text-slate-400 mr-2" />
          </div>

          {showParticipantDropdown && filteredParticipants.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-auto max-h-48">
              {filteredParticipants.slice(0, 10).map((p) => (
                <button
                  key={p.registrationId}
                  type="button"
                  onClick={() => addParticipant(p.registrationId)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer first:rounded-t-xl last:rounded-b-xl"
                >
                  {p.firstName} {p.lastName}
                  {p.grade && <span className="text-slate-400 ml-1">({p.grade})</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Click-outside to close dropdown */}
        {showParticipantDropdown && (
          <div
            className="fixed inset-0 z-[5]"
            onClick={() => setShowParticipantDropdown(false)}
          />
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={3}
          placeholder="Describe what happened..."
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
        />
      </div>

      {/* Actions taken */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Actions Taken
        </label>
        <textarea
          value={actionsTaken}
          onChange={(e) => setActionsTaken(e.target.value)}
          rows={2}
          placeholder="What was done in response? (optional)"
          className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
        />
      </div>

      {/* Follow-up */}
      <div>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={followUpNeeded}
            onChange={(e) => setFollowUpNeeded(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
          />
          <span className="text-sm font-medium text-slate-700">Follow-up needed</span>
        </label>

        {followUpNeeded && (
          <textarea
            value={followUpNotes}
            onChange={(e) => setFollowUpNotes(e.target.value)}
            rows={2}
            placeholder="Describe required follow-up..."
            className="mt-2 w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        )}
      </div>

      {/* Photo attachment */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Photo</label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            {photoPreview ? 'Change photo' : 'Add photo'}
          </button>

          {photoPreview && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoPreview}
                alt="Incident"
                className="w-12 h-12 rounded-xl object-cover border border-slate-200"
              />
              <button
                type="button"
                onClick={() => setPhotoPreview(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          className="hidden"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!description.trim() || isSubmitting}
        className="w-full py-3 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Logging incident...
          </span>
        ) : isOnline ? (
          'Log Incident'
        ) : (
          'Save Incident Offline'
        )}
      </button>
    </form>
  )
}
