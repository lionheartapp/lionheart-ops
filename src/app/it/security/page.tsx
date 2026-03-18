'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAnimatedTabIndicator } from '@/lib/hooks/useAnimatedTabIndicator'
import TabIndicator from '@/components/ui/TabIndicator'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { useITPermissions } from '@/lib/hooks/useITPermissions'
import ITPageShell from '@/components/it/ITPageShell'
import ITContentFiltersTab from '@/components/it/ITContentFiltersTab'
import ITSecurityIncidentsTab from '@/components/it/ITSecurityIncidentsTab'
import ITIntelligenceTab from '@/components/it/ITIntelligenceTab'
import ITDeviceDetailDrawer from '@/components/it/ITDeviceDetailDrawer'
import { Shield, ShieldBan, Brain } from 'lucide-react'

type SecurityTab = 'content-filters' | 'security-incidents' | 'intelligence'

const TABS: { key: SecurityTab; label: string; icon: typeof Shield }[] = [
  { key: 'content-filters', label: 'Content Filters', icon: Shield },
  { key: 'security-incidents', label: 'Security Incidents', icon: ShieldBan },
  { key: 'intelligence', label: 'Intelligence', icon: Brain },
]

function SecurityContent() {
  const p = useITPermissions()
  const [activeTab, setActiveTab] = useState<SecurityTab>('content-filters')

  // Device detail drawer for Intelligence's onViewDevice
  const [detailDeviceId, setDetailDeviceId] = useState<string | null>(null)

  const visibleTabs = TABS.filter(({ key }) => {
    if (key === 'content-filters') return p.canViewContentFilters
    if (key === 'security-incidents') return p.canViewSecurityIncidents
    if (key === 'intelligence') return p.canViewIntelligence
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
        <motion.h1 variants={fadeInUp} className="text-2xl font-semibold text-slate-900">
          IT Security
        </motion.h1>
        <motion.p variants={fadeInUp} className="text-sm text-slate-500 mt-1">
          Content filtering, security incidents, and threat intelligence
        </motion.p>
      </motion.div>

      <div ref={tabContainerRef} className="relative flex gap-1 border-b border-slate-200 mb-6">
        {visibleTabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            ref={(el) => setTabRef(key, el)}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === key ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
        <TabIndicator style={indicatorStyle} />
      </div>

      {p.canViewContentFilters && (
        <div
          className={activeTab === 'content-filters' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
          aria-hidden={activeTab !== 'content-filters'}
        >
          <ITContentFiltersTab canManage={p.canManageFilters} canConfigure={p.canConfigureFilters} canViewAdminOnly={p.canViewCIPAAudit} />
        </div>
      )}

      {p.canViewSecurityIncidents && (
        <div
          className={activeTab === 'security-incidents' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
          aria-hidden={activeTab !== 'security-incidents'}
        >
          <ITSecurityIncidentsTab canCreate={p.canCreateSecurityIncident} canManage={p.canManageSecurityIncidents} />
        </div>
      )}

      {p.canViewIntelligence && (
        <div
          className={activeTab === 'intelligence' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
          aria-hidden={activeTab !== 'intelligence'}
        >
          <ITIntelligenceTab canManage={p.canViewIntelligence} canConfigure={p.canConfigureDevices} onViewDevice={setDetailDeviceId} />
        </div>
      )}

      {/* Device detail drawer for Intelligence */}
      <ITDeviceDetailDrawer
        deviceId={detailDeviceId}
        isOpen={!!detailDeviceId}
        onClose={() => setDetailDeviceId(null)}
        canManage={p.canManageDevices}
      />
    </div>
  )
}

export default function ITSecurityPage() {
  return (
    <ITPageShell>
      <SecurityContent />
    </ITPageShell>
  )
}
