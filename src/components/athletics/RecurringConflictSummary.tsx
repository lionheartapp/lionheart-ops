'use client'

import { useState } from 'react'
import { MessageSquare, SkipForward, AlertTriangle, Check } from 'lucide-react'
import type { BulkCheckResult } from '@/lib/services/facilityBookingService'

interface RecurringConflictSummaryProps {
  results: BulkCheckResult[]
  /** Called when user taps "Message" on a specific conflict */
  onMessage?: (bookerUserId: string) => void
  /** Called when user skips a specific date (exclude from rrule) */
  onSkipDate?: (date: Date) => void
  /** Called when user confirms booking the available dates only */
  onBookAvailable?: (availableDates: Date[]) => void
  /** Called when user overrides and books all including conflicts */
  onOverrideAll?: () => void
  /** Whether the current user has override permission */
  canOverride?: boolean
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date))
}

function getBookerName(booker: {
  firstName?: string | null
  lastName?: string | null
  name?: string | null
  email: string
} | null): string {
  if (!booker) return 'Unknown'
  if (booker.firstName && booker.lastName) return `${booker.firstName} ${booker.lastName}`
  return booker.name ?? booker.email
}

export default function RecurringConflictSummary({
  results,
  onMessage,
  onSkipDate,
  onBookAvailable,
  onOverrideAll,
  canOverride = false,
}: RecurringConflictSummaryProps) {
  const [skippedDates, setSkippedDates] = useState<Set<string>>(new Set())

  const available = results.filter((r) => r.available)
  const conflicting = results.filter((r) => !r.available)
  const totalDates = results.length
  const availableCount = available.length + skippedDates.size // skipped conflicts = resolved

  if (conflicting.length === 0) return null

  const handleSkip = (result: BulkCheckResult) => {
    const dateKey = result.startTime.toISOString()
    setSkippedDates((prev) => new Set([...prev, dateKey]))
    onSkipDate?.(result.startTime)
  }

  const handleBookAvailable = () => {
    const dates = results
      .filter((r) => r.available || skippedDates.has(r.startTime.toISOString()))
      .map((r) => r.startTime)
    onBookAvailable?.(dates)
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      {/* Summary header */}
      <div className="flex items-center gap-2.5 mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-800">
            {availableCount} of {totalDates} dates available
          </p>
          <p className="text-xs text-amber-600 mt-0.5">
            {conflicting.length - skippedDates.size} conflict{conflicting.length - skippedDates.size !== 1 ? 's' : ''} remaining
          </p>
        </div>
      </div>

      {/* Conflict list */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {conflicting.map((result) => {
          const dateKey = result.startTime.toISOString()
          const isSkipped = skippedDates.has(dateKey)

          return (
            <div
              key={dateKey}
              className={`rounded-lg p-3 transition-all ${
                isSkipped
                  ? 'bg-slate-50 border border-slate-100 opacity-60'
                  : 'bg-white border border-amber-100'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {formatDate(result.startTime)} &middot; {formatTime(result.startTime)} &ndash; {formatTime(result.endTime)}
                  </p>
                  {result.conflict && (
                    <>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {result.conflict.title}
                      </p>
                      {result.conflict.bookedBy && (
                        <p className="text-xs text-slate-400">
                          by {getBookerName(result.conflict.bookedBy)}
                        </p>
                      )}
                    </>
                  )}
                  {result.blockedReason && (
                    <p className="text-xs text-red-600 mt-0.5">{result.blockedReason}</p>
                  )}
                </div>

                {isSkipped ? (
                  <span className="flex items-center gap-1 text-[10px] text-slate-400 flex-shrink-0">
                    <Check className="w-3 h-3" /> Skipped
                  </span>
                ) : (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {result.conflict?.bookedBy && onMessage && (
                      <button
                        type="button"
                        onClick={() => onMessage(result.conflict!.bookedBy!.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                        title="Message booker"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSkip(result)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                      title="Skip this date"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Actions — sticky on mobile for long lists */}
      <div className="mt-3 pt-3 border-t border-amber-100 sticky bottom-0 bg-amber-50">
        <button
          type="button"
          onClick={handleBookAvailable}
          className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer"
        >
          Book {availableCount} available date{availableCount !== 1 ? 's' : ''}
        </button>

        {canOverride && onOverrideAll && (
          <button
            type="button"
            onClick={onOverrideAll}
            className="ml-3 text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            Book all {totalDates} anyway (override)
          </button>
        )}
      </div>
    </div>
  )
}
