'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, MotionConfig, AnimatePresence } from 'framer-motion'
import { usePermissions, isOnTeam } from '@/lib/hooks/usePermissions'
import { useActiveSchool } from '@/lib/hooks/useActiveSchool'
import { fadeInUp, staggerContainer } from '@/lib/animations'

import MaintenanceDashboard from '@/components/maintenance/MaintenanceDashboard'
import dynamic from 'next/dynamic'

import {
  LayoutDashboard, CalendarClock, FileBarChart, Plus, CalendarDays, LayoutList, X, Route, FileText,
  Zap, Droplets, Wind, Hammer, SprayCan, Trees, HelpCircle, ChevronLeft, Pencil, Settings,
} from 'lucide-react'
import Link from 'next/link'
import type { MaintenanceTab } from '@/components/Sidebar'
import { cacheAssignedTickets } from '@/lib/offline/sync'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useAuth } from '@/lib/hooks/useAuth'
import { useAnimatedTabIndicator } from '@/lib/hooks/useAnimatedTabIndicator'

import TabIndicator from '@/components/ui/TabIndicator'
import PagePadding from '@/components/PagePadding'
import { useQueryClient } from '@tanstack/react-query'
import { useTrackModuleVisit } from '@/components/onboarding/ChecklistWidget'

function LazyPanel() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 animate-pulse">
      <div className="h-4 w-40 rounded bg-slate-200" />
      <div className="mt-4 h-24 rounded bg-slate-100" />
    </div>
  )
}

const MyRequestsView = dynamic(() => import('@/components/maintenance/MyRequestsView'), {
  loading: () => <LazyPanel />,
})
const PmCalendarView = dynamic(() => import('@/components/maintenance/PmCalendarView'), {
  loading: () => <LazyPanel />,
})
const PmScheduleList = dynamic(() => import('@/components/maintenance/PmScheduleList'), {
  loading: () => <LazyPanel />,
})
const PmScheduleWizard = dynamic(() => import('@/components/maintenance/PmScheduleWizard'), {
  ssr: false,
  loading: () => <LazyPanel />,
})
const TicketRoutingTab = dynamic(() => import('@/components/settings/TicketRoutingTab'), {
  loading: () => <LazyPanel />,
})
const CategoryFormEditor = dynamic(() => import('@/components/settings/CategoryFormEditor'), {
  ssr: false,
  loading: () => <LazyPanel />,
})

const MAIN_TABS: {
  key: MaintenanceTab
  label: string
  icon: typeof LayoutDashboard
}[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'pm-calendar', label: 'PM Calendar', icon: CalendarClock },
]

const CONFIG_TABS: {
  key: MaintenanceTab
  label: string
  icon: typeof Route
}[] = [
  { key: 'routing', label: 'Routing', icon: Route },
  { key: 'forms', label: 'Forms', icon: FileText },
]

