'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, MotionConfig } from 'framer-motion'
import { useModules } from '@/lib/hooks/useModuleEnabled'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { useQuery } from '@tanstack/react-query'
import { queryOptions } from '@/lib/queries'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import DashboardLayout from '@/components/DashboardLayout'
import ModuleGate from '@/components/ModuleGate'
import MaintenanceSkeleton from '@/components/maintenance/MaintenanceSkeleton'
import MaintenanceDashboard from '@/components/maintenance/MaintenanceDashboard'
import MyRequestsView from '@/components/maintenance/MyRequestsView'
import WorkOrdersView from '@/components/maintenance/WorkOrdersView'
import { LayoutDashboard, ClipboardList, FileText } from 'lucide-react'
import type { MaintenanceTab } from '@/components/Sidebar'

interface Campus {
  id: string
  name: string
  isActive: boolean
}

const SUB_TABS: {
  key: MaintenanceTab
  label: string
  icon: typeof LayoutDashboard
  requiresManage?: boolean
  requiresClaim?: boolean
}[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, requiresManage: true },
  { key: 'work-orders', label: 'Work Orders', icon: ClipboardList, requiresClaim: true },
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

  const { data: modules = [], isLoading: modulesLoading } = useModules()
  const { data: perms } = usePermissions()
  const canManageMaintenance = perms?.canManageMaintenance ?? false
  const canClaimMaintenance = perms?.canClaimMaintenance ?? false

  const { data: rawCampuses, isLoading: campusesLoading } = useQuery(queryOptions.campuses())
  const campuses = (rawCampuses as Campus[] | undefined) ?? []

  const dataLoading = modulesLoading || campusesLoading

  // Derive enabled campuses for maintenance
  const enabledCampusIds = modules
    .filter((m) => m.moduleId === 'maintenance' && m.campusId)
    .map((m) => m.campusId as string)

  const enabledCampuses = campuses.filter((c) => enabledCampusIds.includes(c.id))

  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(null)
  const activeCampusId = selectedCampusId ?? enabledCampuses[0]?.id ?? null
  const activeCampusName = enabledCampuses.find((c) => c.id === activeCampusId)?.name

  // Determine default tab based on URL param then permissions
  const getDefaultTab = (): MaintenanceTab => {
    const paramTab = searchParams?.get('tab') as MaintenanceTab | null
    if (paramTab && ['dashboard', 'work-orders', 'my-requests'].includes(paramTab)) {
      return paramTab
    }
    if (canManageMaintenance) return 'dashboard'
    if (canClaimMaintenance) return 'work-orders'
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
    if (tab.requiresClaim) return canManageMaintenance || canClaimMaintenance
    return true
  })

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
          <div>
            {/* Page header */}
            <motion.div
              className="mb-6"
              initial="hidden"
              animate="visible"
              variants={staggerContainer(0.08, 0.05)}
            >
              <motion.h1 variants={fadeInUp} className="text-2xl font-semibold text-gray-900">
                Facilities Management
              </motion.h1>
              <motion.p variants={fadeInUp} className="text-sm text-gray-500">
                {activeCampusName || 'Maintenance requests and facility operations'}
              </motion.p>
            </motion.div>

            {/* Campus selector — shown when multiple campuses have maintenance enabled */}
            {enabledCampuses.length > 1 && (
              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
                {enabledCampuses.map((campus) => (
                  <button
                    key={campus.id}
                    onClick={() => setSelectedCampusId(campus.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                      activeCampusId === campus.id
                        ? 'bg-emerald-50 text-emerald-700 font-medium border border-emerald-200'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    {campus.name}
                  </button>
                ))}
              </div>
            )}

            {/* Sub-navigation tabs */}
            <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
              {visibleTabs.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === key
                      ? 'border-emerald-500 text-emerald-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
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
                  <MaintenanceDashboard activeCampusId={activeCampusId} />
                </div>

                <div
                  className={activeTab === 'work-orders' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
                  aria-hidden={activeTab !== 'work-orders'}
                >
                  <WorkOrdersView
                    activeCampusId={activeCampusId}
                    campuses={enabledCampuses}
                  />
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
