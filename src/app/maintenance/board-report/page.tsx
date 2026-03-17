'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { MotionConfig } from 'framer-motion'
import DashboardLayout from '@/components/DashboardLayout'
import { BoardReportPage } from '@/components/maintenance/board-report/BoardReportPage'

// ─── Page Content ─────────────────────────────────────────────────────────────

function BoardReportContent() {
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
    if (!token || !orgId) {
      router.push('/login')
    }
  }, [token, orgId, router])

  useEffect(() => {
    if (orgLogoUrl || !token) return
    fetch('/api/onboarding/school-info', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.data?.logoUrl) {
          setOrgLogoUrl(data.data.logoUrl)
          localStorage.setItem('org-logo-url', data.data.logoUrl)
        }
      })
      .catch(() => {})
  }, [orgLogoUrl, token])

  const handleLogout = () => {
    ;[
      'auth-token', 'org-id', 'user-name', 'user-email', 'user-avatar',
      'user-team', 'user-school-scope', 'user-role', 'org-name', 'org-school-type', 'org-logo-url',
    ].forEach((k) => localStorage.removeItem(k))
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
      <MotionConfig reducedMotion="user">
        <BoardReportPage token={token} />
      </MotionConfig>
    </DashboardLayout>
  )
}

export default function BoardReportPageRoute() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <BoardReportContent />
    </Suspense>
  )
}
