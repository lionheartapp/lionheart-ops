'use client'

import { ReactNode, useState, useEffect, useRef, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import Sidebar, { type SidebarProps } from './Sidebar'
import SearchCommand from './SearchCommand'
import ImpersonationBanner from './ImpersonationBanner'
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
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isImpersonating, setIsImpersonating] = useState(false)
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

  // Detect impersonation state
  useEffect(() => {
    setIsImpersonating(localStorage.getItem('is-impersonating') === 'true')
  }, [pathname]) // re-check on navigation (catches reload after impersonate)

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

  return (
    <div className="flex w-full h-screen flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, rgb(243, 249, 255) 0%, rgb(229, 237, 246) 100%)' }}>
      {/* Impersonation Banner */}
      {isImpersonating && <ImpersonationBanner />}

      <div className={`flex flex-1 min-h-0 ${isImpersonating ? 'pt-[40px]' : ''}`}>
        {/* Sidebar */}
        <Sidebar
          userName={userName}
          userEmail={userEmail}
          userAvatar={userAvatar || undefined}
          organizationName={organizationName}
          organizationLogoUrl={orgLogoUrl}
          onLogout={onLogout}
          onSearchOpen={() => setIsSearchOpen(true)}
        />

        {/* Main Content */}
        <main className="flex-1 min-w-0 min-h-0 overflow-hidden relative flex flex-col">
          {/* Ambient gradient blobs — gives glass cards depth on Aura canvas */}
          <div className="fixed inset-0 pointer-events-none" aria-hidden="true" style={{ zIndex: 0 }}>
            <div className="absolute -top-32 right-0 w-[500px] h-[500px] rounded-full blur-[140px] bg-blue-300/[0.15]" />
            <div className="absolute top-1/3 -left-32 w-[400px] h-[400px] rounded-full blur-[140px] bg-violet-300/[0.12]" />
            <div className="absolute bottom-0 right-1/4 w-[350px] h-[350px] rounded-full blur-[120px] bg-indigo-200/[0.10]" />
          </div>
          <div className="relative py-4 sm:py-6 lg:py-8 px-4 sm:px-10 flex-1 flex flex-col min-h-0 overflow-hidden">
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
