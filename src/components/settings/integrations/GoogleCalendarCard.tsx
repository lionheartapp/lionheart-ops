'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Unlink,
  ExternalLink,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { IntegrationCard, ScopeLabel } from './IntegrationCard'
import { BrandLogo } from './BrandLogo'
import { StatusPill } from './StatusPill'
import { ConfigRequiredBanner } from './ConfigRequiredBanner'
import { formatRelative } from './integration-types'
import { Checkbox } from '@/components/ui/Checkbox'
import type { IntegrationStatusData } from './integration-types'

interface GoogleCalendarInfo {
  id: string
  summary: string
  description?: string
  primary: boolean
  backgroundColor?: string
  selected: boolean
}

export function GoogleCalendarCard({
  status,
  onRefresh,
}: {
  status: IntegrationStatusData['googleCalendar']
  onRefresh: () => void
}) {
  const { toast } = useToast()
  const [disconnecting, setDisconnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  // UX-006: confirm before disconnecting Google Calendar — wipes the OAuth
  // token and any saved calendar selections.
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false)

  // Calendar picker state
  const [showCalendarPicker, setShowCalendarPicker] = useState(false)
  const [calendars, setCalendars] = useState<GoogleCalendarInfo[]>([])
  const [calendarsLoading, setCalendarsLoading] = useState(false)
  const [savingCalendars, setSavingCalendars] = useState(false)

  const fetchCalendars = useCallback(async () => {
    setCalendarsLoading(true)
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch('/api/integrations/google-calendar/calendars', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.ok) {
        setCalendars(data.data.calendars)
      }
    } catch {
      toast('Failed to load calendars', 'error')
    } finally {
      setCalendarsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (showCalendarPicker && calendars.length === 0) {
      fetchCalendars()
    }
  }, [showCalendarPicker, calendars.length, fetchCalendars])

  const toggleCalendar = (calendarId: string) => {
    setCalendars((prev) =>
      prev.map((c) => (c.id === calendarId ? { ...c, selected: !c.selected } : c))
    )
  }

  const saveCalendarSelection = async () => {
    const selectedIds = calendars.filter((c) => c.selected).map((c) => c.id)
    if (selectedIds.length === 0) {
      toast('Select at least one calendar', 'error')
      return
    }
    setSavingCalendars(true)
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch('/api/integrations/google-calendar/calendars', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarIds: selectedIds }),
      })
      const data = await res.json()
      if (data.ok) {
        toast('Calendar selection saved', 'success')
        setShowCalendarPicker(false)
      } else {
        toast(data.error?.message || 'Failed to save', 'error')
      }
    } catch {
      toast('Failed to save calendar selection', 'error')
    } finally {
      setSavingCalendars(false)
    }
  }

  const handleConnect = async () => {
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch('/api/integrations/google-calendar/auth', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.ok && data.data?.authUrl) {
        window.location.href = data.data.authUrl
      } else {
        toast(data.error?.message || 'Failed to start Google Calendar connection', 'error')
      }
    } catch {
      toast('Failed to connect Google Calendar', 'error')
    }
  }

  const handleSyncNow = async () => {
    setSyncing(true)
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch('/api/integrations/google-calendar/sync-inbound', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        toast(data.error?.message || 'Sync failed', 'error')
        return
      }
      const { imported = 0, deleted = 0 } = data.data ?? {}
      const parts: string[] = []
      if (imported > 0) parts.push(`${imported} event${imported === 1 ? '' : 's'} synced`)
      if (deleted > 0) parts.push(`${deleted} removed`)
      toast(parts.length ? parts.join(' · ') : 'Calendar is already up to date', 'success')
      onRefresh()
    } catch {
      toast('Failed to sync Google Calendar', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    setConfirmDisconnectOpen(false)
    setDisconnecting(true)
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch('/api/integrations/google-calendar/sync', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        toast(data.error?.message || 'Failed to disconnect', 'error')
        return
      }
      // Reset local state so the UI immediately shows disconnected
      setCalendars([])
      setShowCalendarPicker(false)
      toast('Google Calendar disconnected', 'success')
      onRefresh()
    } catch {
      toast('Failed to disconnect', 'error')
    } finally {
      setDisconnecting(false)
    }
  }

  const selectedCount = calendars.filter((c) => c.selected).length

  return (
    <IntegrationCard>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <BrandLogo src="/logos/google-calendar.svg" alt="Google Calendar" size={44} />
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-slate-900">Google Calendar</h3>
            <ScopeLabel scope="Personal" />
          </div>
        </div>
        <StatusPill isConnected={status.isConnected} />
      </div>

      {/* Description */}
      <p className="text-[13px] text-slate-500 leading-relaxed flex-grow">
        Pull events from your personal Google Calendar into Lionheart so you see conflicts when booking,
        and push Lionheart events back to your calendar.
      </p>

      {!status.isAvailable ? (
        <ConfigRequiredBanner serviceName="Google Calendar" />
      ) : status.isConnected ? (
        <>
          {status.userName && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              Signed in as <span className="font-medium text-slate-700">{status.userName}</span>
            </div>
          )}
          <p className="text-xs text-slate-400">Last sync: {formatRelative(status.lastSyncAt)}</p>

          {/* Calendar picker toggle */}
          <button
            onClick={() => setShowCalendarPicker(!showCalendarPicker)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
          >
            {showCalendarPicker ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Choose calendars to sync
            {selectedCount > 0 && !showCalendarPicker && (
              <span className="text-[10px] text-slate-400">({selectedCount} selected)</span>
            )}
          </button>

          {/* Calendar picker list */}
          {showCalendarPicker && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              {calendarsLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading calendars...
                </div>
              ) : calendars.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">No calendars found</div>
              ) : (
                <>
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {calendars.map((cal) => (
                      <label
                        key={cal.id}
                        className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <div className="relative flex items-center">
                          <Checkbox
                            checked={cal.selected}
                            onChange={() => toggleCalendar(cal.id)}
                            className="sr-only"
                          />
                          <div className={`w-4.5 h-4.5 rounded flex items-center justify-center border transition-colors ${
                            cal.selected
                              ? 'bg-slate-900 border-slate-900'
                              : 'border-slate-300 bg-white'
                          }`}>
                            {cal.selected && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </div>
                        {cal.backgroundColor && (
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cal.backgroundColor }}
                          />
                        )}
                        <span className="text-sm text-slate-700 flex-1 truncate">
                          {cal.summary}
                          {cal.primary && <span className="text-[10px] text-slate-400 ml-1.5">(primary)</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border-t border-slate-200">
                    <span className="text-xs text-slate-400">{selectedCount} selected</span>
                    <button
                      onClick={saveCalendarSelection}
                      disabled={savingCalendars || selectedCount === 0}
                      className="px-3.5 py-1.5 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {savingCalendars ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
            <button
              onClick={() => setConfirmDisconnectOpen(true)}
              disabled={disconnecting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Unlink className="w-3.5 h-3.5" />
              Disconnect
            </button>

            <a
              href="https://calendar.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Calendar
            </a>
          </div>
        </>
      ) : (
        <button
          onClick={handleConnect}
          className="mt-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-all duration-200 cursor-pointer group/btn"
        >
          Connect
          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
        </button>
      )}
      <ConfirmDialog
        isOpen={confirmDisconnectOpen}
        onClose={() => setConfirmDisconnectOpen(false)}
        onConfirm={handleDisconnect}
        title="Disconnect Google Calendar?"
        message="You'll need to reauthorize to reconnect. Saved calendar selections will be lost and any in-progress sync will stop."
        confirmText="Disconnect"
        cancelText="Keep connected"
        variant="danger"
        isLoading={disconnecting}
        loadingText="Disconnecting..."
      />
    </IntegrationCard>
  )
}
