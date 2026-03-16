'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, MotionConfig, AnimatePresence } from 'framer-motion'
import { usePermissions, isOnTeam } from '@/lib/hooks/usePermissions'
import { useCampusFilter } from '@/lib/hooks/useCampusFilter'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import DashboardLayout from '@/components/DashboardLayout'
import ModuleGate from '@/components/ModuleGate'
import CampusFilterChip from '@/components/maintenance/CampusFilterChip'
import MaintenanceSkeleton from '@/components/maintenance/MaintenanceSkeleton'
import MaintenanceDashboard from '@/components/maintenance/MaintenanceDashboard'
import MyRequestsView from '@/components/maintenance/MyRequestsView'
import PmCalendarView from '@/components/maintenance/PmCalendarView'
import PmScheduleList from '@/components/maintenance/PmScheduleList'
import PmScheduleWizard from '@/components/maintenance/PmScheduleWizard'
import { LayoutDashboard, CalendarClock, FileBarChart, Plus, CalendarDays, LayoutList, X } from 'lucide-react'
import Link from 'next/link'
import type { MaintenanceTab } from '@/components/Sidebar'
import { cacheAssignedTickets } from '@/lib/offline/sync'
import { useAnimatedTabIndicator } from '@/lib/hooks/useAnimatedTabIndicator'
import TabIndicator from '@/components/ui/TabIndicator'
import { useQueryClient } from '@tanstack/react-query'

const SUB_TABS: {
  key: MaintenanceTab
  label: string
  icon: typeof LayoutDashboard
}[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'pm-calendar', label: 'PM Calendar', icon: CalendarClock },
]

/**
 * Inner content component — uses useSearchParams, must be inside a Suspense boundary.
 */
function MaintenanceContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

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

  // Hydration guard + auth redirect
  useEffect(() => {
    setIsClient(true)
    if (!token || !orgId) {
      router.push('/login')
    }
  }, [token, orgId, router])

  // Cache assigned tickets for offline access on mount (when online)
  useEffect(() => {
    if (!token || !orgId || typeof navigator === 'undefined' || !navigator.onLine) return
    const userId = typeof window !== 'undefined' ? localStorage.getItem('user-id') ?? '' : ''
    cacheAssignedTickets(token, orgId, userId).catch(() => {
      // Non-fatal — silently ignore cache failures
    })
  }, [token, orgId])

  // Fetch org logo from API if not in localStorage
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

  const { data: perms } = usePermissions()
  const canManageMaintenance = perms?.canManageMaintenance ?? false
  const canClaimMaintenance = perms?.canClaimMaintenance ?? false
  const isOnMaintenanceTeam = isOnTeam(perms, 'maintenance')
  // Show full dashboard + tabs for team members, admins, and technicians; My Requests only for submit-only users
  const showDashboardTabs = isOnMaintenanceTeam || canManageMaintenance || canClaimMaintenance
  const campusFilter = useCampusFilter()
  const dataLoading = false // Campus filter loading handled inline; don't gate entire page
  const queryClient = useQueryClient()

  // Determine default tab based on URL param then permissions
  const getDefaultTab = (): MaintenanceTab => {
    const paramTab = searchParams?.get('tab') as MaintenanceTab | null
    if (paramTab && ['dashboard', 'pm-calendar'].includes(paramTab)) {
      return paramTab
    }
    return 'dashboard'
  }

  const [activeTab, setActiveTab] = useState<MaintenanceTab>('dashboard')

  // Set default tab once permissions load
  useEffect(() => {
    if (perms) {
      setActiveTab(getDefaultTab())
    }
  }, [perms]) // eslint-disable-line react-hooks/exhaustive-deps

  // PM Calendar state
  const [pmViewMode, setPmViewMode] = useState<'calendar' | 'list'>('calendar')
  const [showPmWizard, setShowPmWizard] = useState(false)
  const [pmSuccessMessage, setPmSuccessMessage] = useState('')

  const handlePmWizardComplete = () => {
    setShowPmWizard(false)
    setPmSuccessMessage('PM schedule created successfully')
    setTimeout(() => setPmSuccessMessage(''), 4000)
    queryClient.invalidateQueries({ queryKey: ['pm-calendar-events'] })
    queryClient.invalidateQueries({ queryKey: ['pm-schedules-list'] })
  }

  const { containerRef: tabContainerRef, setTabRef, indicatorStyle } = useAnimatedTabIndicator(activeTab, [showDashboardTabs])

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

  // Loading screen during hydration
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
          <div className="flex-1 min-h-0 overflow-y-auto">
            {/* Page header */}
            <motion.div
              className="mb-6"
              initial="hidden"
              animate="visible"
              variants={staggerContainer(0.08, 0.05)}
            >
              <motion.div variants={fadeInUp} className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-semibold text-slate-900">
                  Maintenance
                </h1>
                <CampusFilterChip campusFilter={campusFilter} />
                {canManageMaintenance && (
                  <Link
                    href="/maintenance/board-report"
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors duration-200 cursor-pointer"
                  >
                    <FileBarChart className="w-4 h-4" />
                    Board Report
                  </Link>
                )}
              </motion.div>
              <motion.p variants={fadeInUp} className="text-sm text-slate-500 mt-1">
                {campusFilter.selectedCampusName === 'All Campuses'
                  ? 'Work orders, assets, and facility operations'
                  : campusFilter.selectedCampusName}
              </motion.p>
            </motion.div>

            {/* Sub-navigation tabs — for admins and technicians */}
            {showDashboardTabs ? (
              <>
                <div ref={tabContainerRef} className="relative flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
                  {SUB_TABS.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      ref={(el) => setTabRef(key, el)}
                      onClick={() => setActiveTab(key)}
                      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        activeTab === key
                          ? 'text-slate-900'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                  <TabIndicator style={indicatorStyle} />
                </div>

                {/* Tab content */}
                {dataLoading ? (
                  <MaintenanceSkeleton />
                ) : (
                  <>
                    <div
                      className={activeTab === 'dashboard' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
                      aria-hidden={activeTab !== 'dashboard'}
                    >
                      <MaintenanceDashboard activeCampusId={campusFilter.selectedCampusId || null} />
                    </div>

                    <div
                      className={activeTab === 'pm-calendar' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
                      aria-hidden={activeTab !== 'pm-calendar'}
                    >
                      {/* PM Calendar section card */}
                      <section className="ui-glass p-6">
                        {/* Gradient icon-tile header */}
                        <div className="flex items-center justify-between mb-5">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                              <CalendarClock className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h3 className="text-base font-semibold text-slate-900">PM Calendar</h3>
                              <p className="text-xs text-slate-500">Preventive maintenance schedules and upcoming tasks</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* View toggle */}
                            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                              <button
                                onClick={() => setPmViewMode('calendar')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                                  pmViewMode === 'calendar'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                              >
                                <CalendarDays className="w-4 h-4" />
                                Calendar
                              </button>
                              <button
                                onClick={() => setPmViewMode('list')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                                  pmViewMode === 'list'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                              >
                                <LayoutList className="w-4 h-4" />
                                List
                              </button>
                            </div>
                            <button
                              onClick={() => setShowPmWizard(true)}
                              className="ui-btn-md ui-btn-primary"
                            >
                              <Plus className="w-4 h-4" />
                              Create PM Schedule
                            </button>
                          </div>
                        </div>

                        {/* Success toast */}
                        {pmSuccessMessage && (
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="mb-4 px-4 py-3 bg-primary-50 border border-primary-200 rounded-xl text-sm text-primary-700 font-medium"
                          >
                            {pmSuccessMessage}
                          </motion.div>
                        )}

                        {/* Wizard */}
                        <AnimatePresence>
                          {showPmWizard && (
                            <motion.div
                              initial={{ opacity: 0, y: -12 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -12 }}
                              transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                              className="mb-6"
                            >
                              <div className="flex items-center justify-between mb-3 px-1">
                                <h2 className="text-sm font-semibold text-slate-700">New PM Schedule</h2>
                                <button
                                  onClick={() => setShowPmWizard(false)}
                                  className="p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                  <X className="w-4 h-4 text-slate-500" />
                                </button>
                              </div>
                              <PmScheduleWizard
                                onComplete={handlePmWizardComplete}
                                onCancel={() => setShowPmWizard(false)}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Calendar / List view */}
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={pmViewMode}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                          >
                            {pmViewMode === 'calendar' ? (
                              <PmCalendarView />
                            ) : (
                              <PmScheduleList />
                            )}
                          </motion.div>
                        </AnimatePresence>
                      </section>
                    </div>
                  </>
                )}
              </>
            ) : (
              /* Submit-only users see My Requests (to track tickets they've submitted) */
              dataLoading ? (
                <MaintenanceSkeleton />
              ) : (
                <MyRequestsView />
              )
            )}
          </div>
        </MotionConfig>
      </ModuleGate>
    </DashboardLayout>
  )
}

/**
 * Page wrapper — wraps MaintenanceContent in Suspense to satisfy
 * Next.js requirement for useSearchParams() at static generation time.
 */
export default function MaintenancePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    }>
      <MaintenanceContent />
    </Suspense>
  )
}
