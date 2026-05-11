'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, Clock } from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { useCalendars, type CalendarData } from '@/lib/hooks/useCalendar'
import NotificationPreferences from '@/components/NotificationPreferences'

// ── Types ──────────────────────────────────────────────────────────────

interface CalendarSubscription {
  id: string
  calendarId: string
  notifyOnNew: boolean
  notifyBeforeMinutes: number | null
}

const REMINDER_OPTIONS = [
  { value: null, label: 'None' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
]

// ── Main Component ─────────────────────────────────────────────────────

export default function NotificationsTab() {
  const queryClient = useQueryClient()
  const { data: calendars = [] } = useCalendars()
  const { data: subscriptions = [], isLoading: subsLoading } = useQuery<CalendarSubscription[]>({
    queryKey: ['calendar-subscriptions'],
    queryFn: () => fetchApi('/api/calendar-subscriptions'),
    staleTime: 60_000,
  })

  const toggleNotify = useMutation({
    mutationFn: (data: { calendarId: string; notifyOnNew: boolean }) =>
      fetchApi('/api/calendar-subscriptions', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-subscriptions'] }),
  })

  const updateReminder = useMutation({
    mutationFn: (data: { calendarId: string; notifyBeforeMinutes: number | null }) =>
      fetchApi('/api/calendar-subscriptions', { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-subscriptions'] }),
  })

  const getSubscription = useCallback(
    (calendarId: string) => subscriptions.find((s) => s.calendarId === calendarId),
    [subscriptions],
  )

  // Group calendars: school calendars vs personal
  const schoolCalendars = calendars.filter((c) => c.isActive && c.calendarType !== 'PERSONAL')
  const personalCalendars = calendars.filter((c) => c.isActive && c.calendarType === 'PERSONAL')

  return (
    <div className="space-y-8">
      {/* Section 1: General Notification Preferences */}
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">Notification Preferences</h3>
        <p className="text-sm text-slate-500 mb-4">Choose which notifications you receive by email and in-app.</p>
        <NotificationPreferences />
      </div>

      {/* Section 2: Calendar Subscriptions */}
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">Calendar Subscriptions</h3>
        <p className="text-sm text-slate-500 mb-4">Get notified when new events are added to calendars you follow.</p>

        {subsLoading ? (
          <div className="space-y-3 animate-pulse">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {/* School calendars */}
            {schoolCalendars.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">School Calendars</p>
                <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {schoolCalendars.map((cal) => (
                    <CalendarRow
                      key={cal.id}
                      calendar={cal}
                      subscription={getSubscription(cal.id)}
                      onToggleNotify={(enabled) => toggleNotify.mutate({ calendarId: cal.id, notifyOnNew: enabled })}
                      onChangeReminder={(mins) => updateReminder.mutate({ calendarId: cal.id, notifyBeforeMinutes: mins })}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Personal calendars */}
            {personalCalendars.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">My Calendars</p>
                <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {personalCalendars.map((cal) => (
                    <CalendarRow
                      key={cal.id}
                      calendar={cal}
                      subscription={getSubscription(cal.id)}
                      onToggleNotify={(enabled) => toggleNotify.mutate({ calendarId: cal.id, notifyOnNew: enabled })}
                      onChangeReminder={(mins) => updateReminder.mutate({ calendarId: cal.id, notifyBeforeMinutes: mins })}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Calendar Row ───────────────────────────────────────────────────────

function CalendarRow({
  calendar,
  subscription,
  onToggleNotify,
  onChangeReminder,
}: {
  calendar: CalendarData
  subscription: CalendarSubscription | undefined
  onToggleNotify: (enabled: boolean) => void
  onChangeReminder: (minutes: number | null) => void
}) {
  const isNotify = subscription?.notifyOnNew ?? false
  const reminderMinutes = subscription?.notifyBeforeMinutes ?? null

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: calendar.color }}
        />
        <span className="text-sm font-medium text-slate-700 truncate">{calendar.name}</span>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Notify on new events toggle */}
        <button
          type="button"
          onClick={() => onToggleNotify(!isNotify)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer ${
            isNotify
              ? 'bg-primary-50 text-primary-700'
              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
          }`}
          title={isNotify ? 'Notifications enabled' : 'Enable notifications'}
        >
          {isNotify ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
          {isNotify ? 'On' : 'Off'}
        </button>

        {/* Reminder dropdown */}
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={reminderMinutes ?? ''}
            onChange={(e) => {
              const val = e.target.value
              onChangeReminder(val === '' ? null : parseInt(val, 10))
            }}
            className="text-xs text-slate-600 bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer pr-4"
          >
            {REMINDER_OPTIONS.map((opt) => (
              <option key={String(opt.value)} value={opt.value ?? ''}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
