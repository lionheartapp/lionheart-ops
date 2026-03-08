'use client'

import { useState, useEffect, type ReactNode, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { MotionConfig } from 'framer-motion'
import DashboardLayout from '@/components/DashboardLayout'
import ModuleGate from '@/components/ModuleGate'
import { useITPermissions } from '@/lib/hooks/useITPermissions'
import { ShieldAlert } from 'lucide-react'

function ITPageShellInner({ children }: { children: ReactNode }) {
  const router = useRouter()

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  const orgId = typeof window !== 'undefined' ? localStorage.getItem('org-id') : null
  const userName = typeof window !== 'undefined' ? localStorage.getItem('user-name') : null
  const userEmail = typeof window !== 'undefined' ? localStorage.getItem('user-email') : null
  const userAvatar = typeof window !== 'undefined' ? localStorage.getItem('user-avatar') : null
  const userRole = typeof window !== 'undefined' ? localStorage.getItem('user-role') : null
  const orgName = typeof window !== 'undefined' ? localStorage.getItem('org-name') : null
  const orgSchoolType = typeof window !== 'undefined' ? localStorage.getItem('org-school-type') : null
  const userSchoolScope = typeof window !== 'undefined' ? localStorage.getItem('user-school-scope') : null
  const userTeam = typeof window !== 'undefined' ? localStorage.getItem('user-team') : null
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('org-logo-url') : null
  )
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    if (!token || !orgId) router.push('/login')
  }, [token, orgId, router])

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

  const { loaded, canManage, canSubmit } = useITPermissions()

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

  if (loaded && !canManage && !canSubmit) {
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
        <div className="max-w-md mx-auto mt-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Access Required</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            You don&apos;t have permission to access the IT Help Desk. Ask your administrator to
            update your role in <span className="font-medium text-gray-700">Settings &gt; Members</span>.
          </p>
        </div>
      </DashboardLayout>
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
      <ModuleGate moduleId="it-helpdesk">
        <MotionConfig reducedMotion="user">
          {children}
        </MotionConfig>
      </ModuleGate>
    </DashboardLayout>
  )
}

export default function ITPageShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <ITPageShellInner>{children}</ITPageShellInner>
    </Suspense>
  )
}
