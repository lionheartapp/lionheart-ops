'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { motion, MotionConfig } from 'framer-motion'
import DashboardLayout from '@/components/DashboardLayout'
import AnalyticsDashboard from '@/components/maintenance/AnalyticsDashboard'
import { fadeInUp, staggerContainer } from '@/lib/animations'

function AnalyticsContent() {
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

  // Fetch org logo if not cached
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

  const handleLogout = () => {
    ;[
      'auth-token', 'org-id', 'user-name', 'user-email', 'user-avatar',
      'user-team', 'user-school-scope', 'user-role', 'org-name',
      'org-school-type', 'org-logo-url',
    ].forEach((key) => localStorage.removeItem(key))
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
        <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer(0.08, 0.05)}
          >
            <motion.div variants={fadeInUp} className="mb-6">
              <h1 className="text-2xl font-semibold text-gray-900">Maintenance Analytics</h1>
              <p className="text-sm text-gray-500">
                Operational metrics — ticket volume, resolution time, technician workload, and more
              </p>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <AnalyticsDashboard />
            </motion.div>
        </motion.div>
      </MotionConfig>
    </DashboardLayout>
  )
}

export default function MaintenanceAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-gray-600">Loading...</div>
        </div>
      }
    >
      <AnalyticsContent />
    </Suspense>
  )
}
