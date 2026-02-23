'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react'

export interface SidebarProps {
  userName?: string
  userEmail?: string
  userAvatar?: string
  onLogout?: () => void
}

export default function Sidebar({
  userName = 'User',
  userEmail = 'user@school.edu',
  userAvatar,
  onLogout,
}: SidebarProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')

  const navItems = [
    { icon: Home, label: 'Home', href: '/dashboard' },
  ]

  const sidebarContent = (
    <>
      {/* Navigation Menu */}
      <nav className="p-4 flex-1" role="navigation" aria-label="Main navigation">
        <ul className="space-y-2" role="list">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-lg transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    active
                      ? 'bg-blue-100 text-blue-600 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  <span className="text-sm">{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>


    </>
  )

  return (
    <>
      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-40 p-2 min-h-[44px] min-w-[44px] rounded-lg bg-white border border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-gray-900" aria-hidden="true" />
        ) : (
          <Menu className="w-6 h-6 text-gray-900" aria-hidden="true" />
        )}
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
          role="presentation"
        />
      )}

      {/* Sidebar Desktop */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 transition-all duration-300 z-20 ${
          isExpanded ? 'w-64' : 'w-20'
        }`}
        aria-label="Sidebar navigation"
      >
        {sidebarContent}
      </aside>

      {/* Sidebar Mobile */}
      <aside
        className={`lg:hidden fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 z-30 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="navigation"
        aria-label="Mobile navigation"
      >
        {sidebarContent}
      </aside>

      {/* Spacer for desktop layout */}
      <div className="hidden lg:block w-64 flex-shrink-0" />
    </>
  )
}
