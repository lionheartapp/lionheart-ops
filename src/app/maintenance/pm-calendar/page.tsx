'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { Plus, CalendarDays, LayoutList, X } from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import ModuleGate from '@/components/ModuleGate'
import PmCalendarView from '@/components/maintenance/PmCalendarView'
import PmScheduleList from '@/components/maintenance/PmScheduleList'
import PmScheduleWizard from '@/components/maintenance/PmScheduleWizard'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { useQueryClient } from '@tanstack/react-query'

type ViewMode = 'calendar' | 'list'

function PmCalendarContent() {
  const router = useRouter()
  const queryClient = useQueryClient()

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
        // Silently fail
      }
    }
    fetchLogo()
  }, [orgLogoUrl, token])

  const handleLogout = () => {
    localStorage.clear()
    router.push('/login')
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

  if (!isClient || !token || !orgId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
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
      <ModuleGate moduleId="maintenance">
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

            {/* Wizard (inline, shown above content) */}
            <AnimatePresence>
              {showWizard && (
                <motion.div
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                  className="mb-6"
                >
                  {/* Wizard header with close */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h2 className="text-sm font-semibold text-slate-700">New PM Schedule</h2>
                    <button
                      onClick={() => setShowWizard(false)}
                      className="p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                  <PmScheduleWizard
                    onComplete={handleWizardComplete}
                    onCancel={() => setShowWizard(false)}
                  />
                </motion.div>
              )}
            </AnimatePresence>

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
      </ModuleGate>
    </DashboardLayout>
  )
}

export default function PmCalendarPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    }>
      <PmCalendarContent />
    </Suspense>
  )
}