const MAINTENANCE_CATEGORY_KEYS = [
  { key: 'ELECTRICAL', label: 'Electrical', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
  { key: 'PLUMBING', label: 'Plumbing', icon: Droplets, color: 'text-blue-600', bg: 'bg-blue-50' },
  { key: 'HVAC', label: 'HVAC', icon: Wind, color: 'text-teal-600', bg: 'bg-teal-50' },
  { key: 'STRUCTURAL', label: 'Structural', icon: Hammer, color: 'text-orange-600', bg: 'bg-orange-50' },
  { key: 'CUSTODIAL_BIOHAZARD', label: 'Custodial / Biohazard', icon: SprayCan, color: 'text-purple-600', bg: 'bg-purple-50' },
  { key: 'GROUNDS', label: 'Grounds', icon: Trees, color: 'text-green-600', bg: 'bg-green-50' },
  { key: 'OTHER', label: 'Other', icon: HelpCircle, color: 'text-slate-600', bg: 'bg-slate-50' },
]

/**
 * Inner content component — uses useSearchParams, must be inside a Suspense boundary.
 */
function MaintenanceContent() {
  usePageTitle('Maintenance')
  useTrackModuleVisit('maintenance')
  const router = useRouter()
  const searchParams = useSearchParams()

  // Audit ref C1/H4: cookie-based auth via useAuth — no more localStorage
  // JWT reads or Bearer header construction.
  const { user, org, orgId, isReady } = useAuth({ redirectTo: '/login' })
  const isClient = isReady

  // Cache assigned tickets for offline access on mount (when online)
  useEffect(() => {
    if (!isReady || !orgId || typeof navigator === 'undefined' || !navigator.onLine) return
    const userId = user.id ?? ''
    const timeout = window.setTimeout(() => {
      cacheAssignedTickets('cookie-auth', orgId, userId).catch(() => {
        // Non-fatal — silently ignore cache failures
      })
    }, 10_000)
    return () => window.clearTimeout(timeout)
  }, [isReady, orgId, user.id])

  const { data: perms, isLoading: permsLoading } = usePermissions()
  const canManageMaintenance = perms?.canManageMaintenance ?? false
  const canClaimMaintenance = perms?.canClaimMaintenance ?? false
  const isOnMaintenanceTeam = isOnTeam(perms, 'maintenance')
  // Show full dashboard + tabs for team members, admins, and technicians; My Requests only for submit-only users
  const showDashboardTabs = isOnMaintenanceTeam || canManageMaintenance || canClaimMaintenance
  // Active school is sourced from the global sidebar selector. When the
  // user's stored selection isn't a maintenance-enabled school, the hook
  // returns null here (treated as "All maintenance-enabled schools").
  const { activeSchoolId, activeSchoolLabel } = useActiveSchool({ restrictToModule: 'maintenance' })
  const queryClient = useQueryClient()

  // Determine default tab based on URL param then permissions
  const getDefaultTab = (): MaintenanceTab => {
    const paramTab = searchParams?.get('tab') as MaintenanceTab | null
    if (paramTab && ['dashboard', 'pm-calendar'].includes(paramTab)) {
      return paramTab
    }
    return 'dashboard'
  }

  const [activeTab, setActiveTab] = useState<MaintenanceTab>(() => getDefaultTab())
  const [configMenuOpen, setConfigMenuOpen] = useState(false)
  const configMenuRef = useRef<HTMLDivElement>(null)

  // Close config menu on outside click
  useEffect(() => {
    if (!configMenuOpen) return
    function handler(e: MouseEvent) {
      if (configMenuRef.current && !configMenuRef.current.contains(e.target as Node)) {
        setConfigMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [configMenuOpen])

  const isConfigTab = CONFIG_TABS.some((t) => t.key === activeTab)

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

  // Loading screen during hydration or while permissions resolve
  if (!isClient || !orgId || permsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    )
  }

  return (
    <PagePadding>
    <>
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
                <div className="ml-auto flex items-center gap-2">
                  {canManageMaintenance && (
                    <Link
                      href="/maintenance/board-report"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors duration-200 cursor-pointer"
                    >
                      <FileBarChart className="w-4 h-4" />
                      Board Report
                    </Link>
                  )}
                  {canManageMaintenance && (
                    <div className="relative" ref={configMenuRef}>
                      <button
                        onClick={() => setConfigMenuOpen((o) => !o)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors duration-200 cursor-pointer ${
                          isConfigTab || configMenuOpen
                            ? 'text-slate-900 bg-slate-100'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                        aria-label="Configuration"
                      >
                        <Settings className="w-4 h-4" />
                        Configure
                      </button>
                      {configMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 z-50 ui-glass-dropdown min-w-[180px] py-1">
                          {CONFIG_TABS.map(({ key, label, icon: Icon }) => (
                            <button
                              key={key}
                              onClick={() => {
                                setActiveTab(key)
                                setConfigMenuOpen(false)
                              }}
                              className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors cursor-pointer ${
                                activeTab === key ? 'text-slate-900 bg-slate-50' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
              <motion.p variants={fadeInUp} className="text-sm text-slate-500 mt-1">
                {activeSchoolId
                  ? activeSchoolLabel
                  : 'Work orders, assets, and facility operations'}
              </motion.p>
            </motion.div>

            {/* Sub-navigation tabs — for admins and technicians */}
            {showDashboardTabs ? (
              <>
                <div ref={tabContainerRef} role="tablist" aria-label="Maintenance tabs" className="relative flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
                  {MAIN_TABS.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      ref={(el) => setTabRef(key, el)}
                      role="tab"
                      aria-selected={activeTab === key}
                      id={`tab-${key}`}
                      aria-controls={`tabpanel-${key}`}
                      onClick={() => setActiveTab(key)}
                      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded ${
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
                <>
                    {activeTab === 'dashboard' && (
                      <div
                        role="tabpanel"
                        id="tabpanel-dashboard"
                        aria-labelledby="tab-dashboard"
                        className="animate-[fadeIn_200ms_ease-out]"
                      >
                        <MaintenanceDashboard activeCampusId={activeSchoolId} />
                      </div>
                    )}

                    {activeTab === 'pm-calendar' && (
                      <div
                        role="tabpanel"
                        id="tabpanel-pm-calendar"
                        aria-labelledby="tab-pm-calendar"
                        className="animate-[fadeIn_200ms_ease-out]"
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
                    )}

                    {/* Routing tab — managers only */}
                    {canManageMaintenance && activeTab === 'routing' && (
                      <div
                        role="tabpanel"
                        id="tabpanel-routing"
                        aria-labelledby="tab-routing"
                        className="animate-[fadeIn_200ms_ease-out]"
                      >
                        <TicketRoutingTab defaultModule="MAINTENANCE" />
                      </div>
                    )}

                    {/* Forms tab — managers only */}
                    {canManageMaintenance && activeTab === 'forms' && (
                      <div
                        role="tabpanel"
                        id="tabpanel-forms"
                        aria-labelledby="tab-forms"
                        className="animate-[fadeIn_200ms_ease-out]"
                      >
                        <MaintenanceFormsTab />
                      </div>
                    )}
                </>
              </>
            ) : (
              /* Submit-only users see My Requests (to track tickets they've submitted) */
              <MyRequestsView />
            )}
        </div>
      </MotionConfig>
    </>
    </PagePadding>
  )
}

// ─── Forms Tab ──────────────────────────────────────────────────────────────

function MaintenanceFormsTab() {
  const [editingCategory, setEditingCategory] = useState<string | null>(null)

  const editingCat = MAINTENANCE_CATEGORY_KEYS.find((c) => c.key === editingCategory)

  // Editing view — full-width form editor
  if (editingCat) {
    const Icon = editingCat.icon
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setEditingCategory(null)}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 cursor-pointer transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to all categories
        </button>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className={`w-10 h-10 rounded-xl ${editingCat.bg} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${editingCat.color}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{editingCat.label} Form</h3>
              <p className="text-sm text-slate-500">Fields shown when submitting a {editingCat.label.toLowerCase()} ticket</p>
            </div>
          </div>

          <CategoryFormEditor
            key={editingCat.key}
            categoryKey={editingCat.key.toLowerCase()}
            categoryLabel={editingCat.label}
            module="MAINTENANCE"
          />
        </div>
      </div>
    )
  }

  // Card grid view — all categories
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Ticket Forms</h3>
        <p className="text-sm text-slate-500 mt-0.5">
          Each maintenance category has its own intake form. Click a category to customize what fields appear.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {MAINTENANCE_CATEGORY_KEYS.map((cat) => {
          const Icon = cat.icon
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setEditingCategory(cat.key)}
              className="group text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
            >
              <div className={`w-10 h-10 rounded-xl ${cat.bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${cat.color}`} />
              </div>
              <h4 className="text-sm font-semibold text-slate-900">{cat.label}</h4>
              <p className="text-xs text-slate-400 mt-0.5">Customize intake fields</p>
              <div className="mt-3 flex items-center gap-1 text-xs text-slate-400 group-hover:text-slate-600 transition-colors">
                <Pencil className="w-3 h-3" />
                Edit form
              </div>
            </button>
          )
        })}
      </div>
    </div>
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
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    }>
      <MaintenanceContent />
    </Suspense>
  )
}
