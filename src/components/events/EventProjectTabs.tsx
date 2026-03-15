'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  ClipboardList,
  FileText,
  Truck,
  DollarSign,
  CheckSquare,
  MessageSquare,
} from 'lucide-react'
import { tabContent } from '@/lib/animations'
import { EventOverviewTab } from './EventOverviewTab'
import { EventScheduleTab } from './EventScheduleTab'
import { EventTasksTab } from './EventTasksTab'
import { EventPeopleTab } from './EventPeopleTab'
import { EventDocumentsTab } from './EventDocumentsTab'
import { EventLogisticsTab } from './EventLogisticsTab'
import { EventBudgetTab } from './EventBudgetTab'
import { EventCommsTab } from './EventCommsTab'
import { RegistrationTab } from './project/RegistrationTab'
import type { EventProject } from '@/lib/hooks/useEventProject'

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabId = 'overview' | 'schedule' | 'people' | 'registration' | 'documents' | 'logistics' | 'budget' | 'tasks' | 'comms'

interface TabDef {
  id: TabId
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'schedule', label: 'Schedule', icon: CalendarDays },
  { id: 'people', label: 'People', icon: Users },
  { id: 'registration', label: 'Registration', icon: ClipboardList },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'logistics', label: 'Logistics', icon: Truck },
  { id: 'budget', label: 'Budget', icon: DollarSign },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'comms', label: 'Comms', icon: MessageSquare },
]

// ─── Animated Tab Indicator ───────────────────────────────────────────────────

function useAnimatedTabIndicator(activeTab: TabId, containerRef: React.RefObject<HTMLDivElement | null>) {
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })

  useEffect(() => {
    if (!containerRef.current) return
    const activeEl = containerRef.current.querySelector<HTMLElement>(`[data-tab="${activeTab}"]`)
    if (!activeEl) return
    const containerRect = containerRef.current.getBoundingClientRect()
    const tabRect = activeEl.getBoundingClientRect()
    setIndicatorStyle({
      left: tabRect.left - containerRect.left,
      width: tabRect.width,
    })
  }, [activeTab, containerRef])

  return indicatorStyle
}

// ─── Component ───────────────────────────────────────────────────────────────

interface EventProjectTabsProps {
  project: EventProject
}

export function EventProjectTabs({ project }: EventProjectTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const initialTab = (searchParams.get('tab') as TabId) || 'overview'
  const [activeTab, setActiveTab] = useState<TabId>(
    TABS.some((t) => t.id === initialTab) ? initialTab : 'overview'
  )

  const tabsContainerRef = useRef<HTMLDivElement>(null)
  const indicatorStyle = useAnimatedTabIndicator(activeTab, tabsContainerRef)

  function handleTabChange(tabId: TabId) {
    setActiveTab(tabId)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tabId)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const defaultDate = project.startsAt
    ? project.startsAt.split('T')[0]
    : undefined

  function renderTab() {
    switch (activeTab) {
      case 'overview':
        return <EventOverviewTab project={project} />
      case 'schedule':
        return <EventScheduleTab eventProjectId={project.id} defaultDate={defaultDate} />
      case 'people':
        return <EventPeopleTab eventProjectId={project.id} />
      case 'registration':
        return <RegistrationTab eventProjectId={project.id} />
      case 'documents':
        return <EventDocumentsTab eventProjectId={project.id} />
      case 'logistics':
        return <EventLogisticsTab eventProjectId={project.id} />
      case 'budget':
        return <EventBudgetTab eventProjectId={project.id} />
      case 'tasks':
        return <EventTasksTab eventProjectId={project.id} />
      case 'comms':
        return <EventCommsTab eventProjectId={project.id} />
      default:
        return <EventOverviewTab project={project} />
    }
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="relative border-b border-gray-200 mb-6">
        {/* Scrollable tab list */}
        <div
          ref={tabsContainerRef}
          className="flex overflow-x-auto scrollbar-none -mb-px"
          style={{ scrollbarWidth: 'none' }}
        >
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                data-tab={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer flex-shrink-0 ${
                  isActive ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-500' : 'text-gray-400'}`} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Animated aurora gradient indicator */}
        <motion.div
          className="absolute bottom-0 h-0.5 rounded-full"
          style={{
            background: 'linear-gradient(90deg, #3B82F6 0%, #6366F1 100%)',
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }}
          animate={{ left: indicatorStyle.left, width: indicatorStyle.width }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={tabContent}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {renderTab()}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
