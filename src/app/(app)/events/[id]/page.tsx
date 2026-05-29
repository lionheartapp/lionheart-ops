'use client'

import { use, useState, useEffect, Component, type ReactNode, type ErrorInfo } from 'react'
import dynamic from 'next/dynamic'
import { logger } from '@/lib/logger'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, QrCode, BookmarkPlus, FileText } from 'lucide-react'

import type { TabId } from '@/components/events/EventSidebar'
import { staggerContainer, listItem, tabContent } from '@/lib/animations'
import { useEventProject, useApproveEventProject } from '@/lib/hooks/useEventProject'
import { useToast } from '@/components/Toast'
import type { EventProject } from '@/lib/hooks/useEventProject'
import { useAuth } from '@/lib/hooks/useAuth'
import PagePadding from '@/components/PagePadding'
import {
  SURFACE,
  BORDER,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WARM_CHIP,
  CARD_SHADOW,
} from '@/lib/design/warm-tokens'

const EventOverviewTab = dynamic(
  () => import('@/components/events/EventOverviewTab').then((mod) => mod.EventOverviewTab),
  { loading: () => <EventTabLoading /> },
)
const EventScheduleTab = dynamic(
  () => import('@/components/events/EventScheduleTab').then((mod) => mod.EventScheduleTab),
  { loading: () => <EventTabLoading /> },
)
const EventTasksTab = dynamic(
  () => import('@/components/events/EventTasksTab').then((mod) => mod.EventTasksTab),
  { loading: () => <EventTabLoading /> },
)
const EventPeopleTab = dynamic(
  () => import('@/components/events/EventPeopleTab').then((mod) => mod.EventPeopleTab),
  { loading: () => <EventTabLoading /> },
)
const EventDocumentsTab = dynamic(
  () => import('@/components/events/EventDocumentsTab').then((mod) => mod.EventDocumentsTab),
  { loading: () => <EventTabLoading /> },
)
const EventLogisticsTab = dynamic(
  () => import('@/components/events/EventLogisticsTab').then((mod) => mod.EventLogisticsTab),
  { loading: () => <EventTabLoading /> },
)
const EventBudgetTab = dynamic(
  () => import('@/components/events/EventBudgetTab').then((mod) => mod.EventBudgetTab),
  { loading: () => <EventTabLoading /> },
)
const EventCommsTab = dynamic(
  () => import('@/components/events/EventCommsTab').then((mod) => mod.EventCommsTab),
  { loading: () => <EventTabLoading /> },
)
const EventFormLinkTab = dynamic(
  () => import('@/components/events/project/EventFormLinkTab').then((mod) => mod.EventFormLinkTab),
  { loading: () => <EventTabLoading /> },
)
const EventResponsesTab = dynamic(
  () => import('@/components/events/EventResponsesTab').then((mod) => mod.EventResponsesTab),
  { loading: () => <EventTabLoading /> },
)
const PresenceBar = dynamic(
  () => import('@/components/events/comms/PresenceBar').then((mod) => mod.PresenceBar),
  { loading: () => null },
)
const EventChatDrawer = dynamic(
  () => import('@/components/events/comms/EventChatPanel').then((mod) => mod.EventChatDrawer),
  { loading: () => null },
)
const SaveAsTemplateDialog = dynamic(
  () => import('@/components/events/templates/SaveAsTemplateDialog').then((mod) => mod.SaveAsTemplateDialog),
  { loading: () => null },
)
const ApprovalReviewDrawer = dynamic(
  () => import('@/components/events/ApprovalReviewDrawer').then((mod) => mod.ApprovalReviewDrawer),
  { loading: () => null },
)
const FormBuilderDrawer = dynamic(() => import('@/components/forms/builder/FormBuilderDrawer'), { loading: () => null })

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

function EventTabLoading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-24 rounded-2xl" style={{ backgroundColor: WARM_CHIP }} />
        ))}
      </div>
      <div className="rounded-2xl p-5" style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}` }}>
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="mb-3 h-4 rounded last:mb-0" style={{ backgroundColor: '#ede9e0' }} />
        ))}
      </div>
    </div>
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
      return <EventFormLinkTab eventProjectId={project.id} />
    case 'responses':
      return <EventResponsesTab eventProjectId={project.id} />
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
  responses: 'Responses',
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
  const approveProject = useApproveEventProject(id)

  // Tab state — synced with ?tab= URL param
  const tabFromUrl = (searchParams.get('tab') as TabId) || 'overview'
  const [activeTab, setActiveTab] = useState<TabId>(tabFromUrl)

  // Keep activeTab in sync when URL changes externally (back/forward, other navigations)
  useEffect(() => {
    setActiveTab(tabFromUrl)
  }, [tabFromUrl])

  // Auth state — provides user ID, org branding, and readiness
  const { user: authUser } = useAuth({ redirectTo: '' })
  const currentUserId = authUser.id ?? null

  // Save as template dialog
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)

  // Approval review drawer — replaces the old one-click approve button
  const [isApprovalDrawerOpen, setIsApprovalDrawerOpen] = useState(false)

  // Form builder drawer state
  const [isFormBuilderOpen, setIsFormBuilderOpen] = useState(false)

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
      <>
        <div className="pb-8">
          <EventProjectSkeleton />
        </div>
      </>
    )
  }

  // Error / not found state
  if (error || !project) {
    return (
      <>
        <div className="pb-8">
          <EventNotFound onBack={() => router.push('/events')} />
        </div>
      </>
    )
  }

  return (
    <PagePadding>
    <>
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
            <div className="flex items-center gap-2">
              {activeTab === 'overview' && (
                <button
                  onClick={() => setIsFormBuilderOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-semibold transition-colors duration-200 cursor-pointer"
                  style={{ backgroundColor: WARM_CHIP, color: TEXT_PRIMARY }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ede9e0')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = WARM_CHIP)}
                >
                  <FileText className="w-4 h-4" strokeWidth={1.75} />
                  Customize Form
                </button>
              )}
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
            </div>
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
      <FormBuilderDrawer
        eventId={project.id}
        eventTitle={project.title}
        isOpen={isFormBuilderOpen}
        onClose={() => setIsFormBuilderOpen(false)}
      />
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
    </>
    </PagePadding>
  )
}
