'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import RolesTab from '@/components/settings/RolesTab'
import TeamsTab from '@/components/settings/TeamsTab'
import MembersTab from '@/components/settings/MembersTab'
import { User, Shield, Users, UserCog } from 'lucide-react'

type Tab = 'profile' | 'roles' | 'teams' | 'users'

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
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-600 mt-1">Manage your account and organization</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 overflow-x-auto" aria-label="Settings tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition
                    ${
                      isActive
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="pb-8">
          {activeTab === 'profile' && (
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
              {/* Profile Section */}
              <div className="p-6">
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

              {/* Password Section */}
              <div className="p-6">
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
        </div>
      </div>
    </DashboardLayout>
  )
}
