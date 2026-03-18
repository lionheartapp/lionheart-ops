'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAnimatedTabIndicator } from '@/lib/hooks/useAnimatedTabIndicator'
import TabIndicator from '@/components/ui/TabIndicator'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { useITPermissions } from '@/lib/hooks/useITPermissions'
import ITPageShell from '@/components/it/ITPageShell'
import ITDevicesTab from '@/components/it/ITDevicesTab'
import ITDeviceDetailDrawer from '@/components/it/ITDeviceDetailDrawer'
import ITDeviceCreateDrawer from '@/components/it/ITDeviceCreateDrawer'
import ITStudentsTab from '@/components/it/ITStudentsTab'
import ITStudentDetailDrawer from '@/components/it/ITStudentDetailDrawer'
import ITStudentCreateDrawer from '@/components/it/ITStudentCreateDrawer'
import ITLoanersTab from '@/components/it/ITLoanersTab'
import { HardDrive, GraduationCap, Package } from 'lucide-react'

type DevicesTab = 'devices' | 'students' | 'loaners'

const TABS: { key: DevicesTab; label: string; icon: typeof HardDrive }[] = [
  { key: 'devices', label: 'Devices', icon: HardDrive },
  { key: 'students', label: 'Students', icon: GraduationCap },
  { key: 'loaners', label: 'Loaners', icon: Package },
]

function DevicesContent() {
  const p = useITPermissions()
  const [activeTab, setActiveTab] = useState<DevicesTab>('devices')

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

  const { containerRef: tabContainerRef, setTabRef, indicatorStyle } = useAnimatedTabIndicator(activeTab, [p.loaded])

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
          IT Devices
        </motion.h1>
        <motion.p variants={fadeInUp} className="text-sm text-slate-500 mt-1">
          Manage devices, student assignments, and loaner equipment
        </motion.p>
      </motion.div>

      {/* Tab bar */}
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

      {/* Tab content */}
      {p.canReadDevices && (
        <div
          className={activeTab === 'devices' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
          aria-hidden={activeTab !== 'devices'}
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
          className={activeTab === 'students' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
          aria-hidden={activeTab !== 'students'}
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
          className={activeTab === 'loaners' ? 'animate-[fadeIn_200ms_ease-out]' : 'hidden'}
          aria-hidden={activeTab !== 'loaners'}
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
    <ITPageShell>
      <DevicesContent />
    </ITPageShell>
  )
}
