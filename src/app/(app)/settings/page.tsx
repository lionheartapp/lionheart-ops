'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MotionConfig } from 'framer-motion'
import dynamic from 'next/dynamic'
import ConfirmDialog from '@/components/ConfirmDialog'
import { usePageTitle } from '@/hooks/usePageTitle'
import ProfileTab from './ProfileTab'

/**
 * F-018: lazy-load every workspace tab via next/dynamic.
 *
 * Before: all 12 tab components were statically imported at the top of this
 * file, so opening /settings (even just the Profile tab) downloaded JS for
 * RolesTab, TeamsTab, MembersTab, the campus map, billing/Stripe, the
 * audit-log table, the approval-rules builder, and so on. Most users never
 * touched most of those.
 *
 * After: each tab's chunk is only fetched the first time the user navigates
 * to it. The `ssr: false` flag is fine here — the parent page is already
 * 'use client' and we render a small `loading` placeholder during the chunk
 * fetch. Profile and the layout stay statically imported because Profile is
 * the default landing tab and the layout shell needs to paint immediately.
 */
function tabSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-8 w-40 bg-slate-100 rounded animate-pulse" />
      <div className="h-4 w-72 bg-slate-100 rounded animate-pulse" />
      <div className="h-32 bg-slate-100 rounded-xl animate-pulse mt-4" />
    </div>
  )
}

const dyn = <T,>(loader: () => Promise<{ default: T }>) =>
  dynamic(loader as () => Promise<{ default: React.ComponentType<unknown> }>, {
    ssr: false,
    loading: tabSkeleton,
  })

const RolesTab = dyn(() => import('@/components/settings/RolesTab')) as React.ComponentType<{ onDirtyChange?: (d: boolean) => void }>
const TeamsTab = dyn(() => import('@/components/settings/TeamsTab')) as React.ComponentType<{ onDirtyChange?: (d: boolean) => void }>
const MembersTab = dyn(() => import('@/components/settings/MembersTab')) as React.ComponentType<{ onDirtyChange?: (d: boolean) => void }>
const FacilitiesTab = dyn(() => import('@/components/settings/FacilitiesTab')) as React.ComponentType<{ onDirtyChange?: (d: boolean) => void; active?: boolean }>
const SchoolInfoTab = dyn(() => import('@/components/settings/SchoolInfoTab')) as React.ComponentType<{
  onDirtyChange?: (d: boolean) => void
  onRegisterSave?: (handler: () => Promise<boolean>) => void
  onRegisterDiscard?: (handler: () => void) => void
  securitySection?: React.ReactNode
}>
const SecuritySettingsSection = dyn(() => import('@/components/settings/SecuritySettingsSection')) as React.ComponentType
const AcademicCalendarTab = dyn(() => import('@/components/settings/AcademicCalendarTab')) as React.ComponentType
const AddOnsTab = dyn(() => import('@/components/settings/AddOnsTab')) as React.ComponentType
const AuditLogTab = dyn(() => import('@/components/settings/AuditLogTab')) as React.ComponentType
const BillingTab = dyn(() => import('@/components/settings/BillingTab')) as React.ComponentType
const IntegrationsTab = dyn(() => import('@/components/settings/IntegrationsTab')) as React.ComponentType
const SsoTab = dyn(() => import('@/components/settings/SsoTab')) as React.ComponentType
const NotificationsTab = dyn(() => import('@/components/settings/NotificationsTab')) as React.ComponentType
import { type Tab, type WorkspaceTab, getInitialTab, VALID_TABS, resolveTab } from './settings-types'
import { useAuth } from '@/lib/hooks/useAuth'
import { useQueryClient } from '@tanstack/react-query'
import { useAppEvent, AppEventName } from '@/lib/events/app-bus'
import { queryKeys } from '@/lib/queries'
import { fetchApi } from '@/lib/api-client'

