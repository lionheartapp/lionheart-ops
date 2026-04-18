'use client'

import { useState } from 'react'
import {
  RefreshCw,
  Loader2,
  ChevronDown,
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

export function PlanningCenterCard({
  status,
  onRefresh,
}: {
  status: IntegrationStatusData['planningCenter']
  onRefresh: () => void
}) {
  const { toast } = useToast()
  const [syncMenuOpen, setSyncMenuOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const handleConnect = async () => {
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch('/api/integrations/planning-center/auth', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.ok && data.data?.authUrl) {
        window.open(data.data.authUrl, '_blank', 'width=600,height=700')
        toast('Complete the connection in the popup, then refresh this page.', 'info')
      } else {
        toast(data.error?.message || 'Failed to start connection', 'error')
      }
    } catch {
      toast('Failed to connect to Planning Center', 'error')
    }
  }

  const handleSync = async (action: 'people' | 'services') => {
    setSyncing(true)
    setSyncMenuOpen(false)
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch('/api/integrations/planning-center/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (data.ok) {
        const result = data.data?.result
        toast(`Synced ${result?.matched ?? 0} records from Planning Center`, 'success')
        onRefresh()
      } else {
        toast(data.error?.message || 'Sync failed', 'error')
      }
    } catch {
      toast('Sync request failed', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      const token = localStorage.getItem('auth-token')
      await fetch('/api/integrations/planning-center/sync', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      toast('Planning Center disconnected', 'success')
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
          <BrandLogo src="/logos/planning-center.svg" alt="Planning Center Services" size={44} />
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-slate-900">Planning Center</h3>
            <ScopeLabel scope="Org-level" />
          </div>
        </div>
        <StatusPill isConnected={status.isConnected} />
      </div>

      {/* Description */}
      <p className="text-[13px] text-slate-500 leading-relaxed flex-grow">
        Sync teams, service plans, people data, and check-ins with Planning Center Online.
      </p>

      {!status.isAvailable ? (
        <ConfigRequiredBanner serviceName="Planning Center" />
      ) : status.isConnected ? (
        <>
          {status.orgName && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              Connected to <span className="font-medium text-slate-700">{status.orgName}</span>
            </div>
          )}
          <p className="text-xs text-slate-400">Last sync: {formatRelative(status.lastSyncAt)}</p>

          <div className="flex items-center gap-2 pt-1">
            <div className="relative">
              <button
                onClick={() => setSyncMenuOpen((v) => !v)}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                {syncing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                {syncing ? 'Syncing...' : 'Sync Now'}
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {syncMenuOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-44 z-10 py-1 bg-white rounded-xl border border-slate-200 shadow-lg shadow-slate-200/50">
                  <button
                    onClick={() => handleSync('people')}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Sync People
                  </button>
                  <button
                    onClick={() => handleSync('services')}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Sync Services
                  </button>
                </div>
              )}
            </div>

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
