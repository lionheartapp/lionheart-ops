import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Search, Bell, User, LogOut, Settings, ChevronDown } from 'lucide-react'
import { buildNotifications } from '../utils/pendingApprovals'
import { clearAuthToken } from '../services/platformApi'

const LOGIN_PATH = '/login'

function handleSignOut() {
  clearAuthToken()
  window.location.replace(LOGIN_PATH)
}

export default function TopBar({
  currentUser,
  formSubmissions = [],
  forms = [],
          onNavigateToSettings,
  onNavigateToFormResponses,
  onOpenCommandBar,
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [accountMenuPosition, setAccountMenuPosition] = useState(null)
  const notificationsRef = useRef(null)
  const accountRef = useRef(null)

  const name = currentUser?.name ?? ''
  const initial = name ? name.charAt(0).toUpperCase() : '…'
  const notifications = useMemo(
    () => buildNotifications(formSubmissions, forms, currentUser?.id),
    [formSubmissions, forms, currentUser?.id]
  )
  const unreadCount = notifications.length

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        onOpenCommandBar?.() || document.querySelector('.topbar-search-input')?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onOpenCommandBar])

  // Position account dropdown when it opens (for portal)
  useEffect(() => {
    if (!accountOpen || !accountRef.current) return
    const el = accountRef.current
    const rect = el.getBoundingClientRect()
    setAccountMenuPosition({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    return () => setAccountMenuPosition(null)
  }, [accountOpen])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) setNotificationsOpen(false)
      const inAccount = accountRef.current?.contains(e.target) || e.target.closest?.('[data-account-menu]')
      if (!inAccount) setAccountOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="relative z-50 shrink-0 h-20 flex items-center gap-4 px-6 lg:px-8 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm">
      {/* Search - left */}
      <div className="min-w-0 flex items-center gap-2 w-full max-w-2xl">
        <button
          type="button"
          onClick={onOpenCommandBar}
          className="relative flex-1 flex items-center text-left rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors"
        >
          <Search className="absolute left-3 w-4 h-4 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
          <span className="w-full pl-9 pr-4 py-2.5 text-sm text-zinc-500 dark:text-zinc-400">
            Search teachers, rooms, tickets…
          </span>
          <kbd className="hidden sm:inline-flex absolute right-3 items-center gap-0.5 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Spacer - pushes notifications & avatar to the right */}
      <div className="flex-1 min-w-4" />

      {/* Notifications & Avatar - right aligned */}
      <div className="flex items-center gap-2 shrink-0">
      <div className="relative shrink-0" ref={notificationsRef}>
        <button
          type="button"
          onClick={() => { setNotificationsOpen((v) => !v); setAccountOpen(false) }}
          className="relative p-2.5 rounded-xl text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Notifications"
          aria-expanded={notificationsOpen}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-500 ring-2 ring-zinc-50 dark:ring-zinc-900" aria-hidden />
          )}
        </button>
        {notificationsOpen && (
          <div className="absolute right-0 top-full mt-1 w-80 max-h-[70vh] overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl z-[100] py-1">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Notifications</h3>
            </div>
            <ul className="py-1">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setNotificationsOpen(false)
                      if (n.formId && onNavigateToFormResponses) {
                        onNavigateToFormResponses(n.formId)
                      }
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-colors ${n.unread ? 'bg-orange-500/5 dark:bg-orange-500/10' : ''}`}
                  >
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{n.title}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{n.subtitle || n.time}</p>
                  </button>
                </li>
              ))}
            </ul>
            {notifications.length === 0 && (
              <p className="px-4 py-6 text-sm text-zinc-500 dark:text-zinc-400 text-center">No notifications yet.</p>
            )}
          </div>
        )}
      </div>

      {/* Account */}
      <div className="relative shrink-0" ref={accountRef}>
        <button
          type="button"
          onClick={() => { setAccountOpen((v) => !v); setNotificationsOpen(false) }}
          className="flex items-center gap-2 p-1.5 pr-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Account menu"
          aria-expanded={accountOpen}
        >
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
            {initial}
          </div>
          <span className="hidden sm:block text-sm font-medium text-zinc-700 dark:text-zinc-300 max-w-[120px] truncate">
            {name || '…'}
          </span>
          <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform shrink-0 ${accountOpen ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {accountOpen && accountMenuPosition && typeof document !== 'undefined' && createPortal(
          <div
            data-account-menu
            role="menu"
            className="fixed w-56 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl z-[9999] py-1"
            style={{ top: accountMenuPosition.top, right: accountMenuPosition.right, left: 'auto' }}
          >
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{name || '…'}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{currentUser?.email ?? 'Signed in'}</p>
            </div>
            <ul className="py-1">
              <li>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountOpen(false)
                    onNavigateToSettings?.('account')
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-colors"
                >
                  <User className="w-4 h-4 text-zinc-400" />
                  Account
                </button>
              </li>
              <li>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountOpen(false)
                    onNavigateToSettings?.()
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-colors"
                >
                  <Settings className="w-4 h-4 text-zinc-400" />
                  Settings
                </button>
              </li>
              <li className="border-t border-zinc-200 dark:border-zinc-700 mt-1 pt-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAccountOpen(false)
                    handleSignOut()
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </li>
            </ul>
          </div>,
          document.body
        )}
      </div>
      </div>
    </header>
  )
}
