'use client'

import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Shield, ChevronDown, ChevronRight } from 'lucide-react'
import { FloatingDropdown } from '@/components/ui/FloatingInput'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string
  action: string
  resourceType: string | null
  resourceId: string | null
  resourceLabel: string | null
  changes: unknown
  userEmail: string | null
  userId: string | null
  ipAddress: string | null
  createdAt: string
}

interface AuditLogsResponse {
  data: AuditLog[]
  total: number
  page: number
  limit: number
  totalPages: number
}

interface UserOption {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
}

// ─── Badge colors by action category ────────────────────────────────────────

function getActionBadgeClass(action: string): string {
  if (action.startsWith('user.login') || action.startsWith('user.password')) {
    return 'bg-blue-100 text-blue-700'
  }
  if (action.startsWith('user.')) {
    return 'bg-green-100 text-green-700'
  }
  if (action.startsWith('role.') || action.startsWith('team.')) {
    return 'bg-purple-100 text-purple-700'
  }
  return 'bg-gray-100 text-gray-700'
}

// ─── Relative time helper ─────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// ─── Changes display ──────────────────────────────────────────────────────

function ChangesDisplay({ changes }: { changes: unknown }) {
  if (!changes || typeof changes !== 'object') return null
  const entries = Object.entries(changes as Record<string, unknown>)
  if (entries.length === 0) return null
  return (
    <div className="space-y-1.5">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-2 text-xs">
          <span className="font-medium text-gray-500 w-28 flex-shrink-0">{key}:</span>
          <span className="text-gray-700 break-all">{JSON.stringify(value)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Expandable row ───────────────────────────────────────────────────────

function AuditRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3 text-left whitespace-nowrap">
          <span
            className="text-xs text-gray-700"
            title={absoluteTime(log.createdAt)}
          >
            {relativeTime(log.createdAt)}
          </span>
        </td>
        <td className="px-4 py-3 text-left">
          <span className="text-xs text-gray-800">{log.userEmail ?? 'System'}</span>
        </td>
        <td className="px-4 py-3 text-left">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getActionBadgeClass(log.action)}`}
          >
            {log.action}
          </span>
        </td>
        <td className="px-4 py-3 text-left">
          <span className="text-xs text-gray-600">
            {log.resourceType
              ? `${log.resourceType}${log.resourceLabel ? ` — ${log.resourceLabel}` : ''}`
              : '—'}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto" />
            : <ChevronRight className="w-3.5 h-3.5 text-gray-400 ml-auto" />
          }
        </td>
      </tr>

      <AnimatePresence initial={false}>
        {expanded && (
          <tr key="expanded">
            <td colSpan={5} className="px-0 py-0">
              <motion.div
                key="detail"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="px-4 py-4 bg-gray-50 border-t border-gray-100 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="font-medium text-gray-500">Full Timestamp</span>
                      <p className="text-gray-700 mt-0.5">{absoluteTime(log.createdAt)}</p>
                    </div>
                    {log.resourceId && (
                      <div>
                        <span className="font-medium text-gray-500">Resource ID</span>
                        <p className="text-gray-700 mt-0.5 font-mono text-[11px] break-all">{log.resourceId}</p>
                      </div>
                    )}
                    {log.ipAddress && (
                      <div>
                        <span className="font-medium text-gray-500">IP Address</span>
                        <p className="text-gray-700 mt-0.5">{log.ipAddress}</p>
                      </div>
                    )}
                  </div>
                  {log.changes != null && typeof log.changes === 'object' && !Array.isArray(log.changes) && Object.keys(log.changes as Record<string, unknown>).length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-gray-500 block mb-1.5">Changes</span>
                      <div className="bg-white rounded-lg border border-gray-200 p-3">
                        <ChangesDisplay changes={log.changes} />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Action options ────────────────────────────────────────────────────────

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'user.login', label: 'user.login' },
  { value: 'user.invite', label: 'user.invite' },
  { value: 'user.update', label: 'user.update' },
  { value: 'user.delete', label: 'user.delete' },
  { value: 'user.password-reset-request', label: 'user.password-reset-request' },
  { value: 'user.password-reset-complete', label: 'user.password-reset-complete' },
  { value: 'role.create', label: 'role.create' },
  { value: 'role.update', label: 'role.update' },
  { value: 'role.delete', label: 'role.delete' },
  { value: 'team.create', label: 'team.create' },
  { value: 'team.update', label: 'team.update' },
  { value: 'team.delete', label: 'team.delete' },
]

// ─── Main component ────────────────────────────────────────────────────────

export default function AuditLogTab() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null

  // ─── Filters ────────────────────────────────────────────────────────────
  const [actionFilter, setActionFilter] = useState('')
  const [userIdFilter, setUserIdFilter] = useState('')
  const [fromFilter, setFromFilter] = useState('')
  const [toFilter, setToFilter] = useState('')
  const [page, setPage] = useState(1)
  const LIMIT = 25

  // ─── Data fetch ─────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fetched, setFetched] = useState(false)

  const [users, setUsers] = useState<UserOption[]>([])
  const [usersLoaded, setUsersLoaded] = useState(false)

  const fetchUsers = useCallback(async () => {
    if (usersLoaded || !token) return
    try {
      const res = await fetch('/api/settings/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        if (data.ok && Array.isArray(data.data)) {
          setUsers(data.data)
        }
      }
    } catch {
      // non-critical
    } finally {
      setUsersLoaded(true)
    }
  }, [usersLoaded, token])

  const fetchLogs = useCallback(async (p = 1) => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(LIMIT),
      })
      if (actionFilter) params.set('action', actionFilter)
      if (userIdFilter) params.set('userId', userIdFilter)
      if (fromFilter) params.set('from', fromFilter)
      if (toFilter) params.set('to', toFilter)

      const res = await fetch(`/api/settings/audit-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to load audit logs')
      setLogs(data.data)
      setTotal(data.total)
      setTotalPages(data.totalPages)
      setPage(p)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs')
    } finally {
      setLoading(false)
      setFetched(true)
    }
  }, [token, actionFilter, userIdFilter, fromFilter, toFilter])

  // Fetch on mount (and when filters change via the Apply button)
  const [, setInitialized] = useState(false)
  if (!fetched && !loading) {
    fetchLogs(1)
    setInitialized(true)
  }

  const handleApplyFilters = () => {
    fetchLogs(1)
  }

  const handlePrev = () => {
    if (page > 1) fetchLogs(page - 1)
  }

  const handleNext = () => {
    if (page < totalPages) fetchLogs(page + 1)
  }

  const userOptions = [
    { value: '', label: 'All Users' },
    ...users.map((u) => ({
      value: u.id,
      label: u.email,
    })),
  ]

  return (
    <div className="animate-[fadeIn_200ms_ease-out]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <div>
          <h2 className="flex items-center gap-3 text-xl sm:text-2xl font-semibold text-gray-900">
            <Shield className="w-6 h-6 text-primary-600" />
            Activity Log
          </h2>
          <p className="text-sm text-gray-500 mt-1">Track all actions performed by members of your organization</p>
        </div>
      </div>

      {/* Filters */}
      <div className="ui-glass p-4 rounded-xl mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <FloatingDropdown
            id="audit-action-filter"
            label="Action type"
            value={actionFilter}
            onChange={setActionFilter}
            options={ACTION_OPTIONS}
          />
          <div
            onClick={fetchUsers}
            onFocus={fetchUsers}
          >
            <FloatingDropdown
              id="audit-user-filter"
              label="User"
              value={userIdFilter}
              onChange={setUserIdFilter}
              options={userOptions}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">From date</label>
            <input
              type="date"
              value={fromFilter}
              onChange={(e) => setFromFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">To date</label>
            <input
              type="date"
              value={toFilter}
              onChange={(e) => setToFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <button
            onClick={handleApplyFilters}
            className="px-5 py-2 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors duration-200"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="ui-glass-table">
        {loading ? (
          <div className="animate-pulse space-y-px">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex gap-4 px-4 py-3.5">
                <div className="h-3 bg-gray-100 rounded w-20 flex-shrink-0" />
                <div className="h-3 bg-gray-100 rounded w-32" />
                <div className="h-3 bg-gray-100 rounded w-24" />
                <div className="h-3 bg-gray-100 rounded w-28" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mb-3">
              <Shield className="w-7 h-7 text-primary-400" />
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">No activity recorded yet</p>
            <p className="text-xs text-gray-400 max-w-xs">
              Actions performed by your team will appear here once they occur.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Target</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log) => (
                <AuditRow key={log.id} log={log} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs text-gray-500">
            {total} total {total === 1 ? 'entry' : 'entries'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrev}
              disabled={page <= 1}
              className="px-4 py-2 rounded-full border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={handleNext}
              disabled={page >= totalPages}
              className="px-4 py-2 rounded-full border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
