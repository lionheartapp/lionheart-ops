'use client'

import { ReactNode, useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import Sidebar, { type SidebarProps } from './Sidebar'
import SearchCommand from './SearchCommand'
import ImpersonationBanner from './ImpersonationBanner'
import TrialBanner from './TrialBanner'
import { syncOfflineData } from '@/lib/offline/sync'
import { useConnectivity } from '@/hooks/useConnectivity'
import { useMobileDetect } from '@/lib/hooks/useMobileDetect'

// Lazy-load mobile components — entire mobile bundle is code-split away from desktop
const MobileShell = lazy(() => import('./mobile/MobileShell'))

/** Read a localStorage key, returning null during SSR. */
const ls = (key: string) =>
  typeof window !== 'undefined' ? localStorage.getItem(key) : null

interface DashboardLayoutProps extends SidebarProps {
  children: ReactNode
  organizationName?: string
  organizationLogoUrl?: string
  schoolLabel?: string
  teamLabel?: string
  /** Pass a custom sidebar element to replace the default Sidebar */
  customSidebar?: ReactNode
  /** When true, the content wrapper renders with no padding (caller manages its own) */
  noPadding?: boolean
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
  customSidebar,
  noPadding,
}: DashboardLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const isOnline = useConnectivity()
  const { isMobile } = useMobileDetect()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isImpersonating, setIsImpersonating] = useState(false)
  const prevOnlineRef = useRef(isOnline)

  // Resolve user/org data: prefer explicit props, fall back to localStorage
  const userName = userNameProp || ls('user-name') || undefined
  const userEmail = userEmailProp || ls('user-email') || undefined
  const [organizationName, setOrganizationName] = useState(orgNameProp || ls('org-name') || undefined)
  const [orgLogoUrl, setOrgLogoUrl] = useState(organizationLogoUrl || ls('org-logo-url') || undefined)
  const initialUserAvatar = userAvatarProp || ls('user-avatar') || null
  const [userAvatar, setUserAvatar] = useState<string | null>(initialUserAvatar)

  // Sync logo/name when the parent prop arrives (e.g. after useAuth background fetch)
  useEffect(() => {
    if (organizationLogoUrl) setOrgLogoUrl(organizationLogoUrl)
  }, [organizationLogoUrl])
  useEffect(() => {
    if (orgNameProp) setOrganizationName(orgNameProp)
  }, [orgNameProp])

  // Listen for branding changes from SchoolInfoTab so sidebar updates live
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ name: string; logoUrl: string | null }>).detail
      if (detail.name) setOrganizationName(detail.name)
      setOrgLogoUrl(detail.logoUrl || undefined)
    }
    window.addEventListener('branding-changed', handler)
    return () => window.removeEventListener('branding-changed', handler)
  }, [])

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

  // Prevent the browser from restoring scroll position on refresh.
  // history.scrollRestoration covers the document; the ref callback + delayed
  // reset cover <main>'s own overflow-y-auto scroll restoration (Chrome tracks
  // overflow containers independently).
  const mainRef = useCallback((node: HTMLElement | null) => {
    if (node) {
      node.scrollTop = 0
      // Chrome restores overflow scroll async — beat it with a second reset
      requestAnimationFrame(() => { node.scrollTop = 0 })
    }
  }, [])
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
  }, [])

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

  const contentBody = (
    <div className="flex w-full h-screen flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #f5f4f0 0%, #eae8e2 100%)' }}>
      {/*
        Skip-links for keyboard users.
        F-045: added a second skip-link that jumps over the main content
        straight to the ~30-item module nav, since power users tabbing
        through don't want to traverse every page heading first.
      */}
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>
      <a href="#sidebar-nav" className="skip-to-main">
        Skip to module navigation
      </a>

      {/* Impersonation Banner (fixed, overlays content) */}
      {isImpersonating && <ImpersonationBanner />}

      {/* Trial / billing status banner (inline, pushes content down) */}
      <TrialBanner />

      <div className={`flex flex-1 min-h-0 ${isImpersonating ? 'pt-[40px]' : ''}`}>
        {/* Sidebar — desktop only (skip entire component tree on mobile) */}
        {!isMobile && (customSidebar || (
          <Sidebar
            userName={userName}
            userEmail={userEmail}
            userAvatar={userAvatar || undefined}
            organizationName={organizationName}
            organizationLogoUrl={orgLogoUrl}
            onLogout={onLogout}
            onSearchOpen={() => setIsSearchOpen(true)}
          />
        ))}

        {/* Main Content */}
        <main ref={mainRef} id="main-content" className={`flex-1 min-w-0 min-h-0 relative ${isMobile ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}>
          {/* Warm ambient orbs — gives glass cards depth via transparency interaction */}
          <div className="fixed inset-0 pointer-events-none" aria-hidden="true" style={{ zIndex: 0 }}>
            <div className="absolute -top-32 right-0 w-[550px] h-[550px] rounded-full blur-[140px]" style={{ backgroundColor: 'rgba(180, 160, 130, 0.12)' }} />
            <div className="absolute top-1/3 -left-32 w-[400px] h-[400px] rounded-full blur-[140px]" style={{ backgroundColor: 'rgba(160, 145, 120, 0.08)' }} />
            <div className="absolute bottom-0 right-1/4 w-[350px] h-[350px] rounded-full blur-[120px]" style={{ backgroundColor: 'rgba(140, 130, 110, 0.06)' }} />
          </div>
          {isMobile ? (
            <Suspense fallback={null}>
              <MobileShell
                userName={userName}
                userEmail={userEmail}
                userAvatar={userAvatar}
                onLogout={onLogout}
                onSearchOpen={() => setIsSearchOpen(true)}
              >
                {children}
              </MobileShell>
            </Suspense>
          ) : (
            <div className={`relative flex flex-col ${noPadding ? 'h-full' : 'min-h-full pl-4 pr-4 sm:px-10 pt-6 lg:pt-8 pb-10'}`}>
              {children}
            </div>
          )}
        </main>
      </div>

      <AnimatePresence>
        {isSearchOpen && <SearchCommand isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />}
      </AnimatePresence>

    </div>
  )

  return contentBody
}
