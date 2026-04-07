'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MotionConfig } from 'framer-motion'
import DashboardLayout from '@/components/DashboardLayout'
import ConfirmDialog from '@/components/ConfirmDialog'
import RolesTab from '@/components/settings/RolesTab'
import TeamsTab from '@/components/settings/TeamsTab'
import MembersTab from '@/components/settings/MembersTab'
import CampusTab from '@/components/settings/CampusTab'
import SchoolInfoTab from '@/components/settings/SchoolInfoTab'
import AcademicCalendarTab from '@/components/settings/AcademicCalendarTab'
import ApprovalConfigTab from '@/components/settings/ApprovalConfigTab'
import AddOnsTab from '@/components/settings/AddOnsTab'
import AuditLogTab from '@/components/settings/AuditLogTab'
import BillingTab from '@/components/settings/BillingTab'
import IntegrationsTab from '@/components/settings/IntegrationsTab'
import { usePageTitle } from '@/hooks/usePageTitle'
import ProfileTab from './ProfileTab'
import { type Tab, type WorkspaceTab, getInitialTab } from './settings-types'

export default function SettingsPage() {
  usePageTitle('Settings')
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)

  const [activeTab, setActiveTab] = useState<Tab>(getInitialTab)
  const initialTab = activeTab
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(() => new Set(['profile', initialTab]))
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

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  const orgId = typeof window !== 'undefined' ? localStorage.getItem('org-id') : null
  const userName = typeof window !== 'undefined' ? localStorage.getItem('user-name') : null
  const userEmail = typeof window !== 'undefined' ? localStorage.getItem('user-email') : null
  const userAvatar = typeof window !== 'undefined' ? localStorage.getItem('user-avatar') : null
  const userTeam = typeof window !== 'undefined' ? localStorage.getItem('user-team') : null
  const userSchoolScope = typeof window !== 'undefined' ? localStorage.getItem('user-school-scope') : null
  const userRole = typeof window !== 'undefined' ? localStorage.getItem('user-role') : null
  const orgName = typeof window !== 'undefined' ? localStorage.getItem('org-name') : null
  const orgSchoolType = typeof window !== 'undefined' ? localStorage.getItem('org-school-type') : null
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('org-logo-url') : null
  )

  // Optimistic check: show workspace settings immediately for admins
  const optimisticCanManageWorkspace = userRole
    ? (userRole.toLowerCase().includes('admin') || userRole.toLowerCase().includes('super'))
    : false

  // Fetch org logo from API if not in localStorage
  useEffect(() => {
    if (orgLogoUrl || !token) return
    const fetchLogo = async () => {
      try {
        const res = await fetch('/api/onboarding/school-info', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.ok && data.data?.logoUrl) {
            setOrgLogoUrl(data.data.logoUrl)
            localStorage.setItem('org-logo-url', data.data.logoUrl)
          }
        }
      } catch {
        // Silently fail — logo is non-critical
      }
    }
    fetchLogo()
  }, [orgLogoUrl, token])

  // Update both state and URL when switching tabs
  const switchToTab = (tab: Tab) => {
    setActiveTab(tab)
    setVisitedTabs((prev) => new Set(prev).add(tab))
    const url = tab === 'profile' ? '/settings' : `/settings?tab=${tab}`
    window.history.replaceState(null, '', url)
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
    if (!token || !orgId) {
      router.push('/login')
    }
  }, [token, orgId, router])

  useEffect(() => {
    if (!optimisticCanManageWorkspace) return
    // Set optimistic state immediately on client
    setCanManageWorkspace(true)
  }, [optimisticCanManageWorkspace])

  // Lazy-load tabs: only mount a tab when the user first clicks on it.
  // This avoids 10+ simultaneous API calls on page load.
  // The activeTab is always added to visitedTabs when selected.

  useEffect(() => {
    if (!token) return

    const fetchPermissions = async () => {
      const normalizedRole = (userRole || '').toLowerCase()
      const optimisticWorkspaceAccess =
        normalizedRole.includes('admin') || normalizedRole.includes('super')

      if (optimisticWorkspaceAccess) {
        setCanManageWorkspace(true)
      }

      try {
        const response = await fetch('/api/auth/permissions', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error('Failed to load permissions')
        }

        const data = await response.json()
        const allowed = Boolean(data?.data?.canManageWorkspace)
        setCanManageWorkspace(allowed)
      } catch {
        setCanManageWorkspace(
          optimisticWorkspaceAccess
        )
      } finally {
        setPermissionsLoaded(true)
      }
    }

    fetchPermissions()
  }, [token, userRole])

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
    localStorage.removeItem('auth-token')
    localStorage.removeItem('org-id')
    localStorage.removeItem('user-name')
    localStorage.removeItem('user-email')
    localStorage.removeItem('user-avatar')
    localStorage.removeItem('user-team')
    localStorage.removeItem('user-school-scope')
    localStorage.removeItem('user-role')
    localStorage.removeItem('org-name')
    localStorage.removeItem('org-school-type')
    localStorage.removeItem('org-logo-url')
    router.push('/login')
  }

  if (!isClient || !token || !orgId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    )
  }

  return (
    <DashboardLayout
      userName={userName || 'User'}
      userEmail={userEmail || 'user@school.edu'}
      userAvatar={userAvatar || undefined}
      organizationName={orgName || 'School'}
      organizationLogoUrl={orgLogoUrl || undefined}
      schoolLabel={userSchoolScope || orgSchoolType || orgName || 'School'}
      teamLabel={userTeam || userRole || 'Team'}
      onLogout={handleLogout}
    >
      <MotionConfig reducedMotion="user">
      <div className="flex-1 min-h-0 overflow-y-auto -mr-4 sm:-mr-10 pr-4 sm:pr-10">
              {activeTab === 'profile' && (
                <ProfileTab
                  userName={userName}
                  userEmail={userEmail}
                  userAvatar={userAvatar}
                  token={token}
                />
              )}

              {canManageWorkspace && visitedTabs.has('roles') && (
                <div className={activeTab === 'roles' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'} aria-hidden={activeTab !== 'roles'}>
                  <RolesTab onDirtyChange={setRolesDirty} />
                </div>
              )}

              {canManageWorkspace && visitedTabs.has('school-info') && (
                <div className={activeTab === 'school-info' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'} aria-hidden={activeTab !== 'school-info'}>
                  <SchoolInfoTab
                    onDirtyChange={setSchoolInfoDirty}
                    onRegisterSave={(handler) => setSchoolInfoSaveHandler(() => handler)}
                    onRegisterDiscard={(handler) => setSchoolInfoDiscardHandler(() => handler)}
                  />
                </div>
              )}

              {canManageWorkspace && visitedTabs.has('teams') && (
                <div className={activeTab === 'teams' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'} aria-hidden={activeTab !== 'teams'}>
                  <TeamsTab onDirtyChange={setTeamsDirty} />
                </div>
              )}

              {canManageWorkspace && visitedTabs.has('users') && (
                <div className={activeTab === 'users' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'} aria-hidden={activeTab !== 'users'}>
                  <MembersTab onDirtyChange={setUsersDirty} />
                </div>
              )}

              {canManageWorkspace && visitedTabs.has('campus') && (
                <div className={activeTab === 'campus' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'} aria-hidden={activeTab !== 'campus'}>
                  <CampusTab onDirtyChange={setCampusDirty} />
                </div>
              )}

              {canManageWorkspace && visitedTabs.has('academic-calendar') && (
                <div className={activeTab === 'academic-calendar' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'} aria-hidden={activeTab !== 'academic-calendar'}>
                  <AcademicCalendarTab />
                </div>
              )}

              {canManageWorkspace && visitedTabs.has('approval-config') && (
                <div className={activeTab === 'approval-config' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'} aria-hidden={activeTab !== 'approval-config'}>
                  <ApprovalConfigTab />
                </div>
              )}

              {canManageWorkspace && visitedTabs.has('add-ons') && (
                <div className={activeTab === 'add-ons' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'} aria-hidden={activeTab !== 'add-ons'}>
                  <AddOnsTab />
                </div>
              )}

              {canManageWorkspace && visitedTabs.has('integrations') && (
                <div className={activeTab === 'integrations' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'} aria-hidden={activeTab !== 'integrations'}>
                  <IntegrationsTab />
                </div>
              )}

              {canManageWorkspace && visitedTabs.has('activity-log') && (
                <div className={activeTab === 'activity-log' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'} aria-hidden={activeTab !== 'activity-log'}>
                  <AuditLogTab />
                </div>
              )}

              {canManageWorkspace && visitedTabs.has('billing') && (
                <div className={activeTab === 'billing' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'} aria-hidden={activeTab !== 'billing'}>
                  <BillingTab />
                </div>
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
    </DashboardLayout>
  )
}
