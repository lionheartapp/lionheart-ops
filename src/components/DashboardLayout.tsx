'use client'

import { ReactNode, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Search } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { dropdownVariants } from '@/lib/animations'
import Sidebar, { type SidebarProps } from './Sidebar'
import NotificationBell from './NotificationBell'
import SearchCommand from './SearchCommand'
import { syncOfflineData } from '@/lib/offline/sync'
import { useConnectivity } from '@/hooks/useConnectivity'

/** Read a localStorage key, returning null during SSR. */
const ls = (key: string) =>
  typeof window !== 'undefined' ? localStorage.getItem(key) : null

interface DashboardLayoutProps extends SidebarProps {
  children: ReactNode
  organizationName?: string
  organizationLogoUrl?: string
  schoolLabel?: string
  teamLabel?: string
}

export default function DashboardLayout({
  children,
  userName: userNameProp,
  userEmail: userEmailProp,
  userAvatar: userAvatarProp,
  organizationName: orgNameProp,
  organizationLogoUrl,
  schoolLabel,
  teamLabel,
  onLogout: onLogoutProp,
}: DashboardLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const isOnline = useConnectivity()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const prevOnlineRef = useRef(isOnline)

  // Resolve user/org data: prefer explicit props, fall back to localStorage
  const userName = userNameProp || ls('user-name') || undefined
  const userEmail = userEmailProp || ls('user-email') || undefined
  const organizationName = orgNameProp || ls('org-name') || undefined
  const orgLogoUrl = organizationLogoUrl || ls('org-logo-url') || undefined
  const initialUserAvatar = userAvatarProp || ls('user-avatar') || null
  const [userAvatar, setUserAvatar] = useState<string | null>(initialUserAvatar)

  // Default logout clears localStorage and redirects to login
  const onLogout = useMemo(() => {
    if (onLogoutProp) return onLogoutProp
    return () => {
      ;[
        'auth-token', 'org-id', 'user-name', 'user-email', 'user-avatar',
        'user-team', 'user-school-scope', 'user-role', 'org-name',
        'org-school-type', 'org-logo-url',
      ].forEach((key) => localStorage.removeItem(key))
      router.push('/login')
    }
  }, [onLogoutProp, router])

  // Cmd+K / Ctrl+K shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Close dropdown on click outside or Escape
  const closeDropdown = useCallback(() => setIsDropdownOpen(false), [])

  useEffect(() => {
    if (!isDropdownOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        closeDropdown()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDropdown()
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isDropdownOpen, closeDropdown])

  useEffect(() => {
    setUserAvatar(initialUserAvatar || null)
  }, [initialUserAvatar])

  useEffect(() => {
    // Listen for custom avatar update event (from same window)
    const handleAvatarUpdate = (e: Event) => {
      const event = e as CustomEvent
      if (event.detail?.avatar !== undefined) {
        setUserAvatar(event.detail.avatar)
      }
    }
    window.addEventListener('avatar-updated', handleAvatarUpdate)
    return () => window.removeEventListener('avatar-updated', handleAvatarUpdate)
  }, [])

  // Trigger background sync when transitioning from offline → online
  useEffect(() => {
    const wasOffline = !prevOnlineRef.current
    prevOnlineRef.current = isOnline

    if (isOnline && wasOffline) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
      if (token) {
        syncOfflineData(queryClient, token).catch(() => {
          // Sync failures are surfaced in ConnectivityIndicator; no unhandled rejection
        })
      }
    }
  }, [isOnline, queryClient])

  const formattedSchoolLabel = (schoolLabel || organizationName || 'School')
    .toString()
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())

  const subtitleParts = [formattedSchoolLabel, teamLabel].filter(Boolean)

  return (
    <div className="flex w-full min-h-screen bg-gray-50 flex-col">
      {/* Top Bar Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-[#111827] border-b border-white/10 px-6 flex items-center justify-between z-navbar">
        {/* Logo and Organization Name */}
        <div className="flex items-center gap-3 min-w-0 flex-shrink-0 pl-14 lg:pl-0">
          {orgLogoUrl ? (
            <div className="h-9 w-9 rounded-lg bg-white flex items-center justify-center p-1.5 flex-shrink-0">
              <img
                src={orgLogoUrl}
                alt={`${organizationName || 'School'} logo`}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="h-9 w-9 rounded-lg bg-primary-500 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
              {(organizationName || 'S').charAt(0).toUpperCase()}
            </div>
          )}
          <p className="text-sm font-semibold text-white truncate">
            {organizationName || 'School'}
          </p>
        </div>

        {/* Global Search Trigger */}
        <div className="hidden sm:block flex-1 pl-10 pr-6 max-w-md">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-full h-9 rounded-full border border-white/20 bg-white/10 px-4 flex items-center gap-2 text-sm text-slate-400 hover:bg-white/15 hover:border-white/30 transition cursor-pointer"
          >
            <Search className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-slate-500 bg-white/10 rounded border border-white/10">
              &#8984;K
            </kbd>
          </button>
        </div>

        {/* Notifications + User Profile */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="sm:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>
          <NotificationBell />
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-white">{userName || 'User'}</p>
            <p className="text-xs text-slate-400 truncate">{subtitleParts.join(' • ')}</p>
          </div>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 p-1 hover:bg-white/10 rounded-lg transition"
              aria-label="User menu"
              aria-expanded={isDropdownOpen}
              aria-haspopup="true"
            >
              <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold overflow-hidden text-sm">
                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt={userName || 'User'}
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  (userName || 'U').charAt(0).toUpperCase()
                )}
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" aria-hidden="true" />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                className="absolute right-0 mt-2 w-48 ui-glass-dropdown z-dropdown overflow-hidden text-gray-800"
                variants={dropdownVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <Link
                  href="/settings"
                  onClick={() => setIsDropdownOpen(false)}
                  className="block px-4 py-3 text-sm text-gray-800 hover:bg-gray-50 transition"
                >
                  Settings
                </Link>
                <button
                  onClick={() => {
                    onLogout()
                    setIsDropdownOpen(false)
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition border-t border-gray-100"
                  aria-label="Log out"
                >
                  Log Out
                </button>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <div className="flex flex-1 pt-16">
        {/* Sidebar */}
        <Sidebar
          userName={userName}
          userEmail={userEmail}
          userAvatar={userAvatar || undefined}
          onLogout={onLogout}
        />

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-hidden relative">
          {/* Ambient gradient blobs — gives glass cards depth */}
          <div className="fixed inset-0 pointer-events-none" aria-hidden="true" style={{ zIndex: 0 }}>
            <div className="absolute -top-32 right-0 w-[500px] h-[500px] rounded-full blur-[120px] bg-blue-200/[0.08]" />
            <div className="absolute top-1/3 -left-32 w-[400px] h-[400px] rounded-full blur-[120px] bg-violet-200/[0.06]" />
            <div className="absolute bottom-0 right-1/4 w-[350px] h-[350px] rounded-full blur-[100px] bg-amber-100/[0.06]" />
          </div>
          <div className="relative py-4 sm:py-6 lg:py-8 px-4 sm:px-10">
            {children}
          </div>
        </main>
      </div>

      <AnimatePresence>
        {isSearchOpen && <SearchCommand isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}
