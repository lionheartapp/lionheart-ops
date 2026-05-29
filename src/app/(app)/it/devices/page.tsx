'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAnimatedTabIndicator } from '@/lib/hooks/useAnimatedTabIndicator'
import TabIndicator from '@/components/ui/TabIndicator'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { useITPermissions } from '@/lib/hooks/useITPermissions'
import ITPageShell from '@/components/it/ITPageShell'
import PagePadding from '@/components/PagePadding'
import ITDevicesTab from '@/components/it/ITDevicesTab'
import ITDeviceDetailDrawer from '@/components/it/ITDeviceDetailDrawer'
import ITDeviceCreateDrawer from '@/components/it/ITDeviceCreateDrawer'
import ITStudentsTab from '@/components/it/ITStudentsTab'
import ITStudentDetailDrawer from '@/components/it/ITStudentDetailDrawer'
import ITStudentCreateDrawer from '@/components/it/ITStudentCreateDrawer'
import ITLoanersTab from '@/components/it/ITLoanersTab'
import { HardDrive, GraduationCap, Package } from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'

type DevicesTab = 'devices' | 'students' | 'loaners'

const TABS: { key: DevicesTab; label: string; icon: typeof HardDrive }[] = [
  { key: 'devices', label: 'Devices', icon: HardDrive },
  { key: 'students', label: 'Students', icon: GraduationCap },
  { key: 'loaners', label: 'Loaners', icon: Package },
]

function DevicesContent() {
  usePageTitle('IT Devices')
  const p = useITPermissions()
  // Drawer state
  const [detailDeviceId, setDetailDeviceId] = useState<string | null>(null)
  const [showDeviceCreate, setShowDeviceCreate] = useState(false)
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null)
  const [showStudentCreate, setShowStudentCreate] = useState(false)

  const visibleTabs = TABS.filter(({ key }) => {
    if (key === 'devices') return p.canReadDevices
    if (key === 'students') return p.canReadStudents
    if (key === 'loaners') return p.canAccessLoaners
    return false
  })

  const [activeTab, setActiveTab] = useState<DevicesTab>((visibleTabs[0]?.key as DevicesTab) || 'devices')

  const { containerRef: tabContainerRef, setTabRef, indicatorStyle } = useAnimatedTabIndicator(activeTab, [p.loaded])

  if (!p.loaded) return null
  if (visibleTabs.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h1 className="text-xl font-semibold text-slate-900">Access limited</h1>
        <p className="mt-2 text-sm text-slate-500">
          Device management is available to IT staff with device permissions.
        </p>
      </div>
    )
  }

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
          IT Devices
        </motion.h1>
        <motion.p variants={fadeInUp} className="text-sm text-slate-500 mt-1">
          Manage devices, student assignments, and loaner equipment
        </motion.p>
      </motion.div>

      {/* Tab bar */}
      <div ref={tabContainerRef} role="tablist" aria-label="Devices tabs" className="relative flex gap-1 border-b border-slate-200 mb-6">
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

      {/* Tab content */}
      {p.canReadDevices && (
        <div
          role="tabpanel"
          id="tabpanel-devices"
          aria-labelledby="tab-devices"
          className={activeTab === 'devices' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
        >
          <ITDevicesTab
            onViewDevice={setDetailDeviceId}
            onCreateDevice={() => setShowDeviceCreate(true)}
            canManage={p.canManageDevices}
          />
        </div>
      )}

      {p.canReadStudents && (
        <div
          role="tabpanel"
          id="tabpanel-students"
          aria-labelledby="tab-students"
          className={activeTab === 'students' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
        >
          <ITStudentsTab
            onViewStudent={setDetailStudentId}
            onCreateStudent={() => setShowStudentCreate(true)}
            canManage={p.canManageStudents}
          />
        </div>
      )}

      {p.canAccessLoaners && (
        <div
          role="tabpanel"
          id="tabpanel-loaners"
          aria-labelledby="tab-loaners"
          className={activeTab === 'loaners' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
        >
          <ITLoanersTab canManage={p.canManageLoaners} canCheckout={p.canCheckoutLoaner} canCheckin={p.canCheckinLoaner} />
        </div>
      )}

      {/* Drawers */}
      <ITDeviceDetailDrawer
        deviceId={detailDeviceId}
        isOpen={!!detailDeviceId}
        onClose={() => setDetailDeviceId(null)}
        canManage={p.canManageDevices}
      />
      <ITDeviceCreateDrawer
        isOpen={showDeviceCreate}
        onClose={() => setShowDeviceCreate(false)}
      />
      <ITStudentDetailDrawer
        studentId={detailStudentId}
        isOpen={!!detailStudentId}
        onClose={() => setDetailStudentId(null)}
        canManage={p.canManageStudents}
      />
      <ITStudentCreateDrawer
        isOpen={showStudentCreate}
        onClose={() => setShowStudentCreate(false)}
      />
    </div>
  )
}

export default function ITDevicesPage() {
  return (
    <PagePadding>
      <ITPageShell>
        <DevicesContent />
      </ITPageShell>
    </PagePadding>
  )
}
