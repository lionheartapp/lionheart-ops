'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAnimatedTabIndicator } from '@/lib/hooks/useAnimatedTabIndicator'
import TabIndicator from '@/components/ui/TabIndicator'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { useITPermissions } from '@/lib/hooks/useITPermissions'
import ITPageShell from '@/components/it/ITPageShell'
import ITDeploymentTab from '@/components/it/ITDeploymentTab'
import ITDeploymentBatchDetail from '@/components/it/ITDeploymentBatchDetail'
import ITDeploymentCreateDrawer from '@/components/it/ITDeploymentCreateDrawer'
import ITDamageReportDrawer from '@/components/it/ITDamageReportDrawer'
import ITProvisioningTab from '@/components/it/ITProvisioningTab'
import ITSummerTab from '@/components/it/ITSummerTab'
import { Rocket, UserCog, Sun } from 'lucide-react'

type LifecycleTab = 'deployment' | 'provisioning' | 'summer'

const TABS: { key: LifecycleTab; label: string; icon: typeof Rocket }[] = [
  { key: 'deployment', label: 'Deployment', icon: Rocket },
  { key: 'provisioning', label: 'Provisioning', icon: UserCog },
  { key: 'summer', label: 'Summer', icon: Sun },
]

function LifecycleContent() {
  const p = useITPermissions()
  const [activeTab, setActiveTab] = useState<LifecycleTab>('deployment')

  // Drill-in state
  const [deploymentBatchId, setDeploymentBatchId] = useState<string | null>(null)
  const [showDeploymentCreate, setShowDeploymentCreate] = useState(false)
  const [damageReportBatchId, setDamageReportBatchId] = useState<string | null>(null)

  const visibleTabs = TABS.filter(({ key }) => {
    if (key === 'deployment') return p.canAccessDeployment
    if (key === 'provisioning') return p.canAccessProvisioning
    if (key === 'summer') return p.canManage
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
          Device Lifecycle
        </motion.h1>
        <motion.p variants={fadeInUp} className="text-sm text-slate-500 mt-1">
          Deployment, provisioning, and summer device management
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

      {p.canAccessDeployment && (
        <div
          className={activeTab === 'deployment' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
          aria-hidden={activeTab !== 'deployment'}
        >
          {deploymentBatchId ? (
            <ITDeploymentBatchDetail
              batchId={deploymentBatchId}
              onBack={() => setDeploymentBatchId(null)}
              canManage={p.canManageDeployment}
              canProcess={p.canProcessDeployment}
              onOpenDamageReport={setDamageReportBatchId}
            />
          ) : (
            <ITDeploymentTab
              canManage={p.canManageDeployment}
              onViewBatch={setDeploymentBatchId}
              onCreateBatch={() => setShowDeploymentCreate(true)}
            />
          )}
        </div>
      )}

      {p.canAccessProvisioning && (
        <div
          className={activeTab === 'provisioning' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
          aria-hidden={activeTab !== 'provisioning'}
        >
          <ITProvisioningTab canManage={p.canManageProvisioning} canView={p.canViewProvisioning} />
        </div>
      )}

      {p.canManage && (
        <div
          className={activeTab === 'summer' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
          aria-hidden={activeTab !== 'summer'}
        >
          <ITSummerTab canManage={p.canManage} />
        </div>
      )}

      {/* Drawers */}
      <ITDeploymentCreateDrawer
        isOpen={showDeploymentCreate}
        onClose={() => setShowDeploymentCreate(false)}
      />
      <ITDamageReportDrawer
        batchId={damageReportBatchId}
        isOpen={!!damageReportBatchId}
        onClose={() => setDamageReportBatchId(null)}
      />
    </div>
  )
}

export default function ITLifecyclePage() {
  return (
    <ITPageShell>
      <LifecycleContent />
    </ITPageShell>
  )
}
