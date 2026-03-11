'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

// ─── Types ───────────────────────────────────────────────────────────────────

interface NotificationPref {
  type: string
  emailEnabled: boolean
  inAppEnabled: boolean
}

type PrefsMap = Record<string, NotificationPref>

// ─── Module Groups ────────────────────────────────────────────────────────────

const MODULE_GROUPS: { id: string; label: string; types: string[] }[] = [
  {
    id: 'calendar',
    label: 'Calendar',
    types: ['event_updated', 'event_deleted', 'event_invite', 'event_approved', 'event_rejected'],
  },
  {
    id: 'maintenance',
    label: 'Maintenance',
    types: [
      'maintenance_submitted',
      'maintenance_assigned',
      'maintenance_claimed',
      'maintenance_in_progress',
      'maintenance_on_hold',
      'maintenance_qa_ready',
      'maintenance_done',
      'maintenance_urgent',
      'maintenance_stale',
      'maintenance_qa_rejected',
      'maintenance_scheduled_released',
      'maintenance_repeat_repair',
      'maintenance_cost_threshold',
      'maintenance_end_of_life',
    ],
  },
  {
    id: 'it',
    label: 'IT Help Desk',
    types: [
      'it_ticket_submitted',
      'it_ticket_assigned',
      'it_ticket_in_progress',
      'it_ticket_on_hold',
      'it_ticket_done',
      'it_ticket_cancelled',
      'it_ticket_urgent',
      'it_ticket_comment',
      'it_stale_ticket',
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    types: ['compliance_reminder'],
  },
  {
    id: 'security',
    label: 'Security',
    types: [
      'security_incident_created',
      'security_incident_escalated',
      'security_incident_status',
      'security_incident_closed',
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    types: ['inventory_low_stock'],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Turn snake_case type string into readable label. */
function typeToLabel(type: string): string {
  return type
    .replace(/^maintenance_|^it_ticket_|^it_stale|^event_|^compliance_|^security_incident_|^inventory_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/^Stale/i, 'Stale Ticket')
    || type
}

/** Build a default pref (both enabled) for any type. */
function defaultPref(type: string): NotificationPref {
  return { type, emailEnabled: true, inAppEnabled: true }
}

// ─── Toggle Component ─────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  label?: string
}

function Toggle({ checked, onChange, disabled, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent',
        'transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
        disabled ? 'cursor-not-allowed opacity-40' : '',
        checked ? 'bg-primary-600' : 'bg-gray-200',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NotificationPreferences() {
  const [prefs, setPrefs] = useState<PrefsMap>({})
  const [pauseAll, setPauseAll] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    return headers
  }

  // Load preferences on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/user/notification-preferences', {
          headers: getAuthHeaders(),
        })
        const data = await res.json()
        if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to load preferences')

        const map: PrefsMap = {}
        for (const p of data.data.preferences as NotificationPref[]) {
          map[p.type] = p
        }
        setPrefs(map)
        setPauseAll(data.data.pauseAll ?? false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preferences')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced save
  const scheduleSave = useCallback(
    (nextPrefs: PrefsMap, nextPauseAll: boolean) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        setSaving(true)
        try {
          const preferences = Object.values(nextPrefs).map((p) => ({
            type: p.type,
            emailEnabled: p.emailEnabled,
            inAppEnabled: p.inAppEnabled,
          }))
          const res = await fetch('/api/user/notification-preferences', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ preferences, pauseAll: nextPauseAll }),
          })
          const data = await res.json()
          if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to save')
          setSavedAt(new Date())
          setError('')
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to save preferences')
        } finally {
          setSaving(false)
        }
      }, 1000)
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Update a single pref field
  const updatePref = (type: string, field: 'emailEnabled' | 'inAppEnabled', value: boolean) => {
    setPrefs((prev) => {
      const existing = prev[type] ?? defaultPref(type)
      const next = { ...prev, [type]: { ...existing, [field]: value } }
      scheduleSave(next, pauseAll)
      return next
    })
  }

  // Group toggle — set all types in a group to the same value
  const setGroupField = (groupTypes: string[], field: 'emailEnabled' | 'inAppEnabled', value: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev }
      for (const type of groupTypes) {
        const existing = prev[type] ?? defaultPref(type)
        next[type] = { ...existing, [field]: value }
      }
      scheduleSave(next, pauseAll)
      return next
    })
  }

  // Master pause toggle
  const handlePauseAll = (value: boolean) => {
    setPauseAll(value)
    setPrefs((prev) => {
      scheduleSave(prev, value)
      return prev
    })
  }

  // Get pref for a type (default: both enabled)
  const getPref = (type: string): NotificationPref => prefs[type] ?? defaultPref(type)

  // Determine if all types in a group have field enabled
  const groupAllEnabled = (types: string[], field: 'emailEnabled' | 'inAppEnabled'): boolean =>
    types.every((t) => getPref(t)[field])

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Master pause toggle */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Pause all notifications</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Temporarily silence all email and in-app notifications
            </p>
          </div>
          <Toggle
            checked={pauseAll}
            onChange={handlePauseAll}
            label="Pause all notifications"
          />
        </div>

        <AnimatePresence>
          {pauseAll && (
            <motion.div
              key="pause-banner"
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                All notifications are paused. You won&apos;t receive any email or in-app notifications.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Save indicator */}
      <AnimatePresence>
        {(saving || savedAt) && !error && (
          <motion.div
            key="save-indicator"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 text-sm text-gray-500"
          >
            {saving ? (
              <>
                <span className="inline-block h-3 w-3 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
                Saving...
              </>
            ) : (
              <span className="text-green-600">Preferences saved</span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Module groups */}
      <div className={['space-y-4', pauseAll ? 'opacity-50 pointer-events-none' : ''].filter(Boolean).join(' ')}>
        {MODULE_GROUPS.map((group) => {
          const allEmail = groupAllEnabled(group.types, 'emailEnabled')
          const allInApp = groupAllEnabled(group.types, 'inAppEnabled')

          return (
            <div key={group.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Group header */}
              <div className="flex items-center justify-between gap-4 px-5 py-3 bg-gray-50 border-b border-gray-200">
                <p className="text-sm font-semibold text-gray-900">{group.label}</p>
                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-400">Email</span>
                    <Toggle
                      checked={allEmail}
                      onChange={(v) => setGroupField(group.types, 'emailEnabled', v)}
                      label={`${group.label} email notifications`}
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-gray-400">In-App</span>
                    <Toggle
                      checked={allInApp}
                      onChange={(v) => setGroupField(group.types, 'inAppEnabled', v)}
                      label={`${group.label} in-app notifications`}
                    />
                  </div>
                </div>
              </div>

              {/* Individual rows */}
              <div className="divide-y divide-gray-100">
                {group.types.map((type) => {
                  const pref = getPref(type)
                  return (
                    <div
                      key={type}
                      className="flex items-center justify-between gap-4 px-5 py-3"
                    >
                      <span className="text-sm text-gray-700">{typeToLabel(type)}</span>
                      <div className="flex items-center gap-6 flex-shrink-0">
                        <Toggle
                          checked={pref.emailEnabled}
                          onChange={(v) => updatePref(type, 'emailEnabled', v)}
                          label={`${typeToLabel(type)} email`}
                        />
                        <Toggle
                          checked={pref.inAppEnabled}
                          onChange={(v) => updatePref(type, 'inAppEnabled', v)}
                          label={`${typeToLabel(type)} in-app`}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
