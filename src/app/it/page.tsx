'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { useAnimatedTabIndicator } from '@/lib/hooks/useAnimatedTabIndicator'
import { useITPermissions } from '@/lib/hooks/useITPermissions'
import TabIndicator from '@/components/ui/TabIndicator'
import ITPageShell from '@/components/it/ITPageShell'
import ITDashboard from '@/components/it/ITDashboard'
import ITTicketsList from '@/components/it/ITTicketsList'
import ITKanbanBoard from '@/components/it/ITKanbanBoard'
import ITMagicLinksTab from '@/components/it/ITMagicLinksTab'
import ITTicketDetail from '@/components/it/ITTicketDetail'
import ITTicketCreateDrawer from '@/components/it/ITTicketCreateDrawer'
import { LayoutDashboard, List, Kanban, Link2 } from 'lucide-react'

type HelpDeskTab = 'dashboard' | 'tickets' | 'board' | 'magic-links'

// Map old tab params to new routes for backward compat
const TAB_REDIRECTS: Record<string, string> = {
  devices: '/it/devices',
  students: '/it/devices',
  loaners: '/it/devices',
  deployment: '/it/lifecycle',
  provisioning: '/it/lifecycle',
  summer: '/it/lifecycle',
  'content-filters': '/it/security',
  'security-incidents': '/it/security',
  intelligence: '/it/security',
  analytics: '/it/admin',
  reports: '/it/admin',
  erate: '/it/admin',
  sync: '/it/admin',
}

const TABS: { key: HelpDeskTab; label: string; icon: typeof LayoutDashboard; requiresManage?: boolean }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, requiresManage: true },
  { key: 'board', label: 'Board', icon: Kanban, requiresManage: true },
  { key: 'tickets', label: 'Tickets', icon: List },
  { key: 'magic-links', label: 'Magic Links', icon: Link2, requiresManage: true },
]

function ITContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const p = useITPermissions()

  // Redirect old tab URLs to new routes
  useEffect(() => {
    const tabParam = searchParams?.get('tab')
    if (tabParam && TAB_REDIRECTS[tabParam]) {
      router.replace(TAB_REDIRECTS[tabParam])
    }
  }, [searchParams, router])

  const canSeeManageTabs = p.isOnITTeam || p.canManage

  const getDefaultTab = (): HelpDeskTab => {
    const paramTab = searchParams?.get('tab') as HelpDeskTab | null
    if (paramTab && ['dashboard', 'board', 'tickets', 'magic-links'].includes(paramTab)) {
      return paramTab
    }
    if (canSeeManageTabs) return 'dashboard'
    return 'tickets'
  }

  const [activeTab, setActiveTab] = useState<HelpDeskTab>('tickets')

  useEffect(() => {
    if (p.loaded) {
      setActiveTab(getDefaultTab())
    }
  }, [p.loaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Drawer state
  const [detailTicketId, setDetailTicketId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  // Check for ?new=1 URL param
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowCreate(true)
    }
  }, [searchParams])

  const visibleTabs = TABS.filter((tab) => {
    if (tab.requiresManage) return p.isOnITTeam || p.canManage
    return true
  })

  const { containerRef: tabContainerRef, setTabRef, indicatorStyle } = useAnimatedTabIndicator(activeTab, [canSeeManageTabs])

  // Fetch members for assignment dropdown
  const { data: members = [] } = useQuery({
    queryKey: ['it-members'],
    queryFn: () => fetchApi<{ id: string; firstName: string; lastName: string }[]>('/api/settings/users'),
    staleTime: 5 * 60_000,
    enabled: p.canManage,
  })

  const handleTabChange = (tab: HelpDeskTab) => {
    setActiveTab(tab)
    const defaultTab = canSeeManageTabs ? 'dashboard' : 'tickets'
    const url = tab === defaultTab ? '/it' : `/it?tab=${tab}`
    window.history.replaceState(null, '', url)
  }

  if (!p.loaded) return null

  return (
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
          {p.canManage ? 'Manage IT support tickets and assignments' : 'Submit and track your IT requests'}
        </motion.p>
      </motion.div>

      {/* Sub-navigation tabs */}
      <div ref={tabContainerRef} className="relative flex gap-1 border-b border-gray-200 mb-6">
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
      {canSeeManageTabs && (
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

      {canSeeManageTabs && (
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
          canManage={p.canManage}
        />
      </div>

      {canSeeManageTabs && (
        <div
          className={activeTab === 'magic-links' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
          aria-hidden={activeTab !== 'magic-links'}
        >
          <ITMagicLinksTab />
        </div>
      )}

      {/* Detail drawer */}
      <ITTicketDetail
        ticketId={detailTicketId}
        isOpen={!!detailTicketId}
        onClose={() => setDetailTicketId(null)}
        canManage={p.canManage}
        members={members as { id: string; firstName: string; lastName: string }[]}
      />

      {/* Create drawer */}
      <ITTicketCreateDrawer
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        canManage={p.canManage}
      />
    </div>
  )
}

export default function ITPage() {
  return (
    <ITPageShell>
      <Suspense fallback={null}>
        <ITContent />
      </Suspense>
    </ITPageShell>
  )
}
