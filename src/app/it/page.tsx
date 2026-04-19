'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { useAnimatedTabIndicator } from '@/lib/hooks/useAnimatedTabIndicator'
import { useITPermissions } from '@/lib/hooks/useITPermissions'
import { useAuth } from '@/lib/hooks/useAuth'
import TabIndicator from '@/components/ui/TabIndicator'
import ITPageShell from '@/components/it/ITPageShell'
import ITDashboard from '@/components/it/ITDashboard'
import ITTicketsList from '@/components/it/ITTicketsList'
import ITKanbanBoard from '@/components/it/ITKanbanBoard'
import ITMagicLinksTab from '@/components/it/ITMagicLinksTab'
import ITTicketDetail from '@/components/it/ITTicketDetail'
import ITTicketCreateDrawer from '@/components/it/ITTicketCreateDrawer'
import TicketRoutingTab from '@/components/settings/TicketRoutingTab'
import { LayoutDashboard, Kanban, List, Link2, Route } from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useTrackModuleVisit } from '@/components/onboarding/ChecklistWidget'

type HelpDeskTab = 'dashboard' | 'tickets' | 'magic-links' | 'routing'
type TicketViewMode = 'board' | 'list'
type TicketScope = 'mine' | 'all'

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
  { key: 'tickets', label: 'Tickets', icon: List },
  { key: 'magic-links', label: 'Magic Links', icon: Link2, requiresManage: true },
  { key: 'routing', label: 'Routing', icon: Route, requiresManage: true },
]

function ITContent() {
  usePageTitle('IT Help Desk')
  useTrackModuleVisit('it')
  const router = useRouter()
  const searchParams = useSearchParams()
  const p = useITPermissions()
  const { user } = useAuth()

  // Redirect old tab URLs to new routes
  useEffect(() => {
    const tabParam = searchParams?.get('tab')
    if (tabParam && TAB_REDIRECTS[tabParam]) {
      router.replace(TAB_REDIRECTS[tabParam])
    }
  }, [searchParams, router])

  const canSeeManageTabs = p.isOnITTeam || p.canManage

  const getDefaultTab = (): HelpDeskTab => {
    const paramTab = searchParams?.get('tab')
    // Handle old "board" param — redirect to tickets tab with board view
    if (paramTab === 'board') return 'tickets'
    if (paramTab && ['dashboard', 'tickets', 'magic-links'].includes(paramTab)) {
      return paramTab as HelpDeskTab
    }
    if (canSeeManageTabs) return 'dashboard'
    return 'tickets'
  }

  const [activeTab, setActiveTab] = useState<HelpDeskTab>('tickets')

  // View mode: board vs list (persisted per user)
  const viewModeKey = user.id ? `it-view-mode:${user.id}` : null
  const [viewMode, setViewModeRaw] = useState<TicketViewMode>(() => {
    if (typeof window === 'undefined' || !viewModeKey) return 'board'
    return (localStorage.getItem(viewModeKey) as TicketViewMode) || 'board'
  })
  const setViewMode = (mode: TicketViewMode) => {
    setViewModeRaw(mode)
    if (viewModeKey) localStorage.setItem(viewModeKey, mode)
  }

  // Handle old "board" tab param → set view mode to board
  useEffect(() => {
    const paramTab = searchParams?.get('tab')
    if (paramTab === 'board') setViewMode('board')
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scope: mine (my tickets + unassigned) vs all
  const scopeKey = user.id ? `it-scope:${user.id}` : null
  const [scope, setScopeRaw] = useState<TicketScope>(() => {
    if (typeof window === 'undefined' || !scopeKey) return 'mine'
    return (localStorage.getItem(scopeKey) as TicketScope) || 'mine'
  })
  const setScope = (s: TicketScope) => {
    setScopeRaw(s)
    if (scopeKey) localStorage.setItem(scopeKey, s)
  }

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
        <motion.h1 variants={fadeInUp} className="text-2xl font-semibold text-slate-900">
          IT Help Desk
        </motion.h1>
        <motion.p variants={fadeInUp} className="text-sm text-slate-500 mt-1">
          {p.canManage ? 'Manage IT support tickets and assignments' : 'Submit and track your IT requests'}
        </motion.p>
      </motion.div>

      {/* Sub-navigation tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 mb-6">
        <div ref={tabContainerRef} role="tablist" aria-label="Help Desk tabs" className="relative flex gap-1">
          {visibleTabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              ref={(el) => setTabRef(key, el)}
              role="tab"
              aria-selected={activeTab === key}
              id={`tab-${key}`}
              aria-controls={`tabpanel-${key}`}
              onClick={() => handleTabChange(key)}
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

        {/* View mode toggle + scope — only on tickets tab */}
        {activeTab === 'tickets' && canSeeManageTabs && (
          <div className="flex items-center gap-3 pb-2">
            {/* Scope toggle */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setScope('mine')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  scope === 'mine'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                My Queue
              </button>
              <button
                onClick={() => setScope('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  scope === 'all'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                All Tickets
              </button>
            </div>

            {/* Divider */}
            <div className="w-px h-5 bg-slate-200" />

            {/* View mode icons */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('board')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  viewMode === 'board'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                aria-label="Board view"
                title="Board view"
              >
                <Kanban className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                aria-label="List view"
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tab content */}
      {canSeeManageTabs && (
        <div
          role="tabpanel"
          id="tabpanel-dashboard"
          aria-labelledby="tab-dashboard"
          className={activeTab === 'dashboard' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
          aria-hidden={activeTab !== 'dashboard'}
        >
          <ITDashboard
            onViewTicket={setDetailTicketId}
            onCreateTicket={() => setShowCreate(true)}
          />
        </div>
      )}

      <div
        role="tabpanel"
        id="tabpanel-tickets"
        aria-labelledby="tab-tickets"
        className={activeTab === 'tickets' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
        aria-hidden={activeTab !== 'tickets'}
      >
        {viewMode === 'board' && canSeeManageTabs ? (
          <ITKanbanBoard
            onTicketClick={setDetailTicketId}
            scope={scope}
            currentUserId={user.id || undefined}
          />
        ) : (
          <ITTicketsList
            onViewTicket={setDetailTicketId}
            onCreateTicket={() => setShowCreate(true)}
            canManage={p.canManage}
            scope={scope}
            currentUserId={user.id || undefined}
          />
        )}
      </div>

      {canSeeManageTabs && (
        <div
          role="tabpanel"
          id="tabpanel-magic-links"
          aria-labelledby="tab-magic-links"
          className={activeTab === 'magic-links' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
          aria-hidden={activeTab !== 'magic-links'}
        >
          <ITMagicLinksTab />
        </div>
      )}

      {/* Routing tab — managers/admins only */}
      {canSeeManageTabs && activeTab === 'routing' && (
        <div
          id="tabpanel-routing"
          aria-labelledby="tab-routing"
          className="animate-[fadeIn_200ms_ease-out]"
        >
          <TicketRoutingTab defaultModule="IT" />
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
