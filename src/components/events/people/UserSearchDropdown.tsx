'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, ChevronDown } from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'
import type { OrgUser } from './people-types'
import { getUserName, getInitials } from './people-types'

interface UserSearchDropdownProps {
  excludeIds: Set<string>
  onSelect: (user: OrgUser) => void
  placeholder?: string
}

export function UserSearchDropdown({ excludeIds, onSelect, placeholder }: UserSearchDropdownProps) {
  const [search, setSearch] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (value: string) => {
    setSearch(value)
    setIsOpen(true)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebouncedSearch(value), 300)
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch users — empty search returns all, typed search filters server-side
  const { data: searchResults, isLoading: isSearching } = useQuery<OrgUser[]>({
    queryKey: ['user-search-dropdown', debouncedSearch],
    queryFn: async () => {
      const searchParam = debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''
      const res = await fetchApi<{ data: OrgUser[]; total: number }>(
        `/api/settings/users?limit=20${searchParam}`,
      )
      return Array.isArray(res) ? res : res.data ?? []
    },
    enabled: isOpen,
    staleTime: 30_000,
  })

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          placeholder={placeholder ?? 'Search by name or email...'}
          className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 rounded-lg bg-white hover:border-slate-300 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 transition-colors placeholder:text-slate-400"
        />
        <button
          onClick={() => {
            if (search) { setSearch(''); setDebouncedSearch('') }
            setIsOpen(!isOpen)
            if (!isOpen) inputRef.current?.focus()
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-100 cursor-pointer"
        >
          {search ? (
            <X className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          )}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-30 left-0 right-0 mt-1 max-h-52 overflow-y-auto ui-glass-dropdown divide-y divide-gray-100"
          >
            {isSearching ? (
              <div className="px-4 py-3 text-sm text-slate-400">Searching...</div>
            ) : searchResults && searchResults.length > 0 ? (
              searchResults.map((user) => {
                const isExcluded = excludeIds.has(user.id)
                return (
                  <button
                    key={user.id}
                    onClick={() => {
                      if (!isExcluded) {
                        onSelect(user)
                        setSearch('')
                        setDebouncedSearch('')
                        setIsOpen(false)
                      }
                    }}
                    disabled={isExcluded}
                    className={`w-full px-3 py-2.5 flex items-center gap-3 text-left transition-colors ${
                      isExcluded
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    {user.avatar ? (
                      <img src={user.avatar} alt={getUserName(user)} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold">
                        {getInitials(user)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{getUserName(user)}</p>
                      <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    </div>
                    {isExcluded && (
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">Added</span>
                    )}
                  </button>
                )
              })
            ) : (
              <div className="px-4 py-3 text-sm text-slate-400">No users found</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
