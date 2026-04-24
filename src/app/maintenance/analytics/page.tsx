'use client'

import { useState, useEffect, Suspense } from 'react'
import { motion, MotionConfig } from 'framer-motion'
import DashboardLayout from '@/components/DashboardLayout'
import AnalyticsDashboard from '@/components/maintenance/AnalyticsDashboard'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { useAuth } from '@/lib/hooks/useAuth'
import { fetchApi } from '@/lib/api-client'

function AnalyticsContent() {
  // Cookie-based auth via useAuth — no more localStorage JWT reads
  const { user, org, orgId, isReady, logout } = useAuth({ redirectTo: '/login' })
  const userName = user.name
  const userEmail = user.email
  const userAvatar = user.avatar
  const userRole = user.role
  const orgName = org.name
  const orgSchoolType = org.schoolType
  const userSchoolScope = user.campusScope ?? user.schoolScope
  const userTeam = user.team
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(org.logoUrl)
  const isClient = isReady

  // Keep the local logo copy in sync when useAuth refreshes it
  useEffect(() => {
    if (org.logoUrl && org.logoUrl !== orgLogoUrl) {
      setOrgLogoUrl(org.logoUrl)
    }
  }, [org.logoUrl, orgLogoUrl])

  // Fetch org logo via fetchApi (cookie-auth + CSRF) if not already present
  useEffect(() => {
    if (orgLogoUrl || !isReady) return
    let cancelled = false
    fetchApi<{ logoUrl?: string | null }>('/api/onboarding/school-info')
      .then((data) => {
        if (cancelled) return
        if (data?.logoUrl) {
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

  const handleLogout = () => {
    logout()
  }

  if (!isClient || !orgId) {
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
        <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer(0.08, 0.05)}
          >
            <motion.div variants={fadeInUp} className="mb-6">
              <h1 className="text-2xl font-semibold text-slate-900">Maintenance Analytics</h1>
              <p className="text-sm text-slate-500">
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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
        </div>
      }
    >
      <AnalyticsContent />
    </Suspense>
  )
}
