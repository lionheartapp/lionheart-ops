'use client'

import { use, useState, useEffect, Component, type ReactNode, type ErrorInfo } from 'react'
import { logger } from '@/lib/logger'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, QrCode, BookmarkPlus } from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import EventSidebar, { type TabId } from '@/components/events/EventSidebar'
import { staggerContainer, listItem, tabContent } from '@/lib/animations'
import { useEventProject, useApproveEventProject } from '@/lib/hooks/useEventProject'
import { useMyEventPermissions } from '@/lib/hooks/useEventPermissions'
import { EventOverviewTab } from '@/components/events/EventOverviewTab'
import { EventScheduleTab } from '@/components/events/EventScheduleTab'
import { EventTasksTab } from '@/components/events/EventTasksTab'
import { EventPeopleTab } from '@/components/events/EventPeopleTab'
import { EventDocumentsTab } from '@/components/events/EventDocumentsTab'
import { EventLogisticsTab } from '@/components/events/EventLogisticsTab'
import { EventBudgetTab } from '@/components/events/EventBudgetTab'
import { EventCommsTab } from '@/components/events/EventCommsTab'
import { RegistrationTab } from '@/components/events/project/RegistrationTab'
import { PresenceBar } from '@/components/events/comms/PresenceBar'
import { EventChatDrawer } from '@/components/events/comms/EventChatPanel'
import { SaveAsTemplateDialog } from '@/components/events/templates/SaveAsTemplateDialog'
import { ApprovalReviewDrawer } from '@/components/events/ApprovalReviewDrawer'
import { useToast } from '@/components/Toast'
import type { EventProject } from '@/lib/hooks/useEventProject'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  SURFACE,
  BORDER,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  WARM_CHIP,
  CARD_SHADOW,
} from '@/lib/design/warm-tokens'

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
    logger.error({ error: error.message, tabName: this.props.tabName, componentStack: errorInfo?.componentStack ?? '' }, 'TabErrorBoundary tab crashed')
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <p
            className="text-[14px] font-semibold mb-2"
            style={{ color: TEXT_PRIMARY, letterSpacing: '-0.01em' }}
          >
            This section encountered an error
          </p>
          <p
            className="text-[11.5px] font-mono p-3 rounded-xl mb-4 max-w-xl mx-auto break-words"
            style={{
              color: '#b84a4a',
              backgroundColor: 'rgba(184, 74, 74, 0.08)',
              border: '1px solid rgba(184, 74, 74, 0.15)',
            }}
          >
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-full text-[13px] font-semibold transition-all duration-200 cursor-pointer hover:-translate-y-px"
            style={{
              backgroundColor: TEXT_PRIMARY,
              color: '#ffffff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04)',
            }}
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// (Status labels live in EventSidebar — this wrapper doesn't render them.)

// ─── Day-Of visibility helper ─────────────────────────────────────────────────

