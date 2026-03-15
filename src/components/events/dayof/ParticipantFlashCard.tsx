'use client'

/**
 * ParticipantFlashCard — bottom-half result panel shown after a QR scan.
 *
 * Displays the participant's name, photo, grade, check-in status, group
 * assignments, and (if the caller has medical permission) any medical flags.
 *
 * Slides up from the bottom with a spring animation.
 */

import { motion } from 'framer-motion'
import { CheckCircle2, AlertTriangle, Clock, Shield } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParticipantFlashCardData {
  registrationId: string
  firstName: string
  lastName: string
  photoUrl: string | null
  grade: string | null
  groups: Array<{ id: string; name: string; type: string }>
  medical?: { allergies: string[]; medications: string[] } | null
  checkInStatus: {
    isCheckedIn: boolean
    checkedInAt: string | null
  }
  alreadyCheckedIn: boolean
  fromCache?: boolean
}

interface ParticipantFlashCardProps {
  participant: ParticipantFlashCardData
  hasMedicalPermission: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GROUP_TYPE_LABELS: Record<string, string> = {
  BUS: 'Bus',
  CABIN: 'Cabin',
  SMALL_GROUP: 'Group',
  ACTIVITY: 'Activity',
}

const GROUP_TYPE_COLORS: Record<string, string> = {
  BUS: 'bg-blue-100 text-blue-700 border-blue-200',
  CABIN: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  SMALL_GROUP: 'bg-violet-100 text-violet-700 border-violet-200',
  ACTIVITY: 'bg-amber-100 text-amber-700 border-amber-200',
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ParticipantFlashCard({ participant, hasMedicalPermission }: ParticipantFlashCardProps) {
  const { firstName, lastName, photoUrl, grade, groups, medical, checkInStatus, alreadyCheckedIn } = participant
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()

  const hasMedical = hasMedicalPermission && medical && (medical.allergies.length > 0 || medical.medications.length > 0)

  return (
    <motion.div
      key={participant.registrationId}
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="bg-white rounded-t-3xl shadow-xl px-5 pt-5 pb-6 flex flex-col gap-4"
    >
      {/* Already checked in warning */}
      {alreadyCheckedIn && checkInStatus.checkedInAt && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Already checked in at {formatTime(checkInStatus.checkedInAt)}</span>
        </div>
      )}

      {/* Header row: photo + name + grade + status */}
      <div className="flex items-center gap-4">
        {/* Avatar */}
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={`${firstName} ${lastName}`}
            className="w-20 h-20 rounded-full object-cover flex-shrink-0 border-2 border-gray-100"
          />
        ) : (
          <div
            className="w-20 h-20 rounded-full flex-shrink-0 flex items-center justify-center text-2xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)' }}
          >
            {initials}
          </div>
        )}

        {/* Name + grade + status */}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-gray-900 truncate">
            {firstName} {lastName}
          </h2>

          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {grade && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
                {grade}
              </span>
            )}

            {/* Check-in status badge */}
            {checkInStatus.isCheckedIn ? (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                Checked In
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
                <Clock className="w-3 h-3" />
                Not Yet
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Group assignments */}
      {groups.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <span
              key={g.id}
              className={`px-2.5 py-1 text-xs font-medium rounded-full border ${
                GROUP_TYPE_COLORS[g.type] ?? 'bg-gray-100 text-gray-600 border-gray-200'
              }`}
            >
              {GROUP_TYPE_LABELS[g.type] ?? g.type}: {g.name}
            </span>
          ))}
        </div>
      )}

      {/* Medical flags — only shown with medical permission */}
      {hasMedical && medical && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-red-700 font-semibold text-sm">
            <Shield className="w-4 h-4" />
            Medical Flags
          </div>
          {medical.allergies.length > 0 && (
            <div className="text-xs text-red-600">
              <span className="font-medium">Allergies: </span>
              {medical.allergies.join(', ')}
            </div>
          )}
          {medical.medications.length > 0 && (
            <div className="text-xs text-red-600">
              <span className="font-medium">Medications: </span>
              {medical.medications.join(', ')}
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}
