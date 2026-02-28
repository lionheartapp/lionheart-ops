'use client'

import { ReactNode, useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import Sidebar, { type SidebarProps } from './Sidebar'

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [userAvatar, setUserAvatar] = useState<string | null>(initialUserAvatar || null)

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
        <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
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

        {/* Search Bar */}
        <div className="flex-1 pl-10 pr-6 max-w-md">
          <input
            type="search"
            placeholder="Search here..."
            className="w-full h-9 rounded-full border border-white/20 bg-white/10 px-4 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
            aria-label="Search"
          />
        </div>

        {/* User Profile with Dropdown */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-white">{userName || 'User'}</p>
            <p className="text-xs text-slate-400 truncate">{subtitleParts.join(' • ')}</p>
          </div>
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 p-1 hover:bg-white/10 rounded-lg transition"
              aria-label="User menu"
              aria-expanded={isDropdownOpen}
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
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-dropdown overflow-hidden">
                <Link
                  href="/settings"
                  onClick={() => setIsDropdownOpen(false)}
                  className="block px-4 py-3 text-sm hover:bg-gray-50 transition"
                  style={{ color: '#1f2937' }}
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
              </div>
            )}
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
        <main className="flex-1">
          <div className="py-4 sm:py-6 lg:py-8 px-4 sm:px-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
