'use client'

import { useState, useEffect } from 'react'
import { ShieldCheck, FileCheck, Check, AlertCircle } from 'lucide-react'
import { getAuthHeaders } from '@/lib/api-client'
import { FloatingInput } from '@/components/ui/FloatingInput'

/**
 * Org-level security & compliance settings:
 * - MFA enforcement toggle
 * - Data Privacy Agreement (DPA) tracking
 */
export default function SecuritySettingsSection() {
  // MFA state
  const [mfaRequired, setMfaRequired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // DPA state
  const [dpaLoading, setDpaLoading] = useState(true)
  const [dpaSigned, setDpaSigned] = useState(false)
  const [dpaSignedAt, setDpaSignedAt] = useState<string | null>(null)
  const [dpaSignatoryName, setDpaSignatoryName] = useState('')
  const [dpaSignatoryEmail, setDpaSignatoryEmail] = useState('')
  const [dpaVersion, setDpaVersion] = useState('')
  const [dpaReviewDueAt, setDpaReviewDueAt] = useState('')
  const [dpaSaving, setDpaSaving] = useState(false)
  const [dpaEditing, setDpaEditing] = useState(false)

  useEffect(() => {
    // Fetch security settings
    fetch('/api/settings/security', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setMfaRequired(!!data.data?.mfaRequired)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // Fetch DPA status
    fetch('/api/settings/compliance', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setDpaSigned(!!data.data?.dpaSigned)
          setDpaSignedAt(data.data?.dpaSignedAt || null)
          setDpaSignatoryName(data.data?.dpaSignatoryName || '')
          setDpaSignatoryEmail(data.data?.dpaSignatoryEmail || '')
          setDpaVersion(data.data?.dpaVersion || '')
          setDpaReviewDueAt(data.data?.dpaReviewDueAt ? data.data.dpaReviewDueAt.slice(0, 10) : '')
        }
      })
      .catch(() => {})
      .finally(() => setDpaLoading(false))
  }, [])

  const handleMfaToggle = async () => {
    const newValue = !mfaRequired
    setSaving(true)
    try {
      const res = await fetch('/api/settings/security', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ mfaRequired: newValue }),
      })
      const data = await res.json()
      if (data.ok) setMfaRequired(newValue)
    } catch {
      // Revert on failure
    } finally {
      setSaving(false)
    }
  }

  const handleDpaSave = async () => {
    setDpaSaving(true)
    try {
      const res = await fetch('/api/settings/compliance', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          recordSigning: !dpaSigned,
          dpaSignatoryName: dpaSignatoryName || undefined,
          dpaSignatoryEmail: dpaSignatoryEmail || undefined,
          dpaVersion: dpaVersion || undefined,
          dpaReviewDueAt: dpaReviewDueAt ? new Date(dpaReviewDueAt).toISOString() : null,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setDpaSigned(!!data.data?.dpaSigned)
        setDpaSignedAt(data.data?.dpaSignedAt || null)
        setDpaEditing(false)
      }
    } catch {
      // Keep form open on failure
    } finally {
      setDpaSaving(false)
    }
  }

  const handleDpaRevoke = async () => {
    setDpaSaving(true)
    try {
      const res = await fetch('/api/settings/compliance', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ revoke: true }),
      })
      const data = await res.json()
      if (data.ok) {
        setDpaSigned(false)
        setDpaSignedAt(null)
        setDpaSignatoryName('')
        setDpaSignatoryEmail('')
        setDpaVersion('')
        setDpaReviewDueAt('')
        setDpaEditing(false)
      }
    } catch {
      // Keep state on failure
    } finally {
      setDpaSaving(false)
    }
  }

  if (loading && dpaLoading) {
    return (
      <div className="space-y-6">
        <section className="ui-glass p-6 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-200" />
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-32 bg-slate-200 rounded" />
              <div className="h-3 w-48 bg-slate-100 rounded" />
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Security Section */}
      <section className="ui-glass p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Security</h3>
            <p className="text-sm text-slate-500">Organization-wide security policies</p>
          </div>
        </div>

        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-slate-700">Require two-factor authentication</p>
            <p className="text-xs text-slate-500 mt-0.5">
              When enabled, all members must set up an authenticator app before they can use the platform.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={mfaRequired}
            disabled={saving}
            onClick={handleMfaToggle}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              mfaRequired ? 'bg-blue-600' : 'bg-slate-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                mfaRequired ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {mfaRequired && (
          <div className="mt-3 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700">
            Members who haven&apos;t set up two-factor authentication yet will be prompted to do so the next time they visit their profile settings.
          </div>
        )}
      </section>

      {/* Compliance / DPA Section */}
      <section className="ui-glass p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
            <FileCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Compliance</h3>
            <p className="text-sm text-slate-500">Data Privacy Agreement and student data protection</p>
          </div>
        </div>

        {/* DPA Status */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dpaSigned ? 'bg-green-500' : 'bg-amber-400'}`} />
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Data Privacy Agreement (DPA)
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {dpaSigned
                    ? `Signed${dpaSignedAt ? ` on ${new Date(dpaSignedAt).toLocaleDateString()}` : ''}${dpaSignatoryName ? ` by ${dpaSignatoryName}` : ''}`
                    : 'No DPA on file — record one when signed by the district or school'}
                </p>
              </div>
            </div>

            {!dpaEditing && (
              <button
                type="button"
                onClick={() => setDpaEditing(true)}
                className="ui-btn px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition flex-shrink-0"
              >
                {dpaSigned ? 'Update' : 'Record DPA'}
              </button>
            )}
          </div>

          {/* DPA Review Due Warning */}
          {dpaSigned && dpaReviewDueAt && new Date(dpaReviewDueAt) < new Date() && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              DPA review is overdue — please renew or update your agreement.
            </div>
          )}

          {/* DPA Edit Form */}
          {dpaEditing && (
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FloatingInput
                  label="Signatory name"
                  value={dpaSignatoryName}
                  onChange={(e) => setDpaSignatoryName(e.target.value)}
                  placeholder="e.g., Dr. Sarah Mitchell"
                />
                <FloatingInput
                  label="Signatory email"
                  type="email"
                  value={dpaSignatoryEmail}
                  onChange={(e) => setDpaSignatoryEmail(e.target.value)}
                  placeholder="e.g., superintendent@district.edu"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FloatingInput
                  label="Agreement version"
                  value={dpaVersion}
                  onChange={(e) => setDpaVersion(e.target.value)}
                  placeholder="e.g., 2026-v1"
                />
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Review due date</label>
                  <input
                    type="date"
                    value={dpaReviewDueAt}
                    onChange={(e) => setDpaReviewDueAt(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={dpaSaving}
                  onClick={handleDpaSave}
                  className="ui-btn flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" />
                  {dpaSaving ? 'Saving...' : dpaSigned ? 'Update DPA' : 'Record as Signed'}
                </button>
                <button
                  type="button"
                  onClick={() => setDpaEditing(false)}
                  className="ui-btn px-4 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                {dpaSigned && (
                  <button
                    type="button"
                    disabled={dpaSaving}
                    onClick={handleDpaRevoke}
                    className="ui-btn px-4 py-2.5 rounded-full text-red-600 text-sm font-medium hover:bg-red-50 transition disabled:opacity-50"
                  >
                    Remove DPA Record
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
