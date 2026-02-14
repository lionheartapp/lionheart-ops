import { useState, useRef, useEffect } from 'react'
import { ChevronDown, User, X, Search } from 'lucide-react'
import { getTeamName, getUserTeamIds } from '../data/teamsData'
import { isSuperAdmin, isITAdmin } from '../data/teamsData'

function filterUsersByQuery(users, teams, query) {
  if (!query.trim()) return users
  const q = query.trim().toLowerCase()
  return (users || []).filter((u) => {
    const name = (u.name || '').toLowerCase()
    const teamIds = getUserTeamIds(u)
    const teamNames = teamIds.map((id) => getTeamName(teams, id)?.toLowerCase() ?? '').join(' ')
    const role = (u.role || '').toLowerCase()
    return name.includes(q) || teamNames.includes(q) || role.includes(q)
  })
}

export default function ViewAsDropdown({
  users = [],
  teams,
  actualUser,
  viewAsUser,
  currentUser,
  onViewAs,
  onClearViewAs,
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const ref = useRef(null)

  const displayUser = currentUser ?? actualUser
  const isImpersonating = viewAsUser != null
  const displayTeamIds = displayUser ? getUserTeamIds(displayUser) : []
  const teamLabels = displayTeamIds.map((id) => getTeamName(teams, id))
  const primaryTeam = teamLabels[0] ?? ''
  const secondaryTeam = teamLabels.length > 1 ? teamLabels.slice(1).join(', ') : null

  const filteredUsers = filterUsersByQuery(users, teams, query)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const handleSelectUser = (u) => {
    if (u?.id === actualUser?.id) {
      onClearViewAs?.()
    } else {
      onViewAs?.(u)
    }
    setOpen(false)
  }

  const handleBackToMe = (e) => {
    e.stopPropagation()
    onClearViewAs?.()
    setOpen(false)
  }

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-colors ${
          isImpersonating
            ? 'border-amber-500/50 dark:border-amber-500/40 bg-amber-500/10 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'
            : 'border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700'
        }`}
      >
        <User className="w-4 h-4 text-blue-500 shrink-0" />
        <span className="truncate flex-1 min-w-0">
          {isImpersonating ? `Viewing as ${viewAsUser?.name}` : (actualUser?.name ?? 'Select user')}
        </span>
        {isImpersonating ? (
          <button
            type="button"
            onClick={handleBackToMe}
            className="p-0.5 rounded hover:bg-amber-500/20 dark:hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0"
            aria-label="Back to my view"
            title={`Back to ${actualUser?.name}`}
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? '-rotate-180' : ''}`} />
        )}
      </button>

      {open && (
        <div className="absolute left-0 right-0 bottom-full mb-1 py-1 rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 shadow-xl z-50 overflow-hidden w-full max-h-[320px] flex flex-col">
          {isImpersonating && (
            <button
              type="button"
              onClick={handleBackToMe}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 dark:hover:bg-amber-500/10 border-b border-zinc-100 dark:border-zinc-700"
            >
              <X className="w-4 h-4 shrink-0" />
              Back to {actualUser?.name}
            </button>
          )}

          <div className="p-2 border-b border-zinc-100 dark:border-zinc-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, team..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 px-0.5">
              View as (demo)
            </p>
          </div>

          <ul className="overflow-y-auto flex-1 py-1 max-h-[220px]">
            {filteredUsers.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No users match “{query}”
              </li>
            ) : (
              filteredUsers.map((u) => {
                const isActive = displayUser?.id === u.id
                const isYou = actualUser?.id === u.id
                const uTeamIds = getUserTeamIds(u)
                const primary = uTeamIds[0] ? getTeamName(teams, uTeamIds[0]) : ''
                const secondary = uTeamIds.length > 1
                  ? uTeamIds.slice(1).map((id) => getTeamName(teams, id)).join(', ')
                  : null
                const superAdmin = isSuperAdmin(u)
                const itAdmin = isITAdmin(u, teams)
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectUser(u)}
                      className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-blue-500/20 text-blue-600 dark:text-blue-300'
                          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{u.name}</span>
                        {isYou && (
                          <span className="shrink-0 text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                            You
                          </span>
                        )}
                        {superAdmin && (
                          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                            Super Admin
                          </span>
                        )}
                        {!superAdmin && itAdmin && (
                          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400">
                            IT Admin
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex flex-wrap gap-x-2 gap-y-0">
                        <span>{primary}</span>
                        {secondary && <span>+ {secondary}</span>}
                        <span className="capitalize">· {u.role}</span>
                      </div>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}

      {displayUser && (primaryTeam || displayUser.role) && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 truncate">
          {isImpersonating && (
            <span className="text-amber-600 dark:text-amber-400 font-medium">Impersonating · </span>
          )}
          {primaryTeam}
          {secondaryTeam ? ` · ${secondaryTeam}` : ''}
          <span className="capitalize"> · {displayUser.role}</span>
        </p>
      )}
    </div>
  )
}
