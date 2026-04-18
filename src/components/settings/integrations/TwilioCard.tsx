'use client'

import { useState } from 'react'
import {
  MessageSquare,
  Unlink,
  ArrowRight,
} from 'lucide-react'
import { useToast } from '@/components/Toast'
import { FloatingInput } from '@/components/ui/FloatingInput'
import { IntegrationCard, ScopeLabel } from './IntegrationCard'
import { BrandLogo } from './BrandLogo'
import { StatusPill } from './StatusPill'
import { formatRelative } from './integration-types'
import type { IntegrationStatusData } from './integration-types'

export function TwilioCard({
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
