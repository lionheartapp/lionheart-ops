'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import DetailDrawer from '@/components/DetailDrawer'
import ConfirmDialog from '@/components/ConfirmDialog'
import RolesTab from '@/components/settings/RolesTab'
import TeamsTab from '@/components/settings/TeamsTab'
import MembersTab from '@/components/settings/MembersTab'
import CampusTab from '@/components/settings/CampusTab'
import SchoolInfoTab from '@/components/settings/SchoolInfoTab'

type Tab = 'profile' | 'school-info' | 'roles' | 'teams' | 'users' | 'campus'

type WorkspaceTab = Exclude<Tab, 'profile'>

const VALID_TABS: Tab[] = ['profile', 'school-info', 'roles', 'teams', 'users', 'campus']

export default function SettingsPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isClient, setIsClient] = useState(false)

  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(new Set<Tab>(['profile']))
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
  const [avatarUpdating, setAvatarUpdating] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [displayAvatar, setDisplayAvatar] = useState<string | null>(null)

  // Profile name editing
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState(false)

  // Change password drawer
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // On client mount, restore the saved tab from localStorage
  const hasRestoredTab = useRef(false)
  useEffect(() => {
    if (hasRestoredTab.current) return
    hasRestoredTab.current = true

    // Check localStorage for saved tab
    const saved = localStorage.getItem('settings-active-tab')
    const WORKSPACE_TABS: Tab[] = ['school-info', 'roles', 'teams', 'users', 'campus']

    if (saved && VALID_TABS.includes(saved as Tab) && saved !== 'profile') {
      const restoredTab = saved as Tab

      // Only restore workspace tabs if user has admin access
      if (WORKSPACE_TABS.includes(restoredTab)) {
        const role = localStorage.getItem('user-role') || ''
        const isAdmin = role.toLowerCase().includes('admin') || role.toLowerCase().includes('super')
        if (!isAdmin) return
      }

      setActiveTab(restoredTab)
      setVisitedTabs(prev => new Set(prev).add(restoredTab))
      // Notify Sidebar to highlight the correct tab
      window.dispatchEvent(
        new CustomEvent('settings-tab-request', { detail: { tab: restoredTab } })
      )
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('settings-active-tab', activeTab)
  }, [activeTab])

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

  useEffect(() => {
    // Initialize display avatar and name fields on client
    setDisplayAvatar(userAvatar)
    const nameParts = (userName || '').split(' ')
    setFirstName(nameParts[0] || '')
    setLastName(nameParts.slice(1).join(' ') || '')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleAvatarUpload = async (file: File) => {
    if (!token) {
      setAvatarError('Authentication token not found. Please refresh the page.')
      return
    }

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please select an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Image must be less than 5MB')
      return
    }

    setAvatarUpdating(true)
    setAvatarError('')

    try {
      const reader = new FileReader()
      
      reader.onload = async (e) => {
        try {
          const base64Data = e.target?.result as string

          // Create an AbortController with a 30 second timeout
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 30000)

          try {
            const response = await fetch('/api/auth/profile/avatar', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ avatar: base64Data }),
              signal: controller.signal,
            })

            clearTimeout(timeoutId)

            const data = await response.json()

            if (!response.ok || !data.ok) {
              throw new Error(data?.error?.message || `Failed to update avatar (${response.status})`)
            }

            // Update localStorage and display state
            localStorage.setItem('user-avatar', data.data.user.avatar || '')
            setDisplayAvatar(data.data.user.avatar)
            
            // Notify other components of avatar change
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('avatar-updated', { detail: { avatar: data.data.user.avatar } }))
            }

            setAvatarUpdating(false)
          } catch (fetchErr) {
            clearTimeout(timeoutId)
            if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
              throw new Error('Upload timed out. Please try a smaller image or check your connection.')
            }
            throw fetchErr
          }
        } catch (err) {
          setAvatarError(err instanceof Error ? err.message : 'Failed to upload image')
          setAvatarUpdating(false)
        }
      }

      reader.onerror = () => {
        setAvatarError('Failed to read file')
        setAvatarUpdating(false)
      }

      reader.onabort = () => {
        setAvatarError('File read was cancelled')
        setAvatarUpdating(false)
      }

      reader.readAsDataURL(file)
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Failed to process file')
      setAvatarUpdating(false)
    }
  }

  const handleRemoveAvatar = async () => {
    if (!token) {
      setAvatarError('Authentication token not found. Please refresh the page.')
      return
    }

    setAvatarUpdating(true)
    setAvatarError('')

    try {
      // Create an AbortController with a 30 second timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)

      try {
        const response = await fetch('/api/auth/profile/avatar', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ avatar: null }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        const data = await response.json()

        if (!response.ok || !data.ok) {
          throw new Error(data?.error?.message || `Failed to remove avatar (${response.status})`)
        }

        // Update localStorage and display state
        localStorage.removeItem('user-avatar')
        setDisplayAvatar(null)
        
        // Notify other components of avatar change
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('avatar-updated', { detail: { avatar: null } }))
        }

        setAvatarUpdating(false)
      } catch (fetchErr) {
        clearTimeout(timeoutId)
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          throw new Error('Request timed out. Please check your connection.')
        }
        throw fetchErr
      }
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Failed to remove avatar')
      setAvatarUpdating(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) { setProfileError('Not authenticated. Please refresh.'); return }
    if (!firstName.trim()) { setProfileError('First name is required'); return }

    setProfileSaving(true)
    setProfileError('')
    setProfileSuccess(false)

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim() || null }),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to save profile')

      // Update localStorage
      const newName = data.data.user.name
      localStorage.setItem('user-name', newName)
      setProfileSuccess(true)

      // Notify layout to update displayed name
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: { name: newName } }))

      setTimeout(() => setProfileSuccess(false), 3000)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setProfileSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) { setPasswordError('Not authenticated. Please refresh.'); return }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match'); return }
    if (newPassword.length < 8) { setPasswordError('New password must be at least 8 characters'); return }

    setPasswordSaving(true)
    setPasswordError('')
    setPasswordSuccess(false)

    try {
      const response = await fetch('/api/auth/profile/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to change password')

      setPasswordSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      // Auto-close after a moment
      setTimeout(() => {
        setChangePasswordOpen(false)
        setPasswordSuccess(false)
      }, 1500)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setPasswordSaving(false)
    }
  }

  const openChangePassword = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
    setPasswordSuccess(false)
    setChangePasswordOpen(true)
  }

  const closeChangePassword = () => {
    if (passwordSaving) return
    setChangePasswordOpen(false)
    setPasswordError('')
  }

  const handleChangeImageClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleAvatarUpload(file)
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

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

  // As soon as we know the user can manage the workspace, pre-mount all
  // workspace tabs as hidden so their data fetches run in the background
  // while the user is still on the Profile tab.
  useEffect(() => {
    if (!canManageWorkspace) return
    setVisitedTabs((prev) => {
      const next = new Set(prev)
      next.add('school-info')
      next.add('roles')
      next.add('teams')
      next.add('users')
      next.add('campus')
      return next
    })
  }, [canManageWorkspace])

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
      setActiveTab('profile')
    }
  }, [activeTab, canManageWorkspace, permissionsLoaded])

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
      setBlockedTab(activeTab)
      setShowUnsavedDialog(true)
      return
    }

    setActiveTab(nextTab)
    setVisitedTabs((prev) => new Set(prev).add(nextTab))
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
      setActiveTab(pendingTab)
      setVisitedTabs((prev) => new Set(prev).add(pendingTab))
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
        setActiveTab(pendingTab)
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
      setActiveTab(pendingTab)
      setVisitedTabs((prev) => new Set(prev).add(pendingTab))
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
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
      <div>
              {activeTab === 'profile' && (
                <div className="space-y-8">

                  {/* ── My Profile ─────────────────────────────────────────── */}
                  <section>
                    <h2 className="text-2xl font-semibold text-gray-900">My Profile</h2>
                    <div className="h-px bg-gray-200 mt-4 mb-6" />

                    {/* Avatar */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                      <div className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-lg overflow-hidden flex-shrink-0">
                        {displayAvatar ? (
                          <img src={displayAvatar} alt={userName || 'User'} className="w-14 h-14 rounded-full object-cover" />
                        ) : (
                          (firstName || userName || 'U').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                          disabled={avatarUpdating}
                        />
                        <button
                          type="button"
                          onClick={handleChangeImageClick}
                          disabled={avatarUpdating}
                          className="px-4 py-2 min-h-[40px] rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {avatarUpdating ? 'Uploading...' : '+ Change Image'}
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          disabled={avatarUpdating || !displayAvatar}
                          className="px-4 py-2 min-h-[40px] rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Remove Image
                        </button>
                      </div>
                    </div>
                    {avatarError && (
                      <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{avatarError}</div>
                    )}

                    {/* Name form */}
                    <form onSubmit={handleSaveProfile} className="space-y-4">
                      {profileError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{profileError}</div>
                      )}
                      {profileSuccess && (
                        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">Profile saved successfully.</div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                          <input
                            id="firstName"
                            type="text"
                            className="ui-input"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            disabled={profileSaving}
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                          <input
                            id="lastName"
                            type="text"
                            className="ui-input"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            disabled={profileSaving}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={profileSaving}
                          className="px-4 py-2 min-h-[40px] rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {profileSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </form>
                  </section>

                  {/* ── Account Security ────────────────────────────────────── */}
                  <section>
                    <h3 className="text-2xl font-semibold text-gray-900">Account Security</h3>
                    <div className="h-px bg-gray-200 mt-4 mb-6" />
                    <div className="space-y-6">
                      <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:gap-4">
                        <div className="flex-1">
                          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                          <input id="email" type="email" className="ui-input" defaultValue={userEmail || ''} readOnly />
                        </div>
                        <button
                          type="button"
                          className="px-4 py-2 min-h-[40px] rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition whitespace-nowrap opacity-50 cursor-not-allowed"
                          disabled
                          title="Coming soon"
                        >
                          Change email
                        </button>
                      </div>

                      <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:gap-4">
                        <div className="flex-1">
                          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                          <input id="password" type="password" className="ui-input" value="••••••••••" readOnly />
                        </div>
                        <button
                          type="button"
                          onClick={openChangePassword}
                          className="px-4 py-2 min-h-[40px] rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition whitespace-nowrap"
                        >
                          Change password
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* ── Support Access ──────────────────────────────────────── */}
                  <section>
                    <h3 className="text-2xl font-semibold text-gray-900">Support Access</h3>
                    <div className="h-px bg-gray-200 mt-4 mb-6" />
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-base font-medium text-gray-900">Log out of all devices</p>
                          <p className="text-sm text-gray-600">Log out of all other active sessions on other devices besides this one.</p>
                        </div>
                        <button
                          type="button"
                          className="px-4 py-2 min-h-[40px] rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition whitespace-nowrap opacity-50 cursor-not-allowed"
                          disabled
                          title="Coming soon"
                        >
                          Log out
                        </button>
                      </div>

                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-base font-medium text-red-600">Delete my account</p>
                          <p className="text-sm text-gray-600">Permanently delete the account and remove access from all workspaces.</p>
                        </div>
                        <button
                          type="button"
                          className="px-4 py-2 min-h-[40px] rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition whitespace-nowrap opacity-50 cursor-not-allowed"
                          disabled
                          title="Coming soon"
                        >
                          Delete Account
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* ── Change Password Drawer ──────────────────────────────── */}
                  <DetailDrawer
                    isOpen={changePasswordOpen}
                    onClose={closeChangePassword}
                    title="Change Password"
                    width="md"
                  >
                    <form onSubmit={handleChangePassword} className="p-8 space-y-6">
                      {passwordError && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{passwordError}</div>
                      )}
                      {passwordSuccess && (
                        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">Password changed successfully!</div>
                      )}

                      <section className="space-y-4">
                        <div className="border-b border-gray-200 pb-3">
                          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Update Password</h3>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Current password</label>
                          <input
                            type="password"
                            className="ui-input"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            disabled={passwordSaving || passwordSuccess}
                            required
                            autoComplete="current-password"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
                          <input
                            type="password"
                            className="ui-input"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            disabled={passwordSaving || passwordSuccess}
                            required
                            minLength={8}
                            autoComplete="new-password"
                          />
                          <p className="mt-1.5 text-xs text-gray-400">Must be at least 8 characters</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm new password</label>
                          <input
                            type="password"
                            className="ui-input"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={passwordSaving || passwordSuccess}
                            required
                            autoComplete="new-password"
                          />
                        </div>
                      </section>

                      <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-4">
                        <button
                          type="button"
                          onClick={closeChangePassword}
                          disabled={passwordSaving}
                          className="px-4 py-2 min-h-[40px] border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={passwordSaving || passwordSuccess}
                          className="px-4 py-2 min-h-[40px] rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                        >
                          {passwordSaving ? 'Saving...' : 'Update Password'}
                        </button>
                      </div>
                    </form>
                  </DetailDrawer>
                </div>
              )}

              {canManageWorkspace && visitedTabs.has('roles') && (
                <div className={activeTab === 'roles' ? '' : 'hidden'} aria-hidden={activeTab !== 'roles'}>
                  <RolesTab onDirtyChange={setRolesDirty} />
                </div>
              )}

              {canManageWorkspace && visitedTabs.has('school-info') && (
                <div className={activeTab === 'school-info' ? '' : 'hidden'} aria-hidden={activeTab !== 'school-info'}>
                  <SchoolInfoTab
                    onDirtyChange={setSchoolInfoDirty}
                    onRegisterSave={(handler) => setSchoolInfoSaveHandler(() => handler)}
                    onRegisterDiscard={(handler) => setSchoolInfoDiscardHandler(() => handler)}
                  />
                </div>
              )}

              {canManageWorkspace && visitedTabs.has('teams') && (
                <div className={activeTab === 'teams' ? '' : 'hidden'} aria-hidden={activeTab !== 'teams'}>
                  <TeamsTab onDirtyChange={setTeamsDirty} />
                </div>
              )}

              {canManageWorkspace && visitedTabs.has('users') && (
                <div className={activeTab === 'users' ? '' : 'hidden'} aria-hidden={activeTab !== 'users'}>
                  <MembersTab onDirtyChange={setUsersDirty} />
                </div>
              )}

              {canManageWorkspace && visitedTabs.has('campus') && (
                <div className={activeTab === 'campus' ? '' : 'hidden'} aria-hidden={activeTab !== 'campus'}>
                  <CampusTab onDirtyChange={setCampusDirty} />
                </div>
              )}
      </div>

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
                'flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition',
            }
          : undefined}
      />
    </DashboardLayout>
  )
}
