'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, MotionConfig } from 'framer-motion'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { useCampusFilter } from '@/lib/hooks/useCampusFilter'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import DashboardLayout from '@/components/DashboardLayout'
import ModuleGate from '@/components/ModuleGate'
import CampusFilterChip from '@/components/maintenance/CampusFilterChip'
import MaintenanceSkeleton from '@/components/maintenance/MaintenanceSkeleton'
import MaintenanceDashboard from '@/components/maintenance/MaintenanceDashboard'
import MyRequestsView from '@/components/maintenance/MyRequestsView'
import { LayoutDashboard, FileText, FileBarChart } from 'lucide-react'
import Link from 'next/link'
import type { MaintenanceTab } from '@/components/Sidebar'
import { cacheAssignedTickets } from '@/lib/offline/sync'
import { useAnimatedTabIndicator } from '@/lib/hooks/useAnimatedTabIndicator'
import TabIndicator from '@/components/ui/TabIndicator'

const SUB_TABS: {
  key: MaintenanceTab
  label: string
  icon: typeof LayoutDashboard
  requiresManage?: boolean
}[] = [
  { key: 'dashboard', label: 'Maintenance Hub', icon: LayoutDashboard, requiresManage: true },
  { key: 'my-requests', label: 'My Requests', icon: FileText },
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
  const campusFilter = useCampusFilter()
  const dataLoading = campusFilter.isLoading

  // Determine default tab based on URL param then permissions
  const getDefaultTab = (): MaintenanceTab => {
    const paramTab = searchParams?.get('tab') as MaintenanceTab | null
    if (paramTab && ['dashboard', 'my-requests'].includes(paramTab)) {
      return paramTab
    }
    if (canManageMaintenance) return 'dashboard'
    return 'my-requests'
  }

  const [activeTab, setActiveTab] = useState<MaintenanceTab>('my-requests')

  // Set default tab once permissions load
  useEffect(() => {
    if (perms) {
      setActiveTab(getDefaultTab())
    }
  }, [perms]) // eslint-disable-line react-hooks/exhaustive-deps

  // Visible tabs based on permissions
  const visibleTabs = SUB_TABS.filter((tab) => {
    if (tab.requiresManage) return canManageMaintenance
    return true
  })

  const { containerRef: tabContainerRef, setTabRef, indicatorStyle } = useAnimatedTabIndicator(activeTab, [canManageMaintenance])

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
                <h1 className="text-2xl font-semibold text-gray-900">
                  Maintenance
                </h1>
                <CampusFilterChip campusFilter={campusFilter} />
                {canManageMaintenance && (
                  <Link
                    href="/maintenance/board-report"
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 cursor-pointer"
                  >
                    <FileBarChart className="w-4 h-4" />
                    Board Report
                  </Link>
                )}
              </motion.div>
              <motion.p variants={fadeInUp} className="text-sm text-gray-500 mt-1">
                {campusFilter.selectedCampusName === 'All Campuses'
                  ? 'Work orders, assets, and facility operations'
                  : campusFilter.selectedCampusName}
              </motion.p>
            </motion.div>

            {/* Sub-navigation tabs */}
            <div ref={tabContainerRef} className="relative flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
              {visibleTabs.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  ref={(el) => setTabRef(key, el)}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    activeTab === key
                      ? 'text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
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
                  className={activeTab === 'my-requests' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
                  aria-hidden={activeTab !== 'my-requests'}
                >
                  <MyRequestsView />
                </div>
              </>
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <MaintenanceContent />
    </Suspense>
  )
}
