'use client'

import { useState } from 'react'
import {
  RefreshCw,
  Unlink,
  ExternalLink,
  ArrowRight,
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import { IntegrationCard, ScopeLabel } from './IntegrationCard'
import { BrandLogo } from './BrandLogo'
import { StatusPill } from './StatusPill'
import { ConfigRequiredBanner } from './ConfigRequiredBanner'
import { formatRelative } from './integration-types'
import type { IntegrationStatusData } from './integration-types'

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
    setDisconnecting(true)
    try {
      const token = localStorage.getItem('auth-token')
      await fetch('/api/integrations/google-calendar/sync', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      toast('Google Calendar disconnected', 'success')
      onRefresh()
    } catch {
      toast('Failed to disconnect', 'error')
    } finally {
      setDisconnecting(false)
    }
  }

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
              onClick={handleDisconnect}
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
    </IntegrationCard>
  )
}