/**
 * LIVE-003: TabPanel wraps each tab's content. When inactive, it applies the
 * `hidden` class, sets aria-hidden, and imperatively sets the HTML `inert`
 * attribute on its DOM node so the panel is removed from sequential keyboard
 * navigation and from screen reader announcements.
 *
 * Why imperative? React 18 (the project's current version) doesn't pass the
 * unknown `inert` HTML attribute through to the DOM during rendering — a
 * `<div inert="">` JSX element gets stripped down to a plain `<div>`. React 19
 * adds first-class support; until then, set it via ref.
 */
function TabPanel({ active, children }: { active: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (active) {
      el.removeAttribute('inert')
    } else {
      el.setAttribute('inert', '')
    }
  }, [active])
  return (
    <div
      ref={ref}
      className={active ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
      aria-hidden={!active}
    >
      {children}
    </div>
  )
}

export default function SettingsPage() {
  usePageTitle('Settings')
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const [isClient, setIsClient] = useState(false)

  // When the user updates their avatar on the Profile tab, invalidate the
  // members query so the Members tab shows the new photo without a page reload.
  useAppEvent(AppEventName.AVATAR_UPDATED, () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.members.all })
  })

  // F-002: derive activeTab from the URL directly via useMemo on the primitive
  // ?tab= string value. The previous pattern used local state synced to the URL
  // via a useEffect — combined with `window.history.replaceState` in
  // switchToTab (which Next.js's router does not observe), this produced a
  // "Maximum update depth exceeded" loop on deep links like ?tab=teams.
  //
  // By treating the URL as the single source of truth, there's nothing for
  // React to fight with: the only setState path is the URL change via
  // router.replace, which causes useSearchParams to update, which derives the
  // new activeTab via useMemo. No extra round trips.
  // F-008: resolveTab() accepts both canonical keys ("users", "campus") and
  // sidebar-label aliases ("members", "facilities") so deep links from either
  // form land on the right panel.
  const tabParamStr = searchParams.get('tab')
  const activeTab: Tab = useMemo(() => {
    return resolveTab(tabParamStr) ?? 'profile'
  }, [tabParamStr])

  // visitedTabs is still local state — it's a "stickier" structure (once a tab
  // has been opened, it stays mounted) and isn't derivable from the URL alone.
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(() => new Set(['profile', activeTab]))
  useEffect(() => {
    setVisitedTabs((prev) => (prev.has(activeTab) ? prev : new Set(prev).add(activeTab)))
  }, [activeTab])
  const [canManageWorkspace, setCanManageWorkspace] = useState(false)
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)
  const [schoolInfoDirty, setSchoolInfoDirty] = useState(false)
  const [rolesDirty, setRolesDirty] = useState(false)
  const [teamsDirty, setTeamsDirty] = useState(false)
  const [usersDirty, setUsersDirty] = useState(false)
  const [campusDirty, setCampusDirty] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingTab, setPendingTab] = useState<Tab | null>(null)
  const [blockedTab, setBlockedTab] = useState<WorkspaceTab | null>(null)
  const [leavingWithSave, setLeavingWithSave] = useState(false)
  const [schoolInfoSaveHandler, setSchoolInfoSaveHandler] = useState<(() => Promise<boolean>) | null>(null)
  const [schoolInfoDiscardHandler, setSchoolInfoDiscardHandler] = useState<(() => void) | null>(null)

  // Audit ref C3/H4: cookie-based auth via useAuth.
  const { user, org, orgId, isReady, logout } = useAuth({ redirectTo: '/login' })
  const userName = user.name
  const userEmail = user.email
  const userAvatar = user.avatar
  const userTeam = user.team
  // Prefer campusScope; schoolScope is kept as a deprecated alias during Phase 1c migration.
  const userSchoolScope = user.campusScope ?? user.schoolScope
  const userRole = user.role
  const orgName = org.name
  // `org.schoolType` was removed in the Phase 1c ontology inversion — the API
  // now emits `schoolType: null` for backward compat. This is retained only as
  // a display fallback label until the surrounding UI is refactored to read
  // institutionType from the active school instead.
  const orgSchoolType = org.schoolType
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(org.logoUrl)

  // Optimistic check: show workspace settings immediately for admins
  const optimisticCanManageWorkspace = userRole
    ? (userRole.toLowerCase().includes('admin') || userRole.toLowerCase().includes('super'))
    : false

  // Keep local logo in sync with useAuth
  useEffect(() => {
    if (org.logoUrl && org.logoUrl !== orgLogoUrl) {
      setOrgLogoUrl(org.logoUrl)
    }
  }, [org.logoUrl, orgLogoUrl])

  // Fetch org logo via cookie-auth if not already loaded
  useEffect(() => {
    if (orgLogoUrl || !isReady) return
    let cancelled = false
    fetchApi<{ logoUrl?: string | null }>('/api/onboarding/school-info')
      .then((data) => {
        if (!cancelled && data?.logoUrl) {
          setOrgLogoUrl(data.logoUrl)
        }
      })
      .catch(() => {
        // Silently fail — logo is non-critical
      })
    return () => {
      cancelled = true
    }
  }, [orgLogoUrl, isReady])

  // F-037 + F-002: use Next.js's router.replace so URL and React state stay in
  // sync — `window.history.replaceState` bypassed Next's router and left the
  // searchParams hook stale, contributing to the infinite-loop bug.
  // visitedTabs is still updated optimistically so we don't wait a tick for
  // the URL to round-trip before mounting the destination panel.
  const switchToTab = (tab: Tab) => {
    setVisitedTabs((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)))
    const url = tab === 'profile' ? '/settings' : `/settings?tab=${tab}`
    router.replace(url, { scroll: false })
  }

  // Keep a stable ref to requestTabChange so the event listener never goes stale
  const requestTabChangeRef = useRef<(tab: Tab) => void>(() => {})
  useEffect(() => {
    requestTabChangeRef.current = requestTabChange
  })

  // Listen for tab changes from the Sidebar — registered once so events are never missed
  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const event = e as CustomEvent<{ tab: Tab }>
      if (event.detail?.tab) {
        requestTabChangeRef.current(event.detail.tab)
      }
    }
    window.addEventListener('settings-tab-change', handleTabChange)
    return () => window.removeEventListener('settings-tab-change', handleTabChange)
  }, [])

  useEffect(() => {
    setIsClient(true)
    // useAuth handles the redirect now — we just need the SSR-safe flag flip.
  }, [])

  useEffect(() => {
    if (!optimisticCanManageWorkspace) return
    // Set optimistic state immediately on client
    setCanManageWorkspace(true)
  }, [optimisticCanManageWorkspace])

  // Lazy-load tabs: only mount a tab when the user first clicks on it.
  // This avoids 10+ simultaneous API calls on page load.
  // The activeTab is always added to visitedTabs when selected.

  useEffect(() => {
    if (!orgId) return

    const fetchPermissions = async () => {
      const normalizedRole = (userRole || '').toLowerCase()
      const optimisticWorkspaceAccess =
        normalizedRole.includes('admin') || normalizedRole.includes('super')

      if (optimisticWorkspaceAccess) {
        setCanManageWorkspace(true)
      }

      try {
        const response = await fetchApi<{ canManageWorkspace?: boolean }>(
          '/api/auth/permissions',
        )
        const allowed = Boolean(response?.canManageWorkspace)
        setCanManageWorkspace(allowed)
      } catch {
        setCanManageWorkspace(optimisticWorkspaceAccess)
      } finally {
        setPermissionsLoaded(true)
      }
    }

    fetchPermissions()
  }, [orgId, userRole])

  useEffect(() => {
    if (!permissionsLoaded || canManageWorkspace) return

    if (activeTab !== 'profile') {
      switchToTab('profile')
    }
  }, [activeTab, canManageWorkspace, permissionsLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  const requestTabChange = (nextTab: Tab) => {
    if (nextTab === activeTab) return

    const isActiveTabDirty =
      (activeTab === 'school-info' && schoolInfoDirty) ||
      (activeTab === 'roles' && rolesDirty) ||
      (activeTab === 'teams' && teamsDirty) ||
      (activeTab === 'users' && usersDirty) ||
      (activeTab === 'campus' && campusDirty)

    if (isActiveTabDirty) {
      setPendingTab(nextTab)
      setBlockedTab(activeTab as WorkspaceTab)
      setShowUnsavedDialog(true)
      return
    }

    switchToTab(nextTab)
  }

  const handleStayOnCurrentTab = () => {
    setShowUnsavedDialog(false)
    setPendingTab(null)
    setBlockedTab(null)
  }

  const handleDiscardAndLeave = () => {
    if (blockedTab === 'school-info') {
      schoolInfoDiscardHandler?.()
      setSchoolInfoDirty(false)
    }
    if (blockedTab === 'roles') setRolesDirty(false)
    if (blockedTab === 'teams') setTeamsDirty(false)
    if (blockedTab === 'users') setUsersDirty(false)
    if (blockedTab === 'campus') setCampusDirty(false)

    if (pendingTab) {
      switchToTab(pendingTab)
    }
    setShowUnsavedDialog(false)
    setPendingTab(null)
    setBlockedTab(null)
  }

  const handleSaveAndLeave = async () => {
    if (blockedTab !== 'school-info') {
      handleDiscardAndLeave()
      return
    }

    if (!schoolInfoSaveHandler) {
      if (pendingTab) {
        switchToTab(pendingTab)
      }
      setShowUnsavedDialog(false)
      setPendingTab(null)
      setBlockedTab(null)
      return
    }

    setLeavingWithSave(true)
    const didSave = await schoolInfoSaveHandler()
    setLeavingWithSave(false)

    if (!didSave) return

    setSchoolInfoDirty(false)
    if (pendingTab) {
      switchToTab(pendingTab)
    }
    setShowUnsavedDialog(false)
    setPendingTab(null)
    setBlockedTab(null)
  }

  const unsavedDialogTitle = blockedTab === 'school-info'
    ? 'Unsaved school information'
    : 'Unsaved changes'

  const unsavedDialogMessage = blockedTab === 'school-info'
    ? 'You have unsaved changes. Do you want to save before leaving this tab?'
    : 'You have unsaved changes in this tab. If you leave now, they will be discarded.'

  const handleLogout = () => {
    logout()
  }

  if (!isClient || !isReady || !orgId) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="h-8 w-32 bg-slate-200 rounded animate-pulse mb-6" />
          <div className="flex gap-2 mb-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 w-24 bg-slate-200 rounded-full animate-pulse" />
            ))}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <MotionConfig reducedMotion="user">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 sm:px-10 pt-6 lg:pt-8 pb-6">
              {/*
                F-015: visually-hidden h1 establishes the page heading for
                screen readers. The on-screen tab panels keep their existing
                visual h3 hierarchy; this just gives AT users the missing
                top-level landmark and announces the active tab on switch.
              */}
              <h1 className="sr-only" aria-live="polite">
                {(() => {
                  const labels: Record<Tab, string> = {
                    profile: 'My Profile',
                    notifications: 'Notifications',
                    'school-info': 'School Information',
                    roles: 'Roles',
                    teams: 'Teams',
                    users: 'Members',
                    campus: 'Facilities',
                    'academic-calendar': 'Academic Calendar',
                    'approval-config': 'Approval Configuration',
                    'add-ons': 'Add-ons',
                    integrations: 'Integrations',
                    sso: 'Single Sign-On',
                    'activity-log': 'Activity Log',
                    billing: 'Billing',
                  }
                  return labels[activeTab] || 'Settings'
                })()}
              </h1>
              {activeTab === 'profile' && (
                <ProfileTab
                  userName={userName}
                  userEmail={userEmail}
                  userAvatar={userAvatar}
                />
              )}

              {visitedTabs.has('notifications') && (
                <TabPanel active={activeTab === 'notifications'}>
                  <NotificationsTab />
                </TabPanel>
              )}

              {/*
                LIVE-003: each tab panel below remains mounted after first
                visit so its state and queries don't get torn down on tab
                switch. To avoid the a11y problem of 100+ focusable elements
                living in the hidden DOM, the inactive panels get the inert
                attribute — that removes them from sequential keyboard
                navigation and from screen reader announcements while
                preserving the React tree.

                React 18 doesn't ship a typed `inert` prop (added in React 19),
                so we spread it via a helper that emits the bare HTML attribute
                when inactive.
              */}
              {canManageWorkspace && visitedTabs.has('roles') && (
                <TabPanel active={activeTab === 'roles'}>
                  <RolesTab onDirtyChange={setRolesDirty} />
                </TabPanel>
              )}

              {canManageWorkspace && visitedTabs.has('school-info') && (
                <TabPanel active={activeTab === 'school-info'}>
                  <SchoolInfoTab
                    onDirtyChange={setSchoolInfoDirty}
                    onRegisterSave={(handler) => setSchoolInfoSaveHandler(() => handler)}
                    onRegisterDiscard={(handler) => setSchoolInfoDiscardHandler(() => handler)}
                    securitySection={<SecuritySettingsSection />}
                  />
                </TabPanel>
              )}

              {canManageWorkspace && visitedTabs.has('teams') && (
                <TabPanel active={activeTab === 'teams'}>
                  <TeamsTab onDirtyChange={setTeamsDirty} />
                </TabPanel>
              )}

              {canManageWorkspace && visitedTabs.has('users') && (
                <TabPanel active={activeTab === 'users'}>
                  <MembersTab onDirtyChange={setUsersDirty} />
                </TabPanel>
              )}

              {canManageWorkspace && visitedTabs.has('campus') && (
                <TabPanel active={activeTab === 'campus'}>
                  <div className="-mx-4 sm:-mx-8 -mb-6">
                    <FacilitiesTab onDirtyChange={setCampusDirty} active={activeTab === 'campus'} />
                  </div>
                </TabPanel>
              )}

              {canManageWorkspace && visitedTabs.has('academic-calendar') && (
                <TabPanel active={activeTab === 'academic-calendar'}>
                  <AcademicCalendarTab />
                </TabPanel>
              )}

              {/* Approval Config moved to /events/approval-rules */}

              {canManageWorkspace && visitedTabs.has('add-ons') && (
                <TabPanel active={activeTab === 'add-ons'}>
                  <AddOnsTab />
                </TabPanel>
              )}

              {canManageWorkspace && visitedTabs.has('integrations') && (
                <TabPanel active={activeTab === 'integrations'}>
                  <IntegrationsTab />
                </TabPanel>
              )}

              {canManageWorkspace && visitedTabs.has('sso') && (
                <TabPanel active={activeTab === 'sso'}>
                  <SsoTab />
                </TabPanel>
              )}

              {canManageWorkspace && visitedTabs.has('activity-log') && (
                <TabPanel active={activeTab === 'activity-log'}>
                  <AuditLogTab />
                </TabPanel>
              )}

              {canManageWorkspace && visitedTabs.has('billing') && (
                <TabPanel active={activeTab === 'billing'}>
                  <BillingTab />
                </TabPanel>
              )}
      </div>
      </MotionConfig>

      <ConfirmDialog
        isOpen={showUnsavedDialog}
        onClose={handleStayOnCurrentTab}
        onConfirm={blockedTab === 'school-info' ? handleSaveAndLeave : handleDiscardAndLeave}
        title={unsavedDialogTitle}
        message={unsavedDialogMessage}
        confirmText={blockedTab === 'school-info' ? 'Save & Leave' : 'Discard & Leave'}
        cancelText="Stay Here"
        variant="warning"
        isLoading={leavingWithSave}
        loadingText="Saving..."
        extraAction={blockedTab === 'school-info'
          ? {
              label: 'Discard & Leave',
              onClick: handleDiscardAndLeave,
              className:
                'flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition',
            }
          : undefined}
      />
    </>
  )
}
