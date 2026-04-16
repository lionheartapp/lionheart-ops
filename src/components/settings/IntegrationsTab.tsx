'use client'

import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import {
  Link2,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  Loader2,
  ChevronDown,
  Unlink,
  ExternalLink,
  Info,
  ArrowRight,
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import { FloatingInput } from '@/components/ui/FloatingInput'

// ─── Types ───────────────────────────────────────────────────────────────────

interface IntegrationStatusData {
  institutionType: string
  planningCenter: {
    isAvailable: boolean
    isConnected: boolean
    lastSyncAt: string | null
    orgName: string | null
  }
  googleCalendar: {
    isAvailable: boolean
    isConnected: boolean
    lastSyncAt: string | null
    userName: string | null
  }
  microsoftCalendar: {
    isAvailable: boolean
    isConnected: boolean
    lastSyncAt: string | null
    userName: string | null
  }
  twilio: {
    isAvailable: boolean
    isConnected: boolean
    lastSyncAt: string | null
    phoneNumber: string | null
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  return `${diffDay}d ago`
}

/** Brand logo rendered at native size inside a soft container. */
function BrandLogo({ src, alt, size = 40 }: { src: string; alt: string; size?: number }) {
  return (
    <div
      className="rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-sm flex-shrink-0 overflow-hidden"
      style={{ width: size, height: size, padding: size * 0.15 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="w-full h-full object-contain" />
    </div>
  )
}

function StatusPill({ isConnected, label }: { isConnected: boolean; label?: string }) {
  const text = label || (isConnected ? 'Connected' : 'Not connected')
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase ${
        isConnected
          ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200'
          : 'bg-slate-50 text-slate-400 ring-1 ring-slate-200'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}
      />
      {text}
    </span>
  )
}

function ConfigRequiredBanner({ serviceName }: { serviceName: string }) {
  return (
    <div className="flex items-start gap-3 p-3.5 bg-amber-50/80 border border-amber-200/60 rounded-xl text-sm text-amber-800 backdrop-blur-sm">
      <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
      <span>
        <strong className="font-semibold">Configuration Required</strong> — Contact your administrator to set up {serviceName} API credentials in the server environment.
      </span>
    </div>
  )
}

/** Shared card wrapper with hover effect. */
function IntegrationCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col gap-4 h-full transition-all duration-300 hover:shadow-lg hover:shadow-slate-200/50 hover:border-slate-300/80 hover:-translate-y-0.5">
      {children}
    </div>
  )
}

/** Scope label (org-level vs personal). */
function ScopeLabel({ scope }: { scope: string }) {
  return (
    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{scope}</span>
  )
}

// ─── Planning Center Card ─────────────────────────────────────────────────────

function PlanningCenterCard({
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

// ─── Google Calendar Card ─────────────────────────────────────────────────────

function GoogleCalendarCard({
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
        window.open(data.data.authUrl, '_blank', 'width=600,height=700,scrollbars=yes')
        toast('Complete the Google sign-in in the popup, then refresh this page.', 'info')
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
              {syncing ? 'Syncing…' : 'Sync Now'}
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

// ─── Microsoft Calendar Card ─────────────────────────────────────────────────

function MicrosoftCalendarCard({
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
              {syncing ? 'Syncing…' : 'Sync Now'}
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

// ─── Twilio Card ─────────────────────────────────────────────────────────────

function TwilioCard({
  status,
  onRefresh,
}: {
  status: IntegrationStatusData['twilio']
  onRefresh: () => void
}) {
  const { toast } = useToast()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [testingSMS, setTestingSMS] = useState(false)
  const [accountSid, setAccountSid] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [testTo, setTestTo] = useState('')
  const [showTestForm, setShowTestForm] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch('/api/integrations/twilio/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ accountSid, authToken, phoneNumber }),
      })
      const data = await res.json()
      if (data.ok) {
        toast(`Twilio configured — SMS from ${data.data.phoneNumber}`, 'success')
        setShowForm(false)
        setAccountSid('')
        setAuthToken('')
        setPhoneNumber('')
        onRefresh()
      } else {
        toast(data.error?.message || 'Failed to save Twilio config', 'error')
      }
    } catch {
      toast('Failed to save Twilio configuration', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async () => {
    setRemoving(true)
    try {
      const token = localStorage.getItem('auth-token')
      await fetch('/api/integrations/twilio/config', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      toast('Twilio configuration removed', 'success')
      onRefresh()
    } catch {
      toast('Failed to remove Twilio config', 'error')
    } finally {
      setRemoving(false)
    }
  }

  const handleTestSMS = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testTo.trim()) return
    setTestingSMS(true)
    try {
      const token = localStorage.getItem('auth-token')
      const res = await fetch('/api/integrations/twilio/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: testTo, body: 'Test SMS from Lionheart — your Twilio integration is working!' }),
      })
      const data = await res.json()
      if (data.ok) {
        toast(`Test SMS sent to ${testTo}`, 'success')
        setShowTestForm(false)
        setTestTo('')
      } else {
        toast(data.error?.message || 'Failed to send test SMS', 'error')
      }
    } catch {
      toast('Failed to send test SMS', 'error')
    } finally {
      setTestingSMS(false)
    }
  }

  return (
    <IntegrationCard>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <BrandLogo src="/logos/twilio.svg" alt="Twilio" size={44} />
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold text-slate-900">Twilio SMS</h3>
            <ScopeLabel scope="Org-level" />
          </div>
        </div>
        <StatusPill isConnected={status.isConnected} label={status.isConnected ? 'Active' : 'Not configured'} />
      </div>

      {/* Description */}
      <div className="flex-grow">
        <p className="text-[13px] text-slate-500 leading-relaxed">
          Send SMS notifications for day-of updates and deadline reminders. Standard messaging rates apply.
        </p>
      </div>

      {status.isConnected ? (
        <>
          {status.phoneNumber && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              Sending from <span className="font-medium text-slate-700 font-mono">{status.phoneNumber}</span>
            </div>
          )}
          <p className="text-xs text-slate-400">Last used: {formatRelative(status.lastSyncAt)}</p>

          {/* Test SMS form */}
          {showTestForm && (
            <form onSubmit={handleTestSMS} className="space-y-3 p-4 bg-slate-50/80 rounded-xl border border-slate-100">
              <p className="text-xs font-semibold text-slate-600">Send a test SMS</p>
              <FloatingInput
                id="test-to"
                label="Recipient phone (+15555551234)"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                disabled={testingSMS}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={testingSMS || !testTo}
                  className="px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {testingSMS ? 'Sending...' : 'Send Test'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowTestForm(false); setTestTo('') }}
                  className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="flex items-center gap-2 flex-wrap pt-1">
            {!showTestForm && (
              <button
                onClick={() => setShowTestForm(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Test SMS
              </button>
            )}
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Update
            </button>
            <button
              onClick={handleRemove}
              disabled={removing}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </>
      ) : showForm ? (
        /* Configuration form */
        <form onSubmit={handleSave} className="space-y-3">
          <FloatingInput
            id="twilio-account-sid"
            label="Account SID"
            value={accountSid}
            onChange={(e) => setAccountSid(e.target.value)}
            disabled={saving}
            required
          />
          <FloatingInput
            id="twilio-auth-token"
            label="Auth Token"
            type="password"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            disabled={saving}
            required
          />
          <FloatingInput
            id="twilio-phone"
            label="Phone Number (+15555551234)"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            disabled={saving}
            required
          />
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setAccountSid(''); setAuthToken(''); setPhoneNumber('') }}
              className="px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="mt-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-all duration-200 cursor-pointer group/btn"
        >
          Configure
          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:translate-x-0.5" />
        </button>
      )}
    </IntegrationCard>
  )
}

// ─── Main IntegrationsTab ─────────────────────────────────────────────────────

export default function IntegrationsTab() {
  const queryClient = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['integration-status'],
    queryFn: async () => {
      const token = localStorage.getItem('auth-token')
      const res = await fetch('/api/integrations/status', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch integration status')
      const json = await res.json()
      return json.data as IntegrationStatusData
    },
    staleTime: 30000,
  })

  // Auto-refetch when returning from OAuth callback
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('pco_connected') || searchParams.get('pco_error')) {
      queryClient.invalidateQueries({ queryKey: ['integration-status'] })
    }
  }, [searchParams, queryClient])

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['integration-status'] })
  }

  const showPlanningCenter = data?.institutionType === 'FAITH_BASED'

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-2">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm">
            <Link2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
            <p className="text-sm text-slate-500 mt-0.5">Connect external services and tools</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200/80 p-6 animate-pulse">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-slate-100" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-100 rounded-lg w-28 mb-1.5" />
                  <div className="h-3 bg-slate-50 rounded-lg w-16" />
                </div>
              </div>
              <div className="h-3 bg-slate-50 rounded-lg w-full mb-2" />
              <div className="h-3 bg-slate-50 rounded-lg w-3/4" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-slate-300" />
        <p className="text-sm text-slate-500 mb-4">Failed to load integration status.</p>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </button>
      </div>
    )
  }

  // Determine grid columns based on how many cards we show
  const cardCount = (showPlanningCenter ? 1 : 0) + 2 // Google Calendar + Twilio always show
  const gridCols = cardCount === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-2 xl:grid-cols-3'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm">
          <Link2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
          <p className="text-sm text-slate-500 mt-0.5">Connect external services to sync data and send notifications</p>
        </div>
      </div>

      {/* Integration cards grid */}
      <div className={`grid grid-cols-1 ${gridCols} gap-5`}>
        {showPlanningCenter && (
          <PlanningCenterCard status={data.planningCenter} onRefresh={handleRefresh} />
        )}
        <GoogleCalendarCard status={data.googleCalendar} onRefresh={handleRefresh} />
        <MicrosoftCalendarCard status={data.microsoftCalendar} onRefresh={handleRefresh} />
        <TwilioCard status={data.twilio} onRefresh={handleRefresh} />
      </div>
    </div>
  )
}
