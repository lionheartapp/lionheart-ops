'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, MotionConfig } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { fetchApi } from '@/lib/api-client'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { useAnimatedTabIndicator } from '@/lib/hooks/useAnimatedTabIndicator'
import TabIndicator from '@/components/ui/TabIndicator'
import DashboardLayout from '@/components/DashboardLayout'
import ModuleGate from '@/components/ModuleGate'
import ITDashboard from '@/components/it/ITDashboard'
import ITTicketsList from '@/components/it/ITTicketsList'
import ITKanbanBoard from '@/components/it/ITKanbanBoard'
import ITMagicLinksTab from '@/components/it/ITMagicLinksTab'
import ITDevicesTab from '@/components/it/ITDevicesTab'
import ITDeviceDetailDrawer from '@/components/it/ITDeviceDetailDrawer'
import ITDeviceCreateDrawer from '@/components/it/ITDeviceCreateDrawer'
import ITStudentsTab from '@/components/it/ITStudentsTab'
import ITStudentDetailDrawer from '@/components/it/ITStudentDetailDrawer'
import ITStudentCreateDrawer from '@/components/it/ITStudentCreateDrawer'
import ITLoanersTab from '@/components/it/ITLoanersTab'
import ITSyncTab from '@/components/it/ITSyncTab'
import ITIntelligenceTab from '@/components/it/ITIntelligenceTab'
import ITSummerTab from '@/components/it/ITSummerTab'
import ITDeploymentTab from '@/components/it/ITDeploymentTab'
import ITDeploymentBatchDetail from '@/components/it/ITDeploymentBatchDetail'
import ITDeploymentCreateDrawer from '@/components/it/ITDeploymentCreateDrawer'
import ITDamageReportDrawer from '@/components/it/ITDamageReportDrawer'
import ITTicketDetail from '@/components/it/ITTicketDetail'
import ITTicketCreateDrawer from '@/components/it/ITTicketCreateDrawer'
import ITProvisioningTab from '@/components/it/ITProvisioningTab'
import ITAnalyticsTab from '@/components/it/ITAnalyticsTab'
import ITReportsTab from '@/components/it/ITReportsTab'
import ITERateTab from '@/components/it/ITERateTab'
import ITContentFiltersTab from '@/components/it/ITContentFiltersTab'
import ITSecurityIncidentsTab from '@/components/it/ITSecurityIncidentsTab'
import { LayoutDashboard, List, Kanban, Link2, HardDrive, GraduationCap, Package, RefreshCw, Brain, Sun, Rocket, UserCog, ShieldAlert, BarChart3, FileText, FileCheck, Shield, ShieldBan } from 'lucide-react'

type ITTab = 'dashboard' | 'tickets' | 'board' | 'magic-links' | 'devices' | 'students' | 'loaners' | 'sync' | 'intelligence' | 'summer' | 'deployment' | 'provisioning' | 'analytics' | 'reports' | 'erate' | 'content-filters' | 'security-incidents'

type PermKey = 'canReadDevices' | 'canReadStudents' | 'canAccessLoaners' | 'canManageSync' | 'canViewIntelligence' | 'canAccessDeployment' | 'canAccessProvisioning' | 'canViewITAnalytics' | 'canViewITBoardReports' | 'canViewERate' | 'canViewContentFilters' | 'canViewSecurityIncidents'

const TABS: {
  key: ITTab
  label: string
  icon: typeof LayoutDashboard
  requiresManage?: boolean
  permKey?: PermKey
}[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, requiresManage: true },
  { key: 'board', label: 'Board', icon: Kanban, requiresManage: true },
  { key: 'tickets', label: 'Tickets', icon: List },
  { key: 'devices', label: 'Devices', icon: HardDrive, permKey: 'canReadDevices' },
  { key: 'students', label: 'Students', icon: GraduationCap, permKey: 'canReadStudents' },
  { key: 'loaners', label: 'Loaners', icon: Package, permKey: 'canAccessLoaners' },
  { key: 'sync', label: 'Sync', icon: RefreshCw, permKey: 'canManageSync' },
  { key: 'intelligence', label: 'Intelligence', icon: Brain, permKey: 'canViewIntelligence' },
  { key: 'deployment', label: 'Deployment', icon: Rocket, permKey: 'canAccessDeployment' },
  { key: 'summer', label: 'Summer', icon: Sun, requiresManage: true },
  { key: 'provisioning', label: 'Provisioning', icon: UserCog, permKey: 'canAccessProvisioning' },
  { key: 'analytics', label: 'Analytics', icon: BarChart3, permKey: 'canViewITAnalytics' },
  { key: 'reports', label: 'Reports', icon: FileText, permKey: 'canViewITBoardReports' },
  { key: 'erate', label: 'E-Rate', icon: FileCheck, permKey: 'canViewERate' },
  { key: 'content-filters', label: 'Content Filters', icon: Shield, permKey: 'canViewContentFilters' },
  { key: 'security-incidents', label: 'Security', icon: ShieldBan, permKey: 'canViewSecurityIncidents' },
  { key: 'magic-links', label: 'Magic Links', icon: Link2, requiresManage: true },
]

