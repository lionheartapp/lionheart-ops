'use client'

import { useState, useEffect } from 'react'
import { ShieldCheck } from 'lucide-react'
import { getAuthHeaders } from '@/lib/api-client'

/**
 * Org-level security settings — currently just the MFA enforcement toggle.
 * Renders independently from SchoolInfoTab to avoid dirty-state conflicts.
 */
export default function SecuritySettingsSection() {
  const [mfaRequired, setMfaRequired] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings/security', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setMfaRequired(!!data.data?.mfaRequired)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async () => {
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

  if (loading) {
    return (
      <section className="ui-glass p-6 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-200" />
          <div className="space-y-1.5 flex-1">
            <div className="h-4 w-32 bg-slate-200 rounded" />
            <div className="h-3 w-48 bg-slate-100 rounded" />
          </div>
        </div>
      </section>
    )
  }

  return (
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
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
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
  )
}
