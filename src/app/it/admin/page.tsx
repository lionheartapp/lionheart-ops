'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAnimatedTabIndicator } from '@/lib/hooks/useAnimatedTabIndicator'
import TabIndicator from '@/components/ui/TabIndicator'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { useITPermissions } from '@/lib/hooks/useITPermissions'
import ITPageShell from '@/components/it/ITPageShell'
import ITAnalyticsTab from '@/components/it/ITAnalyticsTab'
import ITReportsTab from '@/components/it/ITReportsTab'
import ITERateTab from '@/components/it/ITERateTab'
import ITSyncTab from '@/components/it/ITSyncTab'
import { BarChart3, FileText, FileCheck, RefreshCw } from 'lucide-react'

type AdminTab = 'analytics' | 'reports' | 'erate' | 'sync'

const TABS: { key: AdminTab; label: string; icon: typeof BarChart3 }[] = [
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'erate', label: 'E-Rate', icon: FileCheck },
  { key: 'sync', label: 'Sync', icon: RefreshCw },
]

function AdminContent() {
  const p = useITPermissions()
  const [activeTab, setActiveTab] = useState<AdminTab>('analytics')

  const visibleTabs = TABS.filter(({ key }) => {
    if (key === 'analytics') return p.canViewITAnalytics
    if (key === 'reports') return p.canViewITBoardReports
    if (key === 'erate') return p.canViewERate
    if (key === 'sync') return p.canManageSync
    return false
  })

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
        <motion.h1 variants={fadeInUp} className="text-2xl font-semibold text-gray-900">
          Reports & Admin
        </motion.h1>
        <motion.p variants={fadeInUp} className="text-sm text-gray-500 mt-1">
          Analytics, reports, E-Rate compliance, and data sync
        </motion.p>
      </motion.div>

      <div ref={tabContainerRef} className="relative flex gap-1 border-b border-gray-200 mb-6">
        {visibleTabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            ref={(el) => setTabRef(key, el)}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === key ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
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
          className={activeTab === 'analytics' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
          aria-hidden={activeTab !== 'analytics'}
        >
          <ITAnalyticsTab canViewBoardReports={p.canViewITBoardReports} />
        </div>
      )}

      {p.canViewITBoardReports && (
        <div
          className={activeTab === 'reports' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
          aria-hidden={activeTab !== 'reports'}
        >
          <ITReportsTab />
        </div>
      )}

      {p.canViewERate && (
        <div
          className={activeTab === 'erate' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
          aria-hidden={activeTab !== 'erate'}
        >
          <ITERateTab canManage={p.canManageERate} />
        </div>
      )}

      {p.canManageSync && (
        <div
          className={activeTab === 'sync' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
          aria-hidden={activeTab !== 'sync'}
        >
          <ITSyncTab canManage={p.canManageSync} />
        </div>
      )}
    </div>
  )
}

export default function ITAdminPage() {
  return (
    <ITPageShell>
      <AdminContent />
    </ITPageShell>
  )
}
