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

  const tabs = [
    { id: 'profile' as Tab, label: 'Profile', icon: User },
    { id: 'roles' as Tab, label: 'Roles', icon: Shield },
    { id: 'teams' as Tab, label: 'Teams', icon: Users },
    { id: 'users' as Tab, label: 'Users', icon: UserCog },
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
      <div className="space-y-6 pb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-600 mt-1">Manage your account and organization</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="bg-gray-50 border-b border-gray-200 lg:border-b-0 lg:border-r border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">General Settings</p>
              </div>
              <nav className="p-3 space-y-1" aria-label="Settings sections">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  const isActive = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  )
                })}
              </nav>
            </aside>

            <section className="p-4 sm:p-6 lg:p-8 bg-white">
              {activeTab === 'profile' && (
                <div className="rounded-lg border border-gray-200 divide-y divide-gray-200 overflow-hidden">
                  <div className="p-6 bg-white">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile</h2>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                          Name
                        </label>
                        <input
                          id="name"
                          type="text"
                          className="ui-input"
                          placeholder="Your name"
                        />
                      </div>
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                          Email
                        </label>
                        <input
                          id="email"
                          type="email"
                          className="ui-input"
                          placeholder="your.email@school.edu"
                        />
                      </div>
                      <button
                        className="px-6 py-3 min-h-[44px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition font-medium"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>

                  <div className="p-6 bg-white">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Change Password</h2>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-2">
                          Current Password
                        </label>
                        <input
                          id="current-password"
                          type="password"
                          className="ui-input"
                        />
                      </div>
                      <div>
                        <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-2">
                          New Password
                        </label>
                        <input
                          id="new-password"
                          type="password"
                          className="ui-input"
                        />
                      </div>
                      <div>
                        <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                          Confirm New Password
                        </label>
                        <input
                          id="confirm-password"
                          type="password"
                          className="ui-input"
                        />
                      </div>
                      <button
                        className="px-6 py-3 min-h-[44px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition font-medium"
                      >
                        Update Password
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'roles' && <RolesTab />}

              {activeTab === 'teams' && <TeamsTab />}

              {activeTab === 'users' && <MembersTab />}

              {activeTab === 'campus' && <CampusTab />}
            </section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
