'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAnimatedTabIndicator } from '@/lib/hooks/useAnimatedTabIndicator'
import TabIndicator from '@/components/ui/TabIndicator'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { useITPermissions } from '@/lib/hooks/useITPermissions'
import ITPageShell from '@/components/it/ITPageShell'
import PagePadding from '@/components/PagePadding'
import { BarChart3, FileText, FileCheck, RefreshCw } from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'

const ITAnalyticsTab = dynamic(() => import('@/components/it/ITAnalyticsTab'), {
  loading: () => <AdminTabSkeleton />,
})
const ITReportsTab = dynamic(() => import('@/components/it/ITReportsTab'), {
  loading: () => <AdminTabSkeleton />,
})
const ITERateUnifiedTab = dynamic(() => import('@/components/it/ITERateUnifiedTab'), {
  loading: () => <AdminTabSkeleton />,
})
const ITSyncTab = dynamic(() => import('@/components/it/ITSyncTab'), {
  loading: () => <AdminTabSkeleton />,
})

type AdminTab = 'analytics' | 'reports' | 'erate' | 'sync'

const VALID_TABS: readonly AdminTab[] = ['analytics', 'reports', 'erate', 'sync'] as const

function isAdminTab(value: string | null): value is AdminTab {
  return value !== null && (VALID_TABS as readonly string[]).includes(value)
}

const TABS: { key: AdminTab; label: string; icon: typeof BarChart3 }[] = [
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'erate', label: 'E-Rate', icon: FileCheck },
  { key: 'sync', label: 'Sync', icon: RefreshCw },
]

function AdminTabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-28 rounded-xl bg-slate-100 border border-slate-200" />
        ))}
      </div>
      <div className="h-72 rounded-xl bg-slate-100 border border-slate-200" />
    </div>
  )
}

function AdminContent(): JSX.Element | null {
  usePageTitle('IT Admin')
  const p = useITPermissions()
  const searchParams = useSearchParams()
  const visibleTabs = TABS.filter(({ key }) => {
    if (key === 'analytics') return p.canViewITAnalytics
    if (key === 'reports') return p.canViewITBoardReports
    if (key === 'erate') return p.canViewERate
    if (key === 'sync') return p.canManageSync
    return false
  })

  const [activeTab, setActiveTab] = useState<AdminTab>((visibleTabs[0]?.key as AdminTab) || 'analytics')

  // Honor ?tab=<key> deep-links (e.g. from the dashboard widget or the
  // legacy /it/erate redirect). Runs once permissions and the requested tab
  // are available; falls back silently if the tab is unknown or denied.
  useEffect(() => {
    if (!p.loaded) return
    const requested = searchParams.get('tab')
    if (!isAdminTab(requested)) return
    const allowed = visibleTabs.some((t) => t.key === requested)
    if (allowed) setActiveTab(requested)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.loaded, searchParams])

  const { containerRef: tabContainerRef, setTabRef, indicatorStyle } = useAnimatedTabIndicator(activeTab, [p.loaded])

  if (!p.loaded) return null

  return (
    <div>
      <motion.div
        className="mb-6"
        initial="hidden"
        animate="visible"
        variants={staggerContainer(0.08, 0.05)}
      >
        <motion.h1 variants={fadeInUp} className="text-2xl font-semibold text-slate-900">
          Reports & Admin
        </motion.h1>
        <motion.p variants={fadeInUp} className="text-sm text-slate-500 mt-1">
          Analytics, reports, E-Rate compliance, and data sync
        </motion.p>
      </motion.div>

      <div ref={tabContainerRef} role="tablist" aria-label="Admin tabs" className="relative flex gap-1 border-b border-slate-200 mb-6">
        {visibleTabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            ref={(el) => setTabRef(key, el)}
            role="tab"
            aria-selected={activeTab === key}
            id={`tab-${key}`}
            aria-controls={`tabpanel-${key}`}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded ${
              activeTab === key ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
        <TabIndicator style={indicatorStyle} />
      </div>

      {p.canViewITAnalytics && (
        <div
          role="tabpanel"
          id="tabpanel-analytics"
          aria-labelledby="tab-analytics"
          className={activeTab === 'analytics' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
        >
          {activeTab === 'analytics' && (
            <ITAnalyticsTab canViewBoardReports={p.canViewITBoardReports} />
          )}
        </div>
      )}

      {p.canViewITBoardReports && (
        <div
          role="tabpanel"
          id="tabpanel-reports"
          aria-labelledby="tab-reports"
          className={activeTab === 'reports' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
        >
          {activeTab === 'reports' && <ITReportsTab />}
        </div>
      )}

      {p.canViewERate && (
        <div
          role="tabpanel"
          id="tabpanel-erate"
          aria-labelledby="tab-erate"
          className={activeTab === 'erate' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
        >
          {activeTab === 'erate' && <ITERateUnifiedTab canManage={p.canManageERate} />}
        </div>
      )}

      {p.canManageSync && (
        <div
          role="tabpanel"
          id="tabpanel-sync"
          aria-labelledby="tab-sync"
          className={activeTab === 'sync' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
        >
          {activeTab === 'sync' && <ITSyncTab canManage={p.canManageSync} />}
        </div>
      )}
    </div>
  )
}

export default function ITAdminPage() {
  return (
    <PagePadding>
      <ITPageShell>
        <AdminContent />
      </ITPageShell>
    </PagePadding>
  )
}
