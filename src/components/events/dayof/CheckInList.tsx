'use client'

/**
 * CheckInList — list view alternative to the QR scanner for manual check-in.
 *
 * Searchable list of all participants sorted with unchecked-in first.
 * Clicking a row toggles check-in with a confirmation step.
 */

import { useState, useMemo } from 'react'
import { Search, QrCode, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import type { UseCheckInReturn, ParticipantStatusEntry } from '@/lib/hooks/useCheckIn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckInListProps {
  useCheckInData: UseCheckInReturn
  onSwitchToScanner: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// ─── Row component ────────────────────────────────────────────────────────────

interface ParticipantRowProps {
  participant: ParticipantStatusEntry
  onToggle: (p: ParticipantStatusEntry) => void
  isProcessing: boolean
}

function ParticipantRow({ participant, onToggle, isProcessing }: ParticipantRowProps) {
  const { firstName, lastName, photoUrl, grade, isCheckedIn, checkedInAt } = participant
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()

  return (
    <button
      onClick={() => onToggle(participant)}
      disabled={isProcessing}
      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors duration-150 cursor-pointer text-left disabled:opacity-50 disabled:cursor-default border-b border-gray-100 last:border-0`}
    >
      {/* Avatar */}
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={`${firstName} ${lastName}`}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-gray-100"
        />
      ) : (
        <div
          className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)' }}
        >
          {initials}
        </div>
      )}

      {/* Name + grade */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">
          {firstName} {lastName}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {grade && <span className="text-xs text-gray-500">{grade}</span>}
          {isCheckedIn && checkedInAt && (
            <span className="text-xs text-green-600">Checked in {formatTime(checkedInAt)}</span>
          )}
        </div>
      </div>

      {/* Status icon */}
      <div className="flex-shrink-0">
        {isProcessing ? (
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        ) : isCheckedIn ? (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : (
          <Circle className="w-5 h-5 text-gray-300" />
        )}
      </div>
    </button>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CheckInList({ useCheckInData, onSwitchToScanner }: CheckInListProps) {
  const { counter, checkInList, checkIn, undoCheckIn, isLoading, refreshList } = useCheckInData

  const [search, setSearch] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  // ─── Search filter ───────────────────────────────────────────────────

  const filteredList = useMemo(() => {
    if (!search.trim()) return checkInList
    const q = search.toLowerCase()
    return checkInList.filter(
      (p) =>
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q) ||
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
    )
  }, [checkInList, search])

  // ─── Toggle handler ──────────────────────────────────────────────────

  const handleToggle = async (participant: ParticipantStatusEntry) => {
    if (processingId) return

    // If already checked in, confirm undo
    if (participant.isCheckedIn) {
      if (confirmId === participant.registrationId) {
        // Second tap — do undo
        setConfirmId(null)
        setProcessingId(participant.registrationId)
        try {
          await undoCheckIn(participant.registrationId)
          await refreshList()
        } finally {
          setProcessingId(null)
        }
      } else {
        // First tap — ask for confirmation
        setConfirmId(participant.registrationId)
        // Auto-clear confirmation after 3s
        setTimeout(() => setConfirmId((prev) => (prev === participant.registrationId ? null : prev)), 3_000)
      }
      return
    }

    // Not checked in — perform check-in
    setProcessingId(participant.registrationId)
    try {
      await checkIn(participant.registrationId, 'MANUAL')
      await refreshList()
    } finally {
      setProcessingId(null)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────

  const progressPct = counter.total > 0 ? Math.round((counter.checkedIn / counter.total) * 100) : 0

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-900">
            {counter.checkedIn} / {counter.total} checked in
          </span>
          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #3B82F6, #6366F1)',
              }}
            />
          </div>
        </div>

        <button
          onClick={onSwitchToScanner}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 transition-colors cursor-pointer"
        >
          <QrCode className="w-3.5 h-3.5" />
          Scan QR
        </button>
      </div>

      {/* ── Search ── */}
      <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search participants..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          />
        </div>
      </div>

      {/* ── Confirm undo banner ── */}
      {confirmId && (
        <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-700 text-sm text-center flex-shrink-0">
          Tap again to undo this check-in
        </div>
      )}

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
          </div>
        ) : filteredList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm">
            {search ? `No participants matching "${search}"` : 'No participants found'}
          </div>
        ) : (
          filteredList.map((participant) => (
            <ParticipantRow
              key={participant.registrationId}
              participant={participant}
              onToggle={handleToggle}
              isProcessing={processingId === participant.registrationId}
            />
          ))
        )}
      </div>
    </div>
  )
}
