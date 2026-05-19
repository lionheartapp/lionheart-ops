'use client'

import { MessageSquare, ArrowRightLeft, AlertTriangle } from 'lucide-react'
import type { ConflictInfo, AlternativeSpace } from '@/lib/services/facilityBookingService'

interface ConflictCardProps {
  conflicts: ConflictInfo[]
  alternatives: AlternativeSpace[]
  blockedReason?: string
  /** Called when user taps "Message" — parent handles DM creation */
  onMessage?: (bookerUserId: string) => void
  /** Called when user picks an alternative space */
  onPickAlternative?: (spaceId: string) => void
  /** Called when user taps "Book anyway" — parent handles override flow */
  onOverride?: () => void
  /** Whether the current user has override permission */
  canOverride?: boolean
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date))
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

function getBookerName(booker: ConflictInfo['bookedBy']): string {
  if (!booker) return 'Unknown'
  if (booker.firstName && booker.lastName) return `${booker.firstName} ${booker.lastName}`
  return booker.name ?? booker.email
}

export default function ConflictCard({
  conflicts,
  alternatives,
  blockedReason,
  onMessage,
  onPickAlternative,
  onOverride,
  canOverride = false,
}: ConflictCardProps) {
  // Space is blocked (maintenance/closed/blackout) — no booking actions
  if (blockedReason) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">Unavailable</p>
            <p className="text-sm text-red-700 mt-0.5">{blockedReason}</p>
          </div>
        </div>

        {alternatives.length > 0 && (
          <div className="mt-3 pt-3 border-t border-red-100">
            <p className="text-xs font-medium text-red-700 mb-2">Available alternatives:</p>
            <div className="space-y-1">
              {alternatives.map((alt) => (
                <button
                  key={alt.id}
                  type="button"
                  onClick={() => onPickAlternative?.(alt.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-red-100 rounded-lg text-left text-sm text-slate-700 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <span className="flex-1">{alt.name}</span>
                  {alt.building && (
                    <span className="text-[10px] text-slate-400">{alt.building.name}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (conflicts.length === 0) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-start gap-2.5 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm font-semibold text-amber-800">
          Schedule Conflict{conflicts.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Conflict details */}
      <div className="space-y-2">
        {conflicts.map((conflict) => (
          <div
            key={conflict.id}
            className="bg-white border border-amber-100 rounded-lg p-3"
          >
            <p className="text-sm font-medium text-slate-800">{conflict.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{conflict.location}</p>
            <p className="text-xs text-slate-500">
              {formatDate(conflict.startTime)} &middot; {formatTime(conflict.startTime)} &ndash; {formatTime(conflict.endTime)}
            </p>
            {conflict.bookedBy && (
              <p className="text-xs text-slate-400 mt-1">
                Booked by: {getBookerName(conflict.bookedBy)}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3">
        {conflicts[0]?.bookedBy && onMessage && (
          <button
            type="button"
            onClick={() => onMessage(conflicts[0].bookedBy!.id)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Message
          </button>
        )}

        {alternatives.length > 0 && onPickAlternative && (
          <button
            type="button"
            onClick={() => onPickAlternative(alternatives[0].id)}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-full hover:bg-gray-50 active:scale-[0.97] transition-all cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Try Another Space
          </button>
        )}
      </div>

      {/* Override — intentionally less prominent */}
      {canOverride && onOverride && (
        <button
          type="button"
          onClick={onOverride}
          className="mt-2 text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          Book anyway (override)
        </button>
      )}
    </div>
  )
}
