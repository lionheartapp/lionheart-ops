'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X, Loader2, Search } from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'

interface WatcherUser {
  id: string
  firstName: string
  lastName: string
  email: string
}

interface Watcher {
  id: string
  userId: string
  user: WatcherUser
}

interface TicketWatchersProps {
  ticketId: string
  watchers: Watcher[]
  currentUserId: string
  canManage: boolean
}

export default function TicketWatchers({
  ticketId,
  watchers,
  currentUserId,
  canManage,
}: TicketWatchersProps) {
  const queryClient = useQueryClient()
  const [showSearch, setShowSearch] = useState(false)
  const [search, setSearch] = useState('')
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showSearch) return
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowSearch(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showSearch])

  // Fetch all org users for adding watchers
  const { data: allUsers = [] } = useQuery({
    queryKey: ['org-users-for-watchers'],
    queryFn: () =>
      fetchApi<{ id: string; firstName: string; lastName: string; email: string }[]>(
        '/api/settings/users'
      ),
    staleTime: 5 * 60 * 1000,
    enabled: showSearch,
  })

  const addMutation = useMutation({
    mutationFn: (userId: string) =>
      fetchApi(`/api/maintenance/tickets/${ticketId}/watchers`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-ticket', ticketId] })
      setSearch('')
    },
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) =>
      fetchApi(`/api/maintenance/tickets/${ticketId}/watchers`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-ticket', ticketId] })
    },
  })

  const watcherUserIds = new Set(watchers.map((w) => w.userId))

  // Filter users not already watching
  const filteredUsers = allUsers
    .filter((u) => !watcherUserIds.has(u.id))
    .filter((u) => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      )
    })
    .slice(0, 8)

  return (
    <div className="space-y-2">
      <div className="flex items-center flex-wrap gap-1.5">
        {watchers.map((w) => {
          const initials = `${w.user.firstName[0]}${w.user.lastName[0]}`.toUpperCase()
          const canRemove = canManage || w.userId === currentUserId
          return (
            <div
              key={w.id}
              className="group relative flex items-center"
              title={`${w.user.firstName} ${w.user.lastName} (${w.user.email})`}
            >
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-semibold text-gray-600 border border-gray-200">
                {initials}
              </div>
              {canRemove && (
                <button
                  onClick={() => removeMutation.mutate(w.userId)}
                  disabled={removeMutation.isPending}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hidden group-hover:flex"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          )
        })}

        {/* Add watcher button */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={() => setShowSearch((v) => !v)}
            className="w-7 h-7 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors cursor-pointer"
            title="Add watcher"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {showSearch && (
            <div className="absolute top-full right-0 mt-1 z-20 w-56 ui-glass-dropdown py-1">
              <div className="px-2 py-1.5">
                <div className="flex items-center gap-1.5 px-2 py-1.5 border border-gray-200 rounded-lg bg-white">
                  <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search users..."
                    autoFocus
                    className="text-sm text-gray-700 bg-transparent outline-none w-full placeholder:text-gray-400"
                  />
                </div>
              </div>
              <div className="max-h-40 overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-400 text-center">
                    {allUsers.length === 0 ? (
                      <span className="flex items-center justify-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Loading...
                      </span>
                    ) : (
                      'No users found'
                    )}
                  </p>
                ) : (
                  filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => addMutation.mutate(user.id)}
                      disabled={addMutation.isPending}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[9px] font-semibold text-gray-600 flex-shrink-0">
                        {user.firstName[0]}{user.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">
                          {user.firstName} {user.lastName}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