function shouldShowDayOfButton(project: EventProject): boolean {
  if (project.status === 'IN_PROGRESS') return true
  if (!project.startsAt) return false
  const startsAt = new Date(project.startsAt)
  const now = new Date()
  const hoursUntilStart = (startsAt.getTime() - now.getTime()) / (1000 * 60 * 60)
  return hoursUntilStart >= 0 && hoursUntilStart <= 24
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EventProjectSkeleton() {
  return (
    <div className="animate-pulse">
      <div
        className="h-8 rounded w-2/3 mb-3"
        style={{ backgroundColor: '#ede9e0' }}
      />
      <div
        className="h-4 rounded w-1/3 mb-8"
        style={{ backgroundColor: WARM_CHIP }}
      />
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-2xl"
            style={{ backgroundColor: WARM_CHIP }}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Sidebar skeleton (matches EventSidebar shape) ─────────────────────────────

function SidebarSkeleton() {
  return (
    <aside
      className="w-[220px] flex-shrink-0 flex flex-col h-full animate-pulse"
      style={{
        backgroundColor: SURFACE,
        borderRight: `1px solid ${BORDER}`,
      }}
    >
      <div
        className="px-5 pt-[18px] pb-[14px]"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg" style={{ backgroundColor: '#ede9e0' }} />
          <div className="w-20 h-4 rounded" style={{ backgroundColor: '#ede9e0' }} />
        </div>
      </div>
      <div
        className="px-5 py-3.5 space-y-2"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <div className="w-16 h-5 rounded-full" style={{ backgroundColor: WARM_CHIP }} />
        <div className="w-full h-4 rounded" style={{ backgroundColor: '#ede9e0' }} />
        <div className="w-24 h-3 rounded" style={{ backgroundColor: WARM_CHIP }} />
      </div>
      <div className="flex-1 px-3 py-3 space-y-2">
        {[...Array(9)].map((_, i) => (
          <div
            key={i}
            className="w-full h-7 rounded-md"
            style={{ backgroundColor: WARM_CHIP }}
          />
        ))}
      </div>
    </aside>
  )
}

// ─── 404 State ────────────────────────────────────────────────────────────────

function EventNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="text-center py-16">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
        style={{ backgroundColor: WARM_CHIP }}
      >
        <AlertCircle
          className="w-7 h-7"
          strokeWidth={1.75}
          style={{ color: TEXT_PRIMARY }}
        />
      </div>
      <h3
        className="text-[17px] font-semibold mb-2"
        style={{ color: TEXT_PRIMARY, letterSpacing: '-0.015em' }}
      >
        Event not found
      </h3>
      <p className="text-[13.5px] mb-6" style={{ color: TEXT_SECONDARY }}>
        This event may have been deleted or you may not have access.
      </p>
      <button
        onClick={onBack}
        className="px-5 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-200 cursor-pointer hover:-translate-y-px"
        style={{
          backgroundColor: TEXT_PRIMARY,
          color: '#ffffff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04)',
        }}
      >
        Back to Events
      </button>
    </div>
  )
}

// ─── Tab content renderer ─────────────────────────────────────────────────────

function TabContent({ activeTab, project }: { activeTab: TabId; project: EventProject }) {
  const defaultDate = project.startsAt
    ? project.startsAt.split('T')[0]
    : undefined
  const eventStartDate = defaultDate
  const eventEndDate = project.endsAt
    ? project.endsAt.split('T')[0]
    : undefined

  switch (activeTab) {
    case 'overview':
      return <EventOverviewTab project={project} />
    case 'schedule':
      return <EventScheduleTab eventProjectId={project.id} defaultDate={defaultDate} eventStartDate={eventStartDate} eventEndDate={eventEndDate} />
    case 'people':
      return <EventPeopleTab eventProjectId={project.id} createdById={project.createdById} />
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

// ─── Tab label map ────────────────────────────────────────────────────────────

const TAB_LABELS: Record<TabId, string> = {
  overview: 'Overview',
  schedule: 'Schedule',
  people: 'Team',
  registration: 'Registration',
  documents: 'Documents',
  logistics: 'Logistics',
  budget: 'Budget',
  tasks: 'Tasks',
  comms: 'Comms',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface EventProjectPageProps {
  params: Promise<{ id: string }>
}

export default function EventProjectPage({ params }: EventProjectPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const { data: project, isLoading, error } = useEventProject(id)
  const { data: myPermissions } = useMyEventPermissions(id)
  const approveProject = useApproveEventProject(id)

  // Tab state — synced with ?tab= URL param
  const tabFromUrl = (searchParams.get('tab') as TabId) || 'overview'
  const [activeTab, setActiveTab] = useState<TabId>(tabFromUrl)

  // Keep activeTab in sync when URL changes externally (back/forward, other navigations)
  useEffect(() => {
    setActiveTab(tabFromUrl)
  }, [tabFromUrl])

  // Auth state — provides user ID, org branding, and readiness
  const { user: authUser, org: authOrg } = useAuth({ redirectTo: '' })
  const currentUserId = authUser.id ?? null
  const orgLogoUrl = authOrg.logoUrl || undefined
  const orgName = authOrg.name || undefined

  // Save as template dialog
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)

  // Approval review drawer — replaces the old one-click approve button
  const [isApprovalDrawerOpen, setIsApprovalDrawerOpen] = useState(false)

  // Chat drawer state
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatUnreadCount, setChatUnreadCount] = useState(0)

  function handleTabChange(tab: TabId) {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  async function handleApprove() {
    try {
      await approveProject.mutateAsync()
      toast('Event approved', 'success')
      setIsApprovalDrawerOpen(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to approve event', 'error')
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout customSidebar={<SidebarSkeleton />}>
        <div className="pb-8">
          <EventProjectSkeleton />
        </div>
      </DashboardLayout>
    )
  }

  // Error / not found state
  if (error || !project) {
    return (
      <DashboardLayout>
        <div className="pb-8">
          <EventNotFound onBack={() => router.push('/events')} />
        </div>
      </DashboardLayout>
    )
  }

  const sidebar = (
    <EventSidebar
      project={project}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      organizationLogoUrl={orgLogoUrl}
      organizationName={orgName}
      permissions={myPermissions}
    />
  )

  return (
    <DashboardLayout customSidebar={sidebar}>
      <div className="pb-8">
        <motion.div
          variants={staggerContainer(0.05)}
          initial="hidden"
          animate="visible"
        >
          {/* Action buttons row */}
          <motion.div variants={listItem} className="mb-6">
            <div className="flex items-center justify-end gap-2">
              {/* Presence bar with chat toggle */}
              <PresenceBar
                eventProjectId={project.id}
                currentUserId={currentUserId}
                activeTab={activeTab}
                onTabChange={(tab) => handleTabChange(tab as TabId)}
                onToggleChat={() => setIsChatOpen(prev => !prev)}
                isChatOpen={isChatOpen}
                unreadCount={chatUnreadCount}
              />

              {/* Day-Of Mode button */}
              {shouldShowDayOfButton(project) && (
                <button
                  onClick={() => router.push(`/events/${project.id}/dayof`)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-semibold transition-all duration-200 cursor-pointer hover:-translate-y-px whitespace-nowrap"
                  style={{
                    backgroundColor: TEXT_PRIMARY,
                    color: '#ffffff',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04)',
                  }}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  Day-Of Mode
                </button>
              )}

              {project.status === 'PENDING_APPROVAL' && (
                <button
                  onClick={() => setIsApprovalDrawerOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold transition-all duration-200 cursor-pointer hover:-translate-y-px"
                  style={{
                    backgroundColor: TEXT_PRIMARY,
                    color: '#ffffff',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.04)',
                  }}
                >
                  Review Approval
                </button>
              )}
            </div>
          </motion.div>

          {/* Section label — shows which tab is active, with inline actions */}
          <motion.div variants={listItem} className="flex items-center justify-between mb-4">
            <h1
              className="text-2xl font-semibold"
              style={{ color: TEXT_PRIMARY, letterSpacing: '-0.025em' }}
            >
              {TAB_LABELS[activeTab]}
            </h1>
            {activeTab === 'overview' && ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(project.status) && (
              <button
                onClick={() => setIsTemplateDialogOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold transition-colors duration-200 cursor-pointer"
                style={{ backgroundColor: WARM_CHIP, color: TEXT_PRIMARY }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ede9e0')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = WARM_CHIP)}
              >
                <BookmarkPlus className="w-4 h-4" strokeWidth={1.75} />
                Save as Template
              </button>
            )}
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
              <TabErrorBoundary tabName={activeTab} key={`error-${activeTab}`}>
                <TabContent activeTab={activeTab} project={project} />
              </TabErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
      <SaveAsTemplateDialog
        eventProjectId={project.id}
        eventTitle={project.title}
        eventType={null}
        isOpen={isTemplateDialogOpen}
        onClose={() => setIsTemplateDialogOpen(false)}
      />
      <ApprovalReviewDrawer
        isOpen={isApprovalDrawerOpen}
        onClose={() => setIsApprovalDrawerOpen(false)}
        onApprove={handleApprove}
        isApproving={approveProject.isPending}
        project={project}
      />
      <EventChatDrawer
        eventProjectId={project.id}
        currentUserId={currentUserId}
        currentUserName={authUser.name || undefined}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onUnreadChange={setChatUnreadCount}
      />
    </DashboardLayout>
  )
}
