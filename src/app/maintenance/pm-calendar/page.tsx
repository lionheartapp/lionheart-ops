'use client'

import { useState, useEffect, Suspense } from 'react'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { Plus, CalendarDays, LayoutList } from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import DetailDrawer from '@/components/DetailDrawer'
import PmCalendarView from '@/components/maintenance/PmCalendarView'
import PmScheduleList from '@/components/maintenance/PmScheduleList'
import PmScheduleWizard from '@/components/maintenance/PmScheduleWizard'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/hooks/useAuth'
import { fetchApi } from '@/lib/api-client'

type ViewMode = 'calendar' | 'list'

function PmCalendarContent() {
  const queryClient = useQueryClient()

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

  const handleLogout = () => {
    logout()
  }

  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const [showWizard, setShowWizard] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const handleWizardComplete = () => {
    setShowWizard(false)
    setSuccessMessage('PM schedule created successfully')
    setTimeout(() => setSuccessMessage(''), 4000)
    // Invalidate calendar and list queries
    queryClient.invalidateQueries({ queryKey: ['pm-calendar-events'] })
    queryClient.invalidateQueries({ queryKey: ['pm-schedules-list'] })
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
              className="flex items-start justify-between mb-6"
              initial="hidden"
              animate="visible"
              variants={staggerContainer(0.08, 0.05)}
            >
              <div>
                <motion.h1 variants={fadeInUp} className="text-2xl font-semibold text-slate-900">
                  PM Calendar
                </motion.h1>
                <motion.p variants={fadeInUp} className="text-sm text-slate-500">
                  Preventive maintenance schedules and upcoming tasks
                </motion.p>
              </div>

              <motion.div variants={fadeInUp} className="flex items-center gap-2">
                {/* View toggle */}
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1" role="tablist" aria-label="View mode">
                  <button
                    role="tab"
                    aria-selected={viewMode === 'calendar'}
                    onClick={() => setViewMode('calendar')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                      viewMode === 'calendar'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <CalendarDays className="w-4 h-4" />
                    Calendar
                  </button>
                  <button
                    role="tab"
                    aria-selected={viewMode === 'list'}
                    onClick={() => setViewMode('list')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                      viewMode === 'list'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <LayoutList className="w-4 h-4" />
                    List
                  </button>
                </div>

                <button
                  onClick={() => setShowWizard(true)}
                  className="ui-btn-md ui-btn-primary"
                >
                  <Plus className="w-4 h-4" />
                  Create PM Schedule
                </button>
              </motion.div>
            </motion.div>

            {/* Success toast */}
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-4 px-4 py-3 bg-primary-50 border border-primary-200 rounded-xl text-sm text-primary-700 font-medium"
              >
                {successMessage}
              </motion.div>
            )}

            {/* Create PM Schedule Drawer */}
            <DetailDrawer
              isOpen={showWizard}
              onClose={() => setShowWizard(false)}
              title="Create PM Schedule"
              width="lg"
            >
              <PmScheduleWizard
                onComplete={handleWizardComplete}
                onCancel={() => setShowWizard(false)}
              />
            </DetailDrawer>

            {/* Calendar / List view with tab animation */}
            <AnimatePresence mode="wait">
              <motion.div
                key={viewMode}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              >
                {viewMode === 'calendar' ? (
                  <PmCalendarView />
                ) : (
                  <PmScheduleList />
                )}
              </motion.div>
            </AnimatePresence>
        </div>
      </MotionConfig>
    </DashboardLayout>
  )
}

export default function PmCalendarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    }>
      <PmCalendarContent />
    </Suspense>
  )
}
