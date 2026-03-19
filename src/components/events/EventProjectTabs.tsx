'use client'

import { useState, useEffect, useRef, Component, type ReactNode, type ErrorInfo } from 'react'
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
  QrCode,
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
import { PresenceBar } from './comms/PresenceBar'
import type { EventProject } from '@/lib/hooks/useEventProject'

// ─── Tab Error Boundary ──────────────────────────────────────────────────────

interface TabErrorState { hasError: boolean; error: Error | null }

class TabErrorBoundary extends Component<{ children: ReactNode; tabName: string }, TabErrorState> {
  constructor(props: { children: ReactNode; tabName: string }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): TabErrorState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[TabErrorBoundary] ${this.props.tabName} tab crashed:`, error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <p className="text-sm font-semibold text-slate-900 mb-2">This tab encountered an error</p>
          <p className="text-xs text-red-600 font-mono bg-red-50 p-3 rounded-lg mb-4 max-w-xl mx-auto break-words">
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

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

// ─── Day-Of visibility helper ─────────────────────────────────────────────────

function shouldShowDayOfButton(project: EventProject): boolean {
  if (project.status === 'IN_PROGRESS') return true
  if (!project.startsAt) return false
  const startsAt = new Date(project.startsAt)
  const now = new Date()
  const hoursUntilStart = (startsAt.getTime() - now.getTime()) / (1000 * 60 * 60)
  return hoursUntilStart >= 0 && hoursUntilStart <= 24
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

  // Read current user ID from localStorage (set by server auth flow)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUserId(localStorage.getItem('user-id'))
    }
  }, [])

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
  const eventStartDate = project.startsAt ? project.startsAt.split('T')[0] : undefined
  const eventEndDate = project.endsAt ? project.endsAt.split('T')[0] : undefined

  function renderTab() {
    switch (activeTab) {
      case 'overview':
        return <EventOverviewTab project={project} />
      case 'schedule':
        return (
          <EventScheduleTab
            eventProjectId={project.id}
            defaultDate={defaultDate}
            eventStartDate={eventStartDate}
            eventEndDate={eventEndDate}
          />
        )
      case 'people':
        return <EventPeopleTab eventProjectId={project.id} />
      case 'registration':
        return <RegistrationTab eventProjectId={project.id} />
      case 'documents':
        return <EventDocumentsTab eventProjectId={project.id} />
      case 'logistics':
        return <EventLogisticsTab eventProjectId={project.id} project={project} />
      case 'budget':
        return <EventBudgetTab eventProjectId={project.id} />
      case 'tasks':
        return <EventTasksTab eventProjectId={project.id} />
      case 'comms':
        return (
          <EventCommsTab
            eventProjectId={project.id}
            eventTitle={project.title}
            eventStartDate={project.startsAt ? new Date(project.startsAt) : null}
          />
        )
      default:
        return <EventOverviewTab project={project} />
    }
  }

  return (
    <div>
      {/* Tab bar with PresenceBar */}
      <div className="relative border-b border-slate-200 mb-6">
        {/* Tab row with presence bar at right */}
        <div className="flex items-center">
          {/* Scrollable tab list */}
          <div
            ref={tabsContainerRef}
            className="flex flex-1 overflow-x-auto scrollbar-none -mb-px"
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
                    isActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-500' : 'text-slate-400'}`} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Presence bar — active collaborators */}
          {currentUserId && (
            <div className="flex-shrink-0 ml-4 mb-1 pb-1">
              <PresenceBar
                eventProjectId={project.id}
                currentUserId={currentUserId}
                activeTab={activeTab}
              />
            </div>
          )}

          {/* Day-Of Mode button — visible when event is imminent or in progress */}
          {shouldShowDayOfButton(project) && (
            <div className="flex-shrink-0 ml-3 mb-1 pb-1">
              <button
                onClick={() => router.push(`/events/${project.id}/dayof`)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer whitespace-nowrap"
              >
                <QrCode className="w-3.5 h-3.5" />
                Launch Day-Of Mode
              </button>
            </div>
          )}
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
          <TabErrorBoundary tabName={activeTab} key={`error-${activeTab}`}>
            {renderTab()}
          </TabErrorBoundary>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
