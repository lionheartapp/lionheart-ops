'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, UserCircle } from 'lucide-react'

type UserRow = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  avatar: string | null
  status: string
  userRole: { id: string; name: string; slug: string } | null
  teams: { team: { id: string; name: string; slug: string } }[]
}

interface ViewAsDialogProps {
  isOpen: boolean
  onClose: () => void
}

export default function ViewAsDialog({ isOpen, onClose }: ViewAsDialogProps) {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [impersonating, setImpersonating] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    fetch('/api/settings/users?limit=200', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          setUsers(json.data || [])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isOpen])

  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('user-id') : ''

  const roles = useMemo(() => {
    const set = new Set<string>()
    users.forEach((u) => {
      if (u.userRole?.name) set.add(u.userRole.name)
    })
    return Array.from(set).sort()
  }, [users])

  const filtered = useMemo(() => {
    let result = users.filter((u) => u.status === 'ACTIVE')
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (u) =>
          (u.firstName || '').toLowerCase().includes(q) ||
          (u.lastName || '').toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      )
    }
    if (roleFilter) {
      result = result.filter((u) => u.userRole?.name === roleFilter)
    }
    return result
  }, [users, search, roleFilter])

  const handleImpersonate = async (user: UserRow) => {
    if (impersonating) return
    setImpersonating(user.id)

    try {
      // Read CSRF token from cookie
      const csrfMatch = document.cookie
        .split(';')
        .find((c) => c.trim().startsWith('csrf-token='))
      const csrfToken = csrfMatch
        ? csrfMatch.trim().slice('csrf-token='.length)
        : null

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (csrfToken) headers['X-CSRF-Token'] = csrfToken

      const res = await fetch('/api/auth/impersonate', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ userId: user.id }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error?.message || 'Failed to impersonate')
        setImpersonating(null)
        return
      }

      // Reload page to re-hydrate as the target user
      window.location.reload()
    } catch {
      alert('Failed to impersonate. Please try again.')
      setImpersonating(null)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">View As...</h2>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Filters */}
              <div className="px-5 py-3 border-b border-gray-100 flex gap-3">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300"
                    autoFocus
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300 bg-white cursor-pointer"
                >
                  <option value="">All Roles</option>
                  {roles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* User list */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center text-gray-500 text-sm">Loading users...</div>
                ) : filtered.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-sm">No users found</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {filtered.map((user) => {
                      const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
                      const teamNames = user.teams?.map((t) => t.team.name).filter(Boolean) || []

                      return (
                        <button
                          key={user.id}
                          onClick={() => handleImpersonate(user)}
                          disabled={!!impersonating}
                          className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3 disabled:opacity-50 cursor-pointer"
                        >
                          {/* Avatar */}
                          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {user.avatar ? (
                              <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                            ) : (
                              <UserCircle className="w-6 h-6 text-gray-400" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 truncate">
                                {displayName}
                              </span>
                              {user.userRole?.name && (
                                <span className="inline-flex px-2 py-0.5 text-[11px] font-medium rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
                                  {user.userRole.name}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {user.email}
                              {teamNames.length > 0 && (
                                <span className="ml-1.5 text-gray-400">&middot; {teamNames.join(', ')}</span>
                              )}
                            </div>
                          </div>

                          {/* Loading indicator */}
                          {impersonating === user.id && (
                            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
                {filtered.length} user{filtered.length !== 1 ? 's' : ''}
                {' '}&middot; Click to view the app as that user
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
