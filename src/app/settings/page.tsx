'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import RolesTab from '@/components/settings/RolesTab'
import TeamsTab from '@/components/settings/TeamsTab'
import MembersTab from '@/components/settings/MembersTab'
import CampusTab from '@/components/settings/CampusTab'
import SchoolInfoTab from '@/components/settings/SchoolInfoTab'
import { User, Shield, Users, UserCog, Building2, School } from 'lucide-react'

type Tab = 'profile' | 'school-info' | 'roles' | 'teams' | 'users' | 'campus'

export default function SettingsPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isClient, setIsClient] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [canManageWorkspace, setCanManageWorkspace] = useState(false)
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)
  const [avatarUpdating, setAvatarUpdating] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [displayAvatar, setDisplayAvatar] = useState<string | null>(null)
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
  const orgLogoUrl = typeof window !== 'undefined' ? localStorage.getItem('org-logo-url') : null

  // Optimistic check: show workspace settings immediately for admins
  const optimisticCanManageWorkspace = userRole
    ? (userRole.toLowerCase().includes('admin') || userRole.toLowerCase().includes('super'))
    : false

  useEffect(() => {
    // Initialize display avatar on client
    setDisplayAvatar(userAvatar)
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

  const generalTabs = [
    { id: 'profile' as Tab, label: 'Account', icon: User },
  ]

  const workspaceTabs = [
    { id: 'school-info' as Tab, label: 'School Information', icon: School },
    { id: 'roles' as Tab, label: 'Roles', icon: Shield },
    { id: 'teams' as Tab, label: 'Teams', icon: Users },
    { id: 'users' as Tab, label: 'Members', icon: UserCog },
    { id: 'campus' as Tab, label: 'Campus', icon: Building2 },
  ]

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
      <div className="pb-8">
        <div className="px-2 sm:px-4 lg:px-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">Account Settings</h1>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] lg:min-h-[calc(100vh-180px)]">
            <aside className="bg-gray-50 border-b border-gray-200 lg:border-b-0 lg:border-r border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <p className="text-[10px] font-semibold tracking-wide text-gray-500 uppercase">General Settings</p>
                <nav className="mt-2 space-y-1" aria-label="General settings sections">
                  {generalTabs.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-600 hover:bg-blue-50 hover:text-gray-900'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {tab.label}
                      </button>
                    )
                  })}
                </nav>
              </div>

              {canManageWorkspace && (
                <div className="p-4">
                  <p className="text-[10px] font-semibold tracking-wide text-gray-500 uppercase">Workspace Settings</p>
                  <nav className="mt-2 space-y-1" aria-label="Workspace settings sections">
                    {workspaceTabs.map((tab) => {
                      const Icon = tab.icon
                      const isActive = activeTab === tab.id
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                            isActive
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-600 hover:bg-blue-50 hover:text-gray-900'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {tab.label}
                        </button>
                      )
                    })}
                  </nav>
                </div>
              )}
            </aside>

            <section className="p-5 sm:p-7 lg:p-8">
              {activeTab === 'profile' && (
                <div className="space-y-8">
                  <section>
                    <h2 className="text-3xl font-semibold text-gray-900">My Profile</h2>
                    <div className="h-px bg-gray-200 mt-4 mb-6" />
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                      <div className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-lg overflow-hidden">
                        {displayAvatar ? (
                          <img src={displayAvatar} alt={userName || 'User'} className="w-14 h-14 rounded-full object-cover" />
                        ) : (
                          (userName || 'U').charAt(0).toUpperCase()
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
                      {avatarError && (
                        <div className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          {avatarError}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                        <input id="name" type="text" className="ui-input" defaultValue={(userName || '').split(' ')[0] || ''} />
                      </div>
                      <div>
                        <label htmlFor="last-name" className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                        <input id="last-name" type="text" className="ui-input" defaultValue={(userName || '').split(' ').slice(1).join(' ')} />
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-3xl font-semibold text-gray-900">Account Security</h3>
                    <div className="h-px bg-gray-200 mt-4 mb-6" />
                    <div className="space-y-6">
                      <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:gap-4">
                        <div className="flex-1">
                          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                          <input id="email" type="email" className="ui-input" defaultValue={userEmail || ''} />
                        </div>
                        <button className="px-4 py-2 min-h-[40px] rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition whitespace-nowrap">
                          Change email
                        </button>
                      </div>

                      <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:gap-4">
                        <div className="flex-1">
                          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                          <input id="password" type="password" className="ui-input" value="**********" readOnly />
                        </div>
                        <button className="px-4 py-2 min-h-[40px] rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition whitespace-nowrap">
                          Change password
                        </button>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-3xl font-semibold text-gray-900">Support Access</h3>
                    <div className="h-px bg-gray-200 mt-4 mb-6" />
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-base font-medium text-gray-900">Log out of all devices</p>
                          <p className="text-sm text-gray-600">Log out of all other active sessions on other devices besides this one.</p>
                        </div>
                        <button className="px-4 py-2 min-h-[40px] rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition whitespace-nowrap">
                          Log out
                        </button>
                      </div>

                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-base font-medium text-red-600">Delete my account</p>
                          <p className="text-sm text-gray-600">Permanently delete the account and remove access from all workspaces.</p>
                        </div>
                        <button className="px-4 py-2 min-h-[40px] rounded-lg bg-gray-100 text-gray-900 text-sm font-medium hover:bg-gray-200 transition whitespace-nowrap">
                          Delete Account
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {canManageWorkspace && activeTab === 'roles' && <RolesTab />}

              {canManageWorkspace && activeTab === 'school-info' && <SchoolInfoTab />}

              {canManageWorkspace && activeTab === 'teams' && <TeamsTab />}

              {canManageWorkspace && activeTab === 'users' && <MembersTab />}

              {canManageWorkspace && activeTab === 'campus' && <CampusTab />}
            </section>
        </div>
      </div>
    </DashboardLayout>
  )
}
