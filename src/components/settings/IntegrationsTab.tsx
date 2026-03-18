'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Link2,
  Calendar,
  MessageSquare,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  ChevronDown,
  Unlink,
  ExternalLink,
  Info,
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import { FloatingInput } from '@/components/ui/FloatingInput'

// ─── Types ───────────────────────────────────────────────────────────────────

interface IntegrationStatusData {
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

function StatusBadge({ isConnected, label }: { isConnected: boolean; label?: string }) {
  const text = label || (isConnected ? 'Connected' : 'Not Connected')
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        isConnected
          ? 'bg-green-100 text-green-700'
          : 'bg-slate-100 text-slate-500'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-slate-400'}`}
      />
      {text}
    </span>
  )
}

function ConfigRequiredBanner({ serviceName }: { serviceName: string }) {
  return (
    <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
      <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
      <span>
        <strong>Configuration Required</strong> — Contact your administrator to set up {serviceName} API credentials in the server environment.
      </span>
    </div>
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
    <div className="ui-glass p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Planning Center</h3>
            <p className="text-xs text-slate-500">Org-level connection</p>
          </div>
        </div>
        <StatusBadge isConnected={status.isConnected} />
      </div>

      {/* Description */}
      <p className="text-sm text-slate-600 leading-relaxed">
        Sync worship teams, service plans, people data, and check-ins with Planning Center Online.
      </p>

      {!status.isAvailable ? (
        <ConfigRequiredBanner serviceName="Planning Center" />
      ) : status.isConnected ? (
        <>
          {/* Connected state */}
          {status.orgName && (
            <p className="text-xs text-slate-500">
              Connected to: <span className="font-medium text-slate-700">{status.orgName}</span>
            </p>
          )}
          <p className="text-xs text-slate-400">Last sync: {formatRelative(status.lastSyncAt)}</p>

          <div className="flex items-center gap-2 pt-1">
            {/* Sync dropdown */}
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
                <div className="ui-glass-dropdown absolute top-full left-0 mt-1 w-44 z-10 py-1">
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
        /* Not connected state */
        <button
          onClick={handleConnect}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Link2 className="w-4 h-4" />
          Connect Planning Center
        </button>
      )}
    </div>
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
    <div className="ui-glass p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-sm flex-shrink-0">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Google Calendar</h3>
            <p className="text-xs text-slate-500">Personal connection</p>
          </div>
        </div>
        <StatusBadge isConnected={status.isConnected} />
      </div>

      {/* Description */}
      <p className="text-sm text-slate-600 leading-relaxed">
        Sync events to your personal Google Calendar so they appear alongside your other meetings.
      </p>

      {!status.isAvailable ? (
        <ConfigRequiredBanner serviceName="Google Calendar" />
      ) : status.isConnected ? (
        <>
          {/* Connected state */}
          {status.userName && (
            <p className="text-xs text-slate-500">
              Connected as: <span className="font-medium text-slate-700">{status.userName}</span>
            </p>
          )}
          <p className="text-xs text-slate-400">Last sync: {formatRelative(status.lastSyncAt)}</p>

          <div className="flex items-center gap-2 pt-1">
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
              Open Google Calendar
            </a>
          </div>
        </>
      ) : (
        /* Not connected state */
        <button
          onClick={handleConnect}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Link2 className="w-4 h-4" />
          Connect Google Calendar
        </button>
      )}
    </div>
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
    <div className="ui-glass p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Twilio SMS</h3>
            <p className="text-xs text-slate-500">Org-level configuration</p>
          </div>
        </div>
        <StatusBadge isConnected={status.isConnected} label={status.isConnected ? 'Active' : 'Not Configured'} />
      </div>

      {/* Description */}
      <p className="text-sm text-slate-600 leading-relaxed">
        Send SMS notifications for day-of updates and deadline reminders. Standard messaging rates apply.
      </p>

      {status.isConnected ? (
        <>
          {/* Active state */}
          {status.phoneNumber && (
            <p className="text-xs text-slate-500">
              Sending from: <span className="font-medium text-slate-700 font-mono">{status.phoneNumber}</span>
            </p>
          )}
          <p className="text-xs text-slate-400">Last used: {formatRelative(status.lastSyncAt)}</p>

          {/* Test SMS form */}
          {showTestForm ? (
            <form onSubmit={handleTestSMS} className="space-y-3 p-4 bg-slate-50 rounded-xl">
              <p className="text-xs font-medium text-slate-700">Send a test SMS</p>
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
          ) : null}

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
        /* Not configured state */
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <MessageSquare className="w-4 h-4" />
          Configure Twilio SMS
        </button>
      )}

      {/* Footer note */}
      <p className="text-xs text-slate-400 border-t border-slate-100 pt-3">
        SMS is used for urgent day-of updates and deadline reminders only. Standard messaging rates apply.
      </p>
    </div>
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

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['integration-status'] })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center shadow-sm">
            <Link2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
            <p className="text-sm text-slate-500">Connect external services and tools</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="ui-glass p-6 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-slate-200" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-200 rounded w-32 mb-1" />
                  <div className="h-3 bg-slate-100 rounded w-20" />
                </div>
              </div>
              <div className="h-3 bg-slate-100 rounded w-full mb-2" />
              <div className="h-3 bg-slate-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="ui-glass p-6 text-center text-slate-500">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <p className="text-sm">Failed to load integration status.</p>
        <button
          onClick={handleRefresh}
          className="mt-3 text-sm text-blue-600 hover:text-blue-700 cursor-pointer"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm">
          <Link2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
          <p className="text-sm text-slate-500">Connect external services to sync data and send notifications</p>
        </div>
      </div>

      {/* Integration cards grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PlanningCenterCard status={data.planningCenter} onRefresh={handleRefresh} />
        <GoogleCalendarCard status={data.googleCalendar} onRefresh={handleRefresh} />
        <TwilioCard status={data.twilio} onRefresh={handleRefresh} />
      </div>
    </div>
  )
}
