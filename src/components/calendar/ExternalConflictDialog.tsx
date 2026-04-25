'use client'

import React from 'react'
import { AlertTriangle, ExternalLink, Calendar, Clock } from 'lucide-react'

export type ExternalConflict = {
  id: string
  provider: string
  title: string
  startsAt: string
  endsAt: string
  isAllDay: boolean
  location: string | null
  url: string | null
}

type Props = {
  isOpen: boolean
  conflicts: ExternalConflict[]
  onCancel: () => void
  onContinue: () => void
  proposedTitle?: string
}

function formatRange(startIso: string, endIso: string, isAllDay: boolean): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (isAllDay) {
    return start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ' · all day'
  }
  const sameDay = start.toDateString() === end.toDateString()
  const dateFmt = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  const startTime = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const endTime = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return sameDay ? `${dateFmt} · ${startTime} – ${endTime}` : `${dateFmt} ${startTime} – ${end.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
}

function providerLabel(provider: string): string {
  if (provider === 'google_calendar') return 'Google Calendar'
  if (provider === 'microsoft_calendar') return 'Microsoft Calendar'
  return provider
}

/**
 * Blocking modal shown when a user attempts to create a Lionheart event during
 * a time window that overlaps one of their connected external calendar events.
 * The user can cancel (go back and pick a new time) or continue anyway
 * (override — the Lionheart event is still created).
 */
export default function ExternalConflictDialog({ isOpen, conflicts, onCancel, onContinue, proposedTitle }: Props) {
  if (!isOpen || conflicts.length === 0) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="ext-conflict-title">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 id="ext-conflict-title" className="text-lg font-semibold text-slate-900">
                You already have {conflicts.length === 1 ? 'something' : `${conflicts.length} things`} booked
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {proposedTitle
                  ? `"${proposedTitle}" overlaps `
                  : 'This new event overlaps '}
                {conflicts.length === 1 ? 'an event on your personal calendar.' : 'events on your personal calendar.'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 bg-slate-50/50">
            {conflicts.slice(0, 5).map((c) => (
              <div key={c.id} className="p-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900 truncate">{c.title}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {providerLabel(c.provider)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                    <Clock className="w-3 h-3 flex-shrink-0" />
                    {formatRange(c.startsAt, c.endsAt, c.isAllDay)}
                  </div>
                  {c.location && (
                    <div className="text-xs text-slate-400 mt-0.5 truncate">{c.location}</div>
                  )}
                </div>
                {c.url && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-slate-400 hover:text-slate-600 p-1 rounded transition-colors"
                    aria-label="Open in calendar"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            ))}
            {conflicts.length > 5 && (
              <div className="p-3 text-xs text-slate-500">
                + {conflicts.length - 5} more…
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition cursor-pointer"
          >
            Pick a different time
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition cursor-pointer"
          >
            Book it anyway
          </button>
        </div>
      </div>
    </div>
  )
}
