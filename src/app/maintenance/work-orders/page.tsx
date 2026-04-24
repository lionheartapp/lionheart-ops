'use client'
// cache-bust: force webpack recompile after shared chunk fixes
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, MotionConfig } from 'framer-motion'
import { useCampusFilter } from '@/lib/hooks/useCampusFilter'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import DashboardLayout from '@/components/DashboardLayout'
import CampusFilterChip from '@/components/maintenance/CampusFilterChip'
import WorkOrdersView from '@/components/maintenance/WorkOrdersView'
import { useAuth } from '@/lib/hooks/useAuth'
import { fetchApi } from '@/lib/api-client'

function WorkOrdersContent() {
  const searchParams = useSearchParams()

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
        // Silently fail
      })
    return () => {
      cancelled = true
    }
  }, [orgLogoUrl, isReady])

  const campusFilter = useCampusFilter()

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
        <div>
            {/* Page header */}
            <motion.div
              className="mb-6"
              initial="hidden"
              animate="visible"
              variants={staggerContainer(0.08, 0.05)}
            >
              <motion.div variants={fadeInUp} className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-semibold text-slate-900">
                  Work Orders
                </h1>
                <CampusFilterChip campusFilter={campusFilter} />
              </motion.div>
              <motion.p variants={fadeInUp} className="text-sm text-slate-500 mt-1">
                {campusFilter.selectedCampusName === 'All Campuses'
                  ? 'Manage and track maintenance work orders'
                  : campusFilter.selectedCampusName}
              </motion.p>
            </motion.div>

            {/* Work Orders content */}
            <WorkOrdersView
              schoolIdFilter={campusFilter.selectedCampusId}
              initialStatus={searchParams.get('status') || undefined}
              initialPriority={searchParams.get('priority') || undefined}
              initialUnassigned={searchParams.get('unassigned') === 'true'}
              initialSchoolId={searchParams.get('schoolId') || undefined}
            />
        </div>
      </MotionConfig>
    </DashboardLayout>
  )
}

export default function WorkOrdersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    }>
      <WorkOrdersContent />
    </Suspense>
  )
}
