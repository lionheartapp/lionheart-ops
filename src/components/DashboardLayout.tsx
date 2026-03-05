'use client'

import { ReactNode, useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Search } from 'lucide-react'
import { dropdownVariants } from '@/lib/animations'
import Sidebar, { type SidebarProps } from './Sidebar'
import NotificationBell from './NotificationBell'
import SearchCommand from './SearchCommand'

interface DashboardLayoutProps extends SidebarProps {
  children: ReactNode
  organizationName?: string
  organizationLogoUrl?: string
  schoolLabel?: string
  teamLabel?: string
}

export default function DashboardLayout({
  children,
  userName,
  userEmail,
  userAvatar: initialUserAvatar,
  organizationName,
  organizationLogoUrl,
  schoolLabel,
  teamLabel,
  onLogout,
}: DashboardLayoutProps) {
  const pathname = usePathname()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [userAvatar, setUserAvatar] = useState<string | null>(initialUserAvatar || null)

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
          {organizationLogoUrl ? (
            <div className="h-9 w-9 rounded-lg bg-white flex items-center justify-center p-1.5 flex-shrink-0">
              <img
                src={organizationLogoUrl}
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
                {onLogout && (
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
                )}
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
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="relative py-4 sm:py-6 lg:py-8 px-4 sm:px-10"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {isSearchOpen && <SearchCommand isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}
