'use client'

import { ReactNode, useState } from 'react'
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
  userAvatar,
  organizationName,
  organizationLogoUrl,
  schoolLabel,
  teamLabel,
  onLogout,
}: DashboardLayoutProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  
  const formattedSchoolLabel = (schoolLabel || organizationName || 'School')
    .toString()
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())

  const subtitleParts = [formattedSchoolLabel, teamLabel].filter(Boolean)

  return (
    <div className="flex w-full min-h-screen bg-white">
      {/* Sidebar */}
      <Sidebar
        userName={userName}
        userEmail={userEmail}
        userAvatar={userAvatar}
        onLogout={onLogout}
      />

      {/* Main Content */}
      <main className="flex-1 pt-16 lg:pt-0">
        <div className="py-4 sm:py-6 lg:py-8 px-4 sm:px-10">
          {/* Search Bar - Above greeting */}
          <div className="mb-8 w-full max-w-2xl">
            <input
              type="search"
              placeholder="Search here..."
              className="w-full h-11 rounded-full border border-gray-200 bg-gray-50 px-4 text-sm text-gray-800 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search"
            />
          </div>

          {/* Top Bar with Logo and User Profile */}
          <div className="mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {organizationLogoUrl ? (
                <img
                  src={organizationLogoUrl}
                  alt={`${organizationName || 'School'} logo`}
                  className="h-10 w-10 rounded-lg object-cover border border-gray-200 bg-white"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-semibold">
                  {(organizationName || 'S').charAt(0).toUpperCase()}
                </div>
              )}
              <p className="text-base font-semibold text-gray-900 truncate">
                {organizationName || 'School'}
              </p>
            </div>

            {/* User Profile with Dropdown */}
            <div className="flex items-center gap-3 justify-end relative">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-900">{userName || 'User'}</p>
                <p className="text-xs text-gray-600 truncate">{subtitleParts.join(' • ')}</p>
              </div>
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-lg transition"
                  aria-label="User menu"
                  aria-expanded={isDropdownOpen}
                >
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold overflow-hidden">
                    {userAvatar ? (
                      <img src={userAvatar} alt={userName || 'User'} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      (userName || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-600" aria-hidden="true" />
                </button>
                
                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    <Link
                      href="/settings"
                      className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 transition rounded-t-lg"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      Settings
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {children}
        </div>
      </main>
    </div>
  )
}
