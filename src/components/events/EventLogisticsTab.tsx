'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bus, Home, Users, Activity, HeartPulse, Printer } from 'lucide-react'
import { tabContent, staggerContainer, fadeInUp } from '@/lib/animations'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { useGroups } from '@/lib/hooks/useEventGroups'
import GroupDragBoard from './groups/GroupDragBoard'
import ActivityManager from './groups/ActivityManager'
import DietaryMedicalReport from './groups/DietaryMedicalReport'
import EventPDFGenerator from './groups/EventPDFGenerator'
import type { EventProject } from '@/lib/hooks/useEventProject'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface EventLogisticsTabProps {
  eventProjectId: string
  project?: EventProject
}

type LogisticsTab = 'buses' | 'cabins' | 'small-groups' | 'activities' | 'dietary' | 'print'

// ─── Tab definitions ─────────────────────────────────────────────────────────────

const LOGISTICS_TABS: Array<{
  id: LogisticsTab
  label: string
  icon: React.ElementType
  medical?: boolean
}> = [
  { id: 'buses', label: 'Buses', icon: Bus },
  { id: 'cabins', label: 'Cabins', icon: Home },
  { id: 'small-groups', label: 'Small Groups', icon: Users },
  { id: 'activities', label: 'Activities', icon: Activity },
  { id: 'dietary', label: 'Dietary/Medical', icon: HeartPulse, medical: true },
  { id: 'print', label: 'Print', icon: Printer },
]

// ─── Quick Stats ─────────────────────────────────────────────────────────────────

function QuickStats({ eventProjectId }: { eventProjectId: string }) {
  const { data: busGroups = [] } = useGroups(eventProjectId, 'BUS')
  const { data: cabinGroups = [] } = useGroups(eventProjectId, 'CABIN')
  const { data: smallGroups = [] } = useGroups(eventProjectId, 'SMALL_GROUP')

  const totalGroups = busGroups.length + cabinGroups.length + smallGroups.length
  const totalAssigned = [
    ...busGroups,
    ...cabinGroups,
    ...smallGroups,
  ].reduce((sum, g) => sum + g.assignmentCount, 0)

  return (
    <div className="flex items-center gap-4 text-xs text-gray-500">
      <span>
        <strong className="text-gray-800 font-semibold">{totalGroups}</strong> groups
      </span>
      <span className="text-gray-300">·</span>
      <span>
        <strong className="text-gray-800 font-semibold">{totalAssigned}</strong> assigned
      </span>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────────

export function EventLogisticsTab({ eventProjectId, project }: EventLogisticsTabProps) {
  const [activeTab, setActiveTab] = useState<LogisticsTab>('buses')
  const { data: perms } = usePermissions()

  const canViewMedical =
    perms?.legacyRole === 'super-admin' || perms?.legacyRole === 'admin'

  // Event info for PDFs
  const eventName = project?.title ?? 'Event'
  const eventDate = project?.startsAt
    ? new Date(project.startsAt).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : ''

  function renderTabContent() {
    switch (activeTab) {
      case 'buses':
        return (
          <GroupDragBoard
            key="buses"
            eventProjectId={eventProjectId}
            groupType="BUS"
          />
        )
      case 'cabins':
        return (
          <GroupDragBoard
            key="cabins"
            eventProjectId={eventProjectId}
            groupType="CABIN"
          />
        )
      case 'small-groups':
        return (
          <GroupDragBoard
            key="small-groups"
            eventProjectId={eventProjectId}
            groupType="SMALL_GROUP"
          />
        )
      case 'activities':
        return <ActivityManager eventProjectId={eventProjectId} />
      case 'dietary':
        return (
          <DietaryMedicalReport
            eventProjectId={eventProjectId}
            canViewMedical={canViewMedical}
          />
        )
      case 'print':
        return (
          <EventPDFGenerator
            eventProjectId={eventProjectId}
            eventName={eventName}
            eventDate={eventDate}
            canViewMedical={canViewMedical}
          />
        )
      default:
        return null
    }
  }

  return (
    <motion.div
      variants={staggerContainer()}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header row */}
      <motion.div variants={fadeInUp} className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Logistics & Groups</h2>
          <QuickStats eventProjectId={eventProjectId} />
        </div>
      </motion.div>

      {/* Sub-tabs */}
      <motion.div variants={fadeInUp} className="border-b border-gray-200">
        <nav className="flex overflow-x-auto scrollbar-none -mb-px gap-1" style={{ scrollbarWidth: 'none' }}>
          {LOGISTICS_TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap
                  border-b-2 transition-colors cursor-pointer flex-shrink-0
                  ${
                    isActive
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-indigo-500' : 'text-gray-400'
                  }`}
                />
                {tab.label}
                {tab.medical && !canViewMedical && (
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 ml-0.5" />
                )}
              </button>
            )
          })}
        </nav>
      </motion.div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={tabContent}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {renderTabContent()}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
