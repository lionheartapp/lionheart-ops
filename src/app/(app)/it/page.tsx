'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { useAnimatedTabIndicator } from '@/lib/hooks/useAnimatedTabIndicator'
import { useITPermissions } from '@/lib/hooks/useITPermissions'
import { useAuth } from '@/lib/hooks/useAuth'
import { useActiveSchool } from '@/lib/hooks/useActiveSchool'
import TabIndicator from '@/components/ui/TabIndicator'
import ITPageShell from '@/components/it/ITPageShell'
import dynamic from 'next/dynamic'

import { useAiAvailability } from '@/lib/hooks/useAiAvailability'
import { LayoutDashboard, Kanban, List, Link2, Route, QrCode, FileText, Laptop, Code, KeyRound, Wifi, Projector, HelpCircle, ChevronLeft, Pencil, Settings, BarChart3 } from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useTrackModuleVisit } from '@/components/onboarding/ChecklistWidget'
import { useITTicketRealtime } from '@/lib/hooks/useITTicketRealtime'
import PagePadding from '@/components/PagePadding'
import { queryKeys } from '@/lib/queries'

function LazyPanel() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 animate-pulse">
      <div className="h-4 w-40 rounded bg-slate-200" />
      <div className="mt-4 h-24 rounded bg-slate-100" />
    </div>
  )
}

const ITKanbanBoard = dynamic(() => import('@/components/it/ITKanbanBoard'), {
  ssr: false,
  loading: () => <LazyPanel />,
})
const ITTicketsList = dynamic(() => import('@/components/it/ITTicketsList'), {
  loading: () => <LazyPanel />,
})
const ITDashboard = dynamic(() => import('@/components/it/ITDashboard'), {
  loading: () => <LazyPanel />,
})
const ITMagicLinksTab = dynamic(() => import('@/components/it/ITMagicLinksTab'), {
  loading: () => <LazyPanel />,
})
const ITTicketDetail = dynamic(() => import('@/components/it/ITTicketDetail'), {
  ssr: false,
  loading: () => null,
})
const SupportRequestDrawer = dynamic(() => import('@/components/forms/SupportRequestDrawer'), {
  ssr: false,
  loading: () => null,
})
const TicketRoutingTab = dynamic(() => import('@/components/settings/TicketRoutingTab'), {
  loading: () => <LazyPanel />,
})
const QrCodeManager = dynamic(() => import('@/components/forms/QrCodeManager'), {
  ssr: false,
  loading: () => <LazyPanel />,
})
const AiTicketIntakeDrawer = dynamic(() => import('@/components/it/AiTicketIntakeDrawer'), {
  ssr: false,
  loading: () => null,
})
const CategoryFormEditor = dynamic(() => import('@/components/settings/CategoryFormEditor'), {
  ssr: false,
  loading: () => <LazyPanel />,
})

type HelpDeskTab = 'tickets' | 'insights' | 'settings'
type SettingsSubTab = 'routing' | 'forms' | 'magic-links' | 'qr-codes'
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

// Old tab params → new tab structure
const OLD_TAB_MAP: Record<string, HelpDeskTab> = {
  dashboard: 'insights',
  'magic-links': 'settings',
  routing: 'settings',
  forms: 'settings',
  'qr-codes': 'settings',
}

const TABS: { key: HelpDeskTab; label: string; icon: typeof LayoutDashboard; requiresManage?: boolean }[] = [
  { key: 'tickets', label: 'Tickets', icon: List },
  { key: 'insights', label: 'Insights', icon: BarChart3, requiresManage: true },
  { key: 'settings', label: 'Settings', icon: Settings, requiresManage: true },
]

const SETTINGS_SUB_TABS: { key: SettingsSubTab; label: string; icon: typeof Route }[] = [
  { key: 'routing', label: 'Routing', icon: Route },
  { key: 'forms', label: 'Forms', icon: FileText },
  { key: 'magic-links', label: 'Magic Links', icon: Link2 },
  { key: 'qr-codes', label: 'QR Codes', icon: QrCode },
]

