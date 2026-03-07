'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, MotionConfig } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { useAnimatedTabIndicator } from '@/lib/hooks/useAnimatedTabIndicator'
import TabIndicator from '@/components/ui/TabIndicator'
import DashboardLayout from '@/components/DashboardLayout'
import ModuleGate from '@/components/ModuleGate'
import ITDashboard from '@/components/it/ITDashboard'
import ITTicketsList from '@/components/it/ITTicketsList'
import ITKanbanBoard from '@/components/it/ITKanbanBoard'
import ITMagicLinksTab from '@/components/it/ITMagicLinksTab'
import ITTicketDetail from '@/components/it/ITTicketDetail'
import ITTicketCreateDrawer from '@/components/it/ITTicketCreateDrawer'
import { LayoutDashboard, List, Kanban, Link2, ShieldAlert } from 'lucide-react'

type ITTab = 'dashboard' | 'tickets' | 'board' | 'magic-links'

interface TabDef {
  key: ITTab
  label: string
  icon: typeof LayoutDashboard
  requiresManage?: boolean
}

const TABS: TabDef[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, requiresManage: true },
  { key: 'board', label: 'Board', icon: Kanban, requiresManage: true },
  { key: 'tickets', label: 'Tickets', icon: List },
  { key: 'magic-links', label: 'Magic Links', icon: Link2, requiresManage: true },
]

function ITContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: perms } = usePermissions()
  const canManage = perms?.canManageIT ?? false
  const canSubmit = perms?.canSubmitIT ?? false

  const [isClient, setIsClient] = useState(false)
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  const orgId = typeof window !== 'undefined' ? localStorage.getItem('org-id') : null
  const userName = typeof window !== 'undefined' ? localStorage.getItem('user-name') : null
  const userEmail = typeof window !== 'undefined' ? localStorage.getItem('user-email') : null
  const userAvatar = typeof window !== 'undefined' ? localStorage.getItem('user-avatar') : null
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('org-logo-url') : null
  )

  useEffect(() => {
    setIsClient(true)
    if (!token || !orgId) router.push('/login')
  }, [token, orgId, router])

  useEffect(() => {
    if (orgLogoUrl || !token) return
    fetch('/api/onboarding/school-info', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.data?.logoUrl) {
          setOrgLogoUrl(d.data.logoUrl)
          localStorage.setItem('org-logo-url', d.data.logoUrl)
        }
      })
      .catch(() => {})
  }, [orgLogoUrl, token])

  // Determine initial tab from URL
  const urlTab = searchParams.get('tab') as ITTab | null
  const defaultTab = canManage ? 'dashboard' : 'tickets'
  const [activeTab, setActiveTab] = useState<ITTab>(urlTab || defaultTab)

  // Update tab when permissions load
  useEffect(() => {
    if (!urlTab && perms) {
      setActiveTab(canManage ? 'dashboard' : 'tickets')
    }
  }, [perms, canManage, urlTab])

  // Drawer state
  const [detailTicketId, setDetailTicketId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  // Check for ?new=1 URL param
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowCreate(true)
    }
  }, [searchParams])

  const visibleTabs = TABS.filter((t) => !t.requiresManage || canManage)
  const { containerRef, setTabRef, indicatorStyle } = useAnimatedTabIndicator(activeTab)

  // Fetch members for assignment dropdown
  const { data: members = [] } = useQuery({
    queryKey: ['it-members'],
    queryFn: () => fetchApi<{ id: string; firstName: string; lastName: string }[]>('/api/settings/users'),
    staleTime: 5 * 60_000,
    enabled: canManage,
  })

  const handleTabChange = (tab: ITTab) => {
    setActiveTab(tab)
    const url = tab === defaultTab ? '/it' : `/it?tab=${tab}`
    window.history.replaceState(null, '', url)
  }

  if (!isClient || !token) return null

  // Show friendly empty state if user has no IT permissions at all
  if (perms && !canManage && !canSubmit) {
    return (
      <DashboardLayout
        userName={userName || 'User'}
        userEmail={userEmail || ''}
        userAvatar={userAvatar || undefined}
        organizationLogoUrl={orgLogoUrl || undefined}
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
      userEmail={userEmail || ''}
      userAvatar={userAvatar || undefined}
      organizationLogoUrl={orgLogoUrl || undefined}
    >
      <ModuleGate moduleId="it-helpdesk">
        <MotionConfig transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}>
          <motion.div
            variants={staggerContainer()}
            initial="hidden"
            animate="visible"
            className="max-w-[1400px] mx-auto"
          >
            {/* Header */}
            <motion.div variants={fadeInUp} className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">IT Help Desk</h1>
              <p className="text-sm text-gray-500 mt-1">
                {canManage ? 'Manage IT support tickets and assignments' : 'Submit and track your IT requests'}
              </p>
            </motion.div>

            {/* Tabs */}
            <motion.div variants={fadeInUp} className="mb-6">
              <div
                ref={containerRef as React.RefObject<HTMLDivElement>}
                className="relative flex border-b border-gray-200"
              >
                {visibleTabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.key}
                      ref={(el) => setTabRef(tab.key, el)}
                      onClick={() => handleTabChange(tab.key)}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                        activeTab === tab.key
                          ? 'text-gray-900'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  )
                })}
                <TabIndicator style={indicatorStyle} />
              </div>
            </motion.div>

            {/* Tab content */}
            <motion.div variants={fadeInUp}>
              {activeTab === 'dashboard' && canManage && (
                <ITDashboard
                  onViewTicket={setDetailTicketId}
                  onCreateTicket={() => setShowCreate(true)}
                />
              )}
              {activeTab === 'tickets' && (
                <ITTicketsList
                  onViewTicket={setDetailTicketId}
                  onCreateTicket={() => setShowCreate(true)}
                  canManage={canManage}
                />
              )}
              {activeTab === 'board' && canManage && (
                <ITKanbanBoard onTicketClick={setDetailTicketId} />
              )}
              {activeTab === 'magic-links' && canManage && (
                <ITMagicLinksTab />
              )}
            </motion.div>
          </motion.div>
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
      </ModuleGate>
    </DashboardLayout>
  )
}

export default function ITPage() {
  return (
    <Suspense fallback={null}>
      <ITContent />
    </Suspense>
  )
}
