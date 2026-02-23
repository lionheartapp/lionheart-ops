'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import RolesTab from '@/components/settings/RolesTab'
import TeamsTab from '@/components/settings/TeamsTab'
import MembersTab from '@/components/settings/MembersTab'
import CampusTab from '@/components/settings/CampusTab'
import { User, Shield, Users, UserCog, Building2 } from 'lucide-react'

type Tab = 'profile' | 'roles' | 'teams' | 'users' | 'campus'

export default function SettingsPage() {
  const router = useRouter()
  const [isClient, setIsClient] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('profile')
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

  useEffect(() => {
    setIsClient(true)
    if (!token || !orgId) {
      router.push('/login')
    }
  }, [token, orgId, router])

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
                            ? 'bg-gray-200 text-gray-900'
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
                            ? 'bg-gray-200 text-gray-900'
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
            </aside>

            <section className="p-5 sm:p-7 lg:p-8">
              {activeTab === 'profile' && (
                <div className="space-y-8">
                  <section>
                    <h2 className="text-3xl font-semibold text-gray-900">My Profile</h2>
                    <div className="h-px bg-gray-200 mt-4 mb-6" />
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                      <div className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-lg overflow-hidden">
                        {userAvatar ? (
                          <img src={userAvatar} alt={userName || 'User'} className="w-14 h-14 rounded-full object-cover" />
                        ) : (
                          (userName || 'U').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button className="px-4 py-2 min-h-[40px] rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition">
                          + Change Image
                        </button>
                        <button className="px-4 py-2 min-h-[40px] rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition">
                          Remove Image
                        </button>
                      </div>
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

              {activeTab === 'roles' && <RolesTab />}

              {activeTab === 'teams' && <TeamsTab />}

              {activeTab === 'users' && <MembersTab />}

              {activeTab === 'campus' && <CampusTab />}
            </section>
        </div>
      </div>
    </DashboardLayout>
  )
}