function ITContent() {
  usePageTitle('IT Help Desk')
  useTrackModuleVisit('it')
  useITTicketRealtime()
  const router = useRouter()
  const searchParams = useSearchParams()
  const p = useITPermissions()
  const { user } = useAuth()
  const { activeSchoolId, activeSchool, isMultiSchool } = useActiveSchool()

  // Redirect old tab URLs to new routes
  useEffect(() => {
    const tabParam = searchParams?.get('tab')
    if (tabParam && TAB_REDIRECTS[tabParam]) {
      router.replace(TAB_REDIRECTS[tabParam])
    }
  }, [searchParams, router])

  const queryClient = useQueryClient()
  const canSeeManageTabs = p.isOnITTeam || p.canManage
  const { aiAvailable } = useAiAvailability()

  const getDefaultTab = (): HelpDeskTab => {
    const paramTab = searchParams?.get('tab')
    // Handle old "board" param — redirect to tickets tab with board view
    if (paramTab === 'board') return 'tickets'
    // Map old tab names to new structure
    if (paramTab && OLD_TAB_MAP[paramTab]) return OLD_TAB_MAP[paramTab]
    if (paramTab && ['tickets', 'insights', 'settings'].includes(paramTab)) {
      return paramTab as HelpDeskTab
    }
    return 'tickets'
  }

  const [activeTab, setActiveTab] = useState<HelpDeskTab>('tickets')
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>('routing')

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

  // Handle old "board" tab param → set view mode to board and clean URL
  useEffect(() => {
    const paramTab = searchParams?.get('tab')
    if (paramTab === 'board') {
      setViewMode('board')
      window.history.replaceState(null, '', '/it?tab=tickets')
    }
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
  const [forceManualForm, setForceManualForm] = useState(false)

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
  const { data: membersRaw = [] } = useQuery({
    queryKey: ['it-members'],
    queryFn: () => fetchApi<{ id: string; firstName: string; lastName: string }[]>('/api/settings/users'),
    staleTime: 5 * 60_000,
    enabled: p.canManage,
  })
  const members = Array.isArray(membersRaw) ? membersRaw : []

  const handleTabChange = (tab: HelpDeskTab) => {
    setActiveTab(tab)
    const url = tab === 'tickets' ? '/it' : `/it?tab=${tab}`
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
          Get help and track your requests
        </motion.p>
        {isMultiSchool && (
          <motion.p variants={fadeInUp} className="text-xs font-medium text-slate-500 mt-1">
            Viewing: <span className="text-slate-900">{activeSchool?.name ?? 'All Schools'}</span>
          </motion.p>
        )}
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
      <div
        role="tabpanel"
        id="tabpanel-tickets"
        aria-labelledby="tab-tickets"
        className={activeTab === 'tickets' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
      >
        {viewMode === 'board' && canSeeManageTabs ? (
          <ITKanbanBoard
            onTicketClick={setDetailTicketId}
            onCreateTicket={() => setShowCreate(true)}
            scope={scope}
            currentUserId={user.id || undefined}
            activeSchoolId={activeSchoolId}
          />
        ) : (
          <ITTicketsList
            onViewTicket={setDetailTicketId}
            onCreateTicket={() => setShowCreate(true)}
            canManage={p.canManage}
            scope={scope}
            currentUserId={user.id || undefined}
            activeSchoolId={activeSchoolId}
          />
        )}
      </div>

      {/* Insights tab (formerly Dashboard) — managers/admins only */}
      {canSeeManageTabs && (
        <div
          role="tabpanel"
          id="tabpanel-insights"
          aria-labelledby="tab-insights"
          className={activeTab === 'insights' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
        >
          <ITDashboard
            onViewTicket={setDetailTicketId}
            onCreateTicket={() => setShowCreate(true)}
            activeSchoolId={activeSchoolId}
          />
        </div>
      )}

      {/* Settings tab — managers/admins only */}
      {canSeeManageTabs && activeTab === 'settings' && (
        <div
          role="tabpanel"
          id="tabpanel-settings"
          aria-labelledby="tab-settings"
          className="animate-[fadeIn_200ms_ease-out]"
        >
          {/* Settings sub-tabs */}
          <div className="flex items-center gap-1 mb-5 border-b border-slate-100 pb-3">
            {SETTINGS_SUB_TABS.map(({ key, label, icon: SubIcon }) => (
              <button
                key={key}
                onClick={() => setSettingsSubTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                  settingsSubTab === key
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <SubIcon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {settingsSubTab === 'routing' && <TicketRoutingTab defaultModule="IT" />}
          {settingsSubTab === 'forms' && <FormsTab aiAvailable={aiAvailable} />}
          {settingsSubTab === 'magic-links' && <ITMagicLinksTab />}
          {settingsSubTab === 'qr-codes' && <QrCodeManager />}
        </div>
      )}

      {/* Detail drawer */}
      {detailTicketId && (
        <ITTicketDetail
          ticketId={detailTicketId}
          isOpen
          onClose={() => setDetailTicketId(null)}
          canManage={p.canManage}
          members={members as { id: string; firstName: string; lastName: string }[]}
        />
      )}

      {/* Create drawer — AI chat when available, manual form when not */}
      {showCreate && (
        aiAvailable && !forceManualForm ? (
          <AiTicketIntakeDrawer
            isOpen
            onClose={() => setShowCreate(false)}
            onTicketCreated={() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.itTickets.all })
              queryClient.invalidateQueries({ queryKey: queryKeys.itBoard.all })
              queryClient.invalidateQueries({ queryKey: queryKeys.itDashboard.all })
            }}
            onSwitchToManual={() => {
              setForceManualForm(true)
              setShowCreate(true)
            }}
          />
        ) : (
          <SupportRequestDrawer
            isOpen
            onClose={() => { setShowCreate(false); setForceManualForm(false) }}
            module="IT"
            onSubmitted={() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.itTickets.all })
              queryClient.invalidateQueries({ queryKey: queryKeys.itBoard.all })
              queryClient.invalidateQueries({ queryKey: queryKeys.itDashboard.all })
            }}
          />
        )
      )}
    </div>
  )
}

// ─── Forms Tab ────────────────────────────────────────────────────────────────

const IT_CATEGORY_KEYS = [
  { key: 'HARDWARE', label: 'Hardware', icon: Laptop, color: 'text-slate-600', bg: 'bg-slate-50' },
  { key: 'SOFTWARE', label: 'Software', icon: Code, color: 'text-blue-600', bg: 'bg-blue-50' },
  { key: 'ACCOUNT_PASSWORD', label: 'Accounts & Passwords', icon: KeyRound, color: 'text-amber-600', bg: 'bg-amber-50' },
  { key: 'NETWORK', label: 'Network', icon: Wifi, color: 'text-green-600', bg: 'bg-green-50' },
  { key: 'DISPLAY_AV', label: 'Displays & A/V', icon: Projector, color: 'text-purple-600', bg: 'bg-purple-50' },
  { key: 'OTHER', label: 'Other', icon: HelpCircle, color: 'text-slate-500', bg: 'bg-slate-50' },
]

function FormsTab({ aiAvailable }: { aiAvailable: boolean }) {
  const [editingCategory, setEditingCategory] = useState<string | null>(null)

  const editingCat = IT_CATEGORY_KEYS.find((c) => c.key === editingCategory)

  // Editing view
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

          {aiAvailable && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-2 text-xs text-blue-700 mb-4">
              AI uses these fields to know what to ask during the conversation.
            </div>
          )}

          <CategoryFormEditor
            key={editingCat.key}
            categoryKey={editingCat.key.toLowerCase()}
            categoryLabel={editingCat.label}
            module="IT"
          />
        </div>
      </div>
    )
  }

  // Card grid view
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Ticket Forms</h3>
        <p className="text-sm text-slate-500 mt-0.5">
          {aiAvailable
            ? 'Each category has its own intake form. The AI uses these fields to guide the conversation.'
            : 'Each IT category has its own intake form. Click a category to customize what fields appear.'}
        </p>
      </div>

      {aiAvailable && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm text-blue-800">
          AI is enabled. Field definitions tell the AI what information to gather during the conversation.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {IT_CATEGORY_KEYS.map((cat) => {
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

export default function ITPage() {
  return (
    <PagePadding>
      <ITPageShell>
        <Suspense fallback={null}>
          <ITContent />
        </Suspense>
      </ITPageShell>
    </PagePadding>
  )
}