function ITContent() {
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
    if (!token || !orgId) router.push('/login')
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

  const { data: perms } = usePermissions()
  const canManage = perms?.canManageIT ?? false
  const canSubmit = perms?.canSubmitIT ?? false
  const canReadDevices = perms?.canReadDevices ?? false
  const canManageDevices = perms?.canManageDevices ?? false
  const canReadStudents = perms?.canReadStudents ?? false
  const canManageStudents = perms?.canManageStudents ?? false
  const canManageLoaners = perms?.canManageLoaners ?? false
  const canCheckoutLoaner = perms?.canCheckoutLoaner ?? false
  const canCheckinLoaner = perms?.canCheckinLoaner ?? false
  const canAccessLoaners = canManageLoaners || canCheckoutLoaner || canCheckinLoaner
  const canManageSync = perms?.canManageSync ?? false
  const canViewIntelligence = perms?.canViewIntelligence ?? false
  const canConfigureDevices = perms?.canConfigureDevices ?? false
  const canManageDeployment = perms?.canManageDeployment ?? false
  const canProcessDeployment = perms?.canProcessDeployment ?? false
  const canAccessDeployment = canManageDeployment || canProcessDeployment
  const canManageProvisioning = perms?.canManageProvisioning ?? false
  const canViewProvisioning = perms?.canViewProvisioning ?? false
  const canAccessProvisioning = canManageProvisioning || canViewProvisioning
  const canViewITAnalytics = perms?.canViewITAnalytics ?? false
  const canViewITBoardReports = perms?.canViewITBoardReports ?? false
  const canManageERate = perms?.canManageERate ?? false
  const canViewERate = canManageERate || (perms?.canViewERate ?? false)
  const canViewCIPAAudit = perms?.canViewCIPAAudit ?? false
  const canConfigureFilters = perms?.canConfigureFilters ?? false
  const canManageFilters = perms?.canManageFilters ?? false
  const canViewContentFilters = canViewCIPAAudit || canConfigureFilters || canManageFilters
  const canViewSecurityIncidents = perms?.canViewSecurityIncidents ?? false
  const canCreateSecurityIncident = perms?.canCreateSecurityIncident ?? false
  const canManageSecurityIncidents = perms?.canManageSecurityIncidents ?? false

  // Determine default tab based on URL param then permissions
  const validTabs: ITTab[] = ['dashboard', 'board', 'tickets', 'magic-links', 'devices', 'students', 'loaners', 'sync', 'intelligence', 'deployment', 'summer', 'provisioning', 'analytics', 'reports', 'erate', 'content-filters', 'security-incidents']
  const getDefaultTab = (): ITTab => {
    const paramTab = searchParams?.get('tab') as ITTab | null
    if (paramTab && validTabs.includes(paramTab)) {
      return paramTab
    }
    if (canManage) return 'dashboard'
    return 'tickets'
  }

  const [activeTab, setActiveTab] = useState<ITTab>('tickets')

  // Set default tab once permissions load
  useEffect(() => {
    if (perms) {
      setActiveTab(getDefaultTab())
    }
  }, [perms]) // eslint-disable-line react-hooks/exhaustive-deps

  // Drawer state
  const [detailTicketId, setDetailTicketId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [detailDeviceId, setDetailDeviceId] = useState<string | null>(null)
  const [showDeviceCreate, setShowDeviceCreate] = useState(false)
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null)
  const [showStudentCreate, setShowStudentCreate] = useState(false)
  const [deploymentBatchId, setDeploymentBatchId] = useState<string | null>(null)
  const [showDeploymentCreate, setShowDeploymentCreate] = useState(false)
  const [damageReportBatchId, setDamageReportBatchId] = useState<string | null>(null)

  // Check for ?new=1 URL param
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowCreate(true)
    }
  }, [searchParams])

  // Visible tabs based on permissions
  const permMap: Record<PermKey, boolean> = {
    canReadDevices,
    canReadStudents,
    canAccessLoaners,
    canManageSync,
    canViewIntelligence,
    canAccessDeployment,
    canAccessProvisioning,
    canViewITAnalytics,
    canViewITBoardReports,
    canViewERate,
    canViewContentFilters,
    canViewSecurityIncidents,
  }
  const visibleTabs = TABS.filter((tab) => {
    if (tab.requiresManage) return canManage
    if (tab.permKey) return permMap[tab.permKey]
    return true
  })

  const { containerRef: tabContainerRef, setTabRef, indicatorStyle } = useAnimatedTabIndicator(activeTab, [canManage])

  // Fetch members for assignment dropdown
  const { data: members = [] } = useQuery({
    queryKey: ['it-members'],
    queryFn: () => fetchApi<{ id: string; firstName: string; lastName: string }[]>('/api/settings/users'),
    staleTime: 5 * 60_000,
    enabled: canManage,
  })

  const handleTabChange = (tab: ITTab) => {
    setActiveTab(tab)
    const defaultTab = canManage ? 'dashboard' : 'tickets'
    const url = tab === defaultTab ? '/it' : `/it?tab=${tab}`
    window.history.replaceState(null, '', url)
  }

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

  // Show friendly empty state if user has no IT permissions at all
  if (perms && !canManage && !canSubmit) {
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
        <div className="max-w-md mx-auto mt-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Access Required</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            You don&apos;t have permission to access the IT Help Desk. Ask your administrator to
            update your role in <span className="font-medium text-gray-700">Settings &gt; Members</span>.
          </p>
        </div>
      </DashboardLayout>
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
      <ModuleGate moduleId="it-helpdesk">
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
                IT Help Desk
              </motion.h1>
              <motion.p variants={fadeInUp} className="text-sm text-gray-500 mt-1">
                {canManage ? 'Manage IT support tickets and assignments' : 'Submit and track your IT requests'}
              </motion.p>
            </motion.div>

            {/* Sub-navigation tabs */}
            <div ref={tabContainerRef} className="relative flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
              {visibleTabs.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  ref={(el) => setTabRef(key, el)}
                  onClick={() => handleTabChange(key)}
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
            {canManage && (
              <div
                className={activeTab === 'dashboard' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
                aria-hidden={activeTab !== 'dashboard'}
              >
                <ITDashboard
                  onViewTicket={setDetailTicketId}
                  onCreateTicket={() => setShowCreate(true)}
                />
              </div>
            )}

            {canManage && (
              <div
                className={activeTab === 'board' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
                aria-hidden={activeTab !== 'board'}
              >
                <ITKanbanBoard onTicketClick={setDetailTicketId} />
              </div>
            )}

            <div
              className={activeTab === 'tickets' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
              aria-hidden={activeTab !== 'tickets'}
            >
              <ITTicketsList
                onViewTicket={setDetailTicketId}
                onCreateTicket={() => setShowCreate(true)}
                canManage={canManage}
              />
            </div>

            {canReadDevices && (
              <div
                className={activeTab === 'devices' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
                aria-hidden={activeTab !== 'devices'}
              >
                <ITDevicesTab
                  onViewDevice={setDetailDeviceId}
                  onCreateDevice={() => setShowDeviceCreate(true)}
                  canManage={canManageDevices}
                />
              </div>
            )}

            {canReadStudents && (
              <div
                className={activeTab === 'students' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
                aria-hidden={activeTab !== 'students'}
              >
                <ITStudentsTab
                  onViewStudent={setDetailStudentId}
                  onCreateStudent={() => setShowStudentCreate(true)}
                  canManage={canManageStudents}
                />
              </div>
            )}

            {canAccessLoaners && (
              <div className={activeTab === 'loaners' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'} aria-hidden={activeTab !== 'loaners'}>
                <ITLoanersTab canManage={canManageLoaners} canCheckout={canCheckoutLoaner} canCheckin={canCheckinLoaner} />
              </div>
            )}

            {canManageSync && (
              <div className={activeTab === 'sync' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'} aria-hidden={activeTab !== 'sync'}>
                <ITSyncTab canManage={canManageSync} />
              </div>
            )}

            {canViewIntelligence && (
              <div className={activeTab === 'intelligence' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'} aria-hidden={activeTab !== 'intelligence'}>
                <ITIntelligenceTab canManage={canViewIntelligence} canConfigure={canConfigureDevices} onViewDevice={setDetailDeviceId} />
              </div>
            )}

            {canAccessDeployment && (
              <div className={activeTab === 'deployment' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'} aria-hidden={activeTab !== 'deployment'}>
                {deploymentBatchId ? (
                  <ITDeploymentBatchDetail
                    batchId={deploymentBatchId}
                    onBack={() => setDeploymentBatchId(null)}
                    canManage={canManageDeployment}
                    canProcess={canProcessDeployment}
                  />
                ) : (
                  <ITDeploymentTab
                    canManage={canManageDeployment}
                    onViewBatch={setDeploymentBatchId}
                    onCreateBatch={() => setShowDeploymentCreate(true)}
                  />
                )}
              </div>
            )}

            {canManage && (
              <div className={activeTab === 'summer' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'} aria-hidden={activeTab !== 'summer'}>
                <ITSummerTab canManage={canManage} />
              </div>
            )}

            {canAccessProvisioning && (
              <div className={activeTab === 'provisioning' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'} aria-hidden={activeTab !== 'provisioning'}>
                <ITProvisioningTab canManage={canManageProvisioning} canView={canViewProvisioning} />
              </div>
            )}

            {canViewITAnalytics && (
              <div className={activeTab === 'analytics' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'} aria-hidden={activeTab !== 'analytics'}>
                <ITAnalyticsTab canViewBoardReports={canViewITBoardReports} />
              </div>
            )}

            {canViewITBoardReports && (
              <div className={activeTab === 'reports' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'} aria-hidden={activeTab !== 'reports'}>
                <ITReportsTab />
              </div>
            )}

            {canViewERate && (
              <div className={activeTab === 'erate' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'} aria-hidden={activeTab !== 'erate'}>
                <ITERateTab canManage={canManageERate} />
              </div>
            )}

            {canViewContentFilters && (
              <div className={activeTab === 'content-filters' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'} aria-hidden={activeTab !== 'content-filters'}>
                <ITContentFiltersTab canManage={canManageFilters} canConfigure={canConfigureFilters} canViewAdminOnly={canViewCIPAAudit} />
              </div>
            )}

            {canViewSecurityIncidents && (
              <div className={activeTab === 'security-incidents' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'} aria-hidden={activeTab !== 'security-incidents'}>
                <ITSecurityIncidentsTab canCreate={canCreateSecurityIncident} canManage={canManageSecurityIncidents} />
              </div>
            )}

            {canManage && (
              <div
                className={activeTab === 'magic-links' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
                aria-hidden={activeTab !== 'magic-links'}
              >
                <ITMagicLinksTab />
              </div>
            )}
          </div>
        </MotionConfig>

        {/* Detail drawer */}
        <ITTicketDetail
          ticketId={detailTicketId}
          isOpen={!!detailTicketId}
          onClose={() => setDetailTicketId(null)}
          canManage={canManage}
          members={members as { id: string; firstName: string; lastName: string }[]}
        />

        {/* Create drawer */}
        <ITTicketCreateDrawer
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          canManage={canManage}
        />

        {/* Device drawers */}
        <ITDeviceDetailDrawer
          deviceId={detailDeviceId}
          isOpen={!!detailDeviceId}
          onClose={() => setDetailDeviceId(null)}
          canManage={canManageDevices}
        />
        <ITDeviceCreateDrawer
          isOpen={showDeviceCreate}
          onClose={() => setShowDeviceCreate(false)}
        />

        {/* Student drawers */}
        <ITStudentDetailDrawer
          studentId={detailStudentId}
          isOpen={!!detailStudentId}
          onClose={() => setDetailStudentId(null)}
          canManage={canManageStudents}
        />
        <ITStudentCreateDrawer
          isOpen={showStudentCreate}
          onClose={() => setShowStudentCreate(false)}
        />

        {/* Deployment drawers */}
        <ITDeploymentCreateDrawer
          isOpen={showDeploymentCreate}
          onClose={() => setShowDeploymentCreate(false)}
        />
        <ITDamageReportDrawer
          batchId={damageReportBatchId}
          isOpen={!!damageReportBatchId}
          onClose={() => setDamageReportBatchId(null)}
        />
      </ModuleGate>
    </DashboardLayout>
  )
}

export default function ITPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <ITContent />
    </Suspense>
  )
}
