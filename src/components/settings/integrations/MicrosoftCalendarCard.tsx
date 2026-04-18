'use client'

import { useState } from 'react'
import {
  RefreshCw,
  Unlink,
  ArrowRight,
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import { IntegrationCard, ScopeLabel } from './IntegrationCard'
import { BrandLogo } from './BrandLogo'
import { StatusPill } from './StatusPill'
import { ConfigRequiredBanner } from './ConfigRequiredBanner'
import { formatRelative } from './integration-types'
import type { IntegrationStatusData } from './integration-types'

export function MicrosoftCalendarCard({
  status,
  onRefresh,
}: {
  status: IntegrationStatusData['microsoftCalendar']
  onRefresh: () => void
}) {
  const { toast } = useToast()
  const [disconnecting, setDisconnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const handleConnect = async () => {
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch('/api/integrations/microsoft-calendar/auth', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.ok && data.data?.authUrl) {
        window.open(data.data.authUrl, '_blank', 'width=600,height=700,scrollbars=yes')
        toast('Complete the Microsoft sign-in in the popup, then refresh this page.', 'info')
      } else {
        toast(data.error?.message || 'Failed to start Microsoft Calendar connection', 'error')
      }
    } catch {
      toast('Failed to connect Microsoft Calendar', 'error')
    }
  }

  const handleSyncNow = async () => {
    setSyncing(true)
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch('/api/integrations/microsoft-calendar/sync-inbound', {
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
      toast('Failed to sync Microsoft Calendar', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      const token = localStorage.getItem('auth-token')
      await fetch('/api/integrations/microsoft-calendar/sync-inbound', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      toast('Microsoft Calendar disconnected', 'success')
      onRefresh()
    } catch {
      toast('Failed to disconnect', 'error')
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <IntegrationCard>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <BrandLogo src="/logos/microsoft-outlook.svg" alt="Microsoft Calendar" size={44} />
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-slate-900">Microsoft Calendar</h3>
            <ScopeLabel scope="Personal" />
          </div>
        </div>
        <StatusPill isConnected={status.isConnected} />
      </div>

      <p className="text-[13px] text-slate-500 leading-relaxed flex-grow">
        Pull events from your Outlook or Microsoft 365 calendar into Lionheart so you see conflicts when booking.
      </p>

      {!status.isAvailable ? (
        <ConfigRequiredBanner serviceName="Microsoft Calendar" />
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
