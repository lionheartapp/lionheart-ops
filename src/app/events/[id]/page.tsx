'use client'

import { use, useState, useEffect, Component, type ReactNode, type ErrorInfo } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { CalendarDays, MapPin, Loader2, AlertCircle, QrCode, BookmarkPlus } from 'lucide-react'
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
import { SaveAsTemplateDialog } from '@/components/events/templates/SaveAsTemplateDialog'
import { useToast } from '@/components/Toast'
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
          <p className="text-sm font-semibold text-slate-900 mb-2">This section encountered an error</p>
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

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT: { label: 'Draft', bg: 'bg-slate-100', text: 'text-slate-600' },
  PENDING_APPROVAL: { label: 'Pending Approval', bg: 'bg-amber-50', text: 'text-amber-700' },
  CONFIRMED: { label: 'Confirmed', bg: 'bg-blue-50', text: 'text-blue-700' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-green-50', text: 'text-green-700' },
  COMPLETED: { label: 'Completed', bg: 'bg-purple-50', text: 'text-purple-700' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-red-50', text: 'text-red-600' },
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EventProjectSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-slate-200 rounded w-2/3 mb-3" />
      <div className="h-4 bg-slate-100 rounded w-1/3 mb-8" />
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-slate-100 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Sidebar skeleton (matches EventSidebar shape) ─────────────────────────────

function SidebarSkeleton() {
  return (
    <aside className="w-[220px] flex-shrink-0 bg-white border-r border-slate-200/80 flex flex-col h-full animate-pulse">
      <div className="px-5 pt-[18px] pb-[14px] border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-slate-200" />
          <div className="w-20 h-4 bg-slate-200 rounded" />
        </div>
      </div>
      <div className="px-5 py-3.5 border-b border-slate-100 space-y-2">
        <div className="w-16 h-5 bg-slate-100 rounded-full" />
        <div className="w-full h-4 bg-slate-200 rounded" />
        <div className="w-24 h-3 bg-slate-100 rounded" />
      </div>
      <div className="flex-1 px-3 py-3 space-y-2">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="w-full h-7 bg-slate-50 rounded-md" />
        ))}
      </div>
    </aside>
  )
}

// ─── 404 State ────────────────────────────────────────────────────────────────

function EventNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="text-center py-16">
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="w-7 h-7 text-red-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-2">Event project not found</h3>
      <p className="text-sm text-slate-500 mb-6">
        This event may have been deleted or you may not have access.
      </p>
      <button
        onClick={onBack}
        className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer"
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

  // Tab state — reads initial from ?tab= URL param
  const initialTab = (searchParams.get('tab') as TabId) || 'overview'
  const [activeTab, setActiveTab] = useState<TabId>(initialTab)

  // Read current user ID from localStorage
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentUserId(localStorage.getItem('user-id'))
    }
  }, [])

  // Read org branding from localStorage
  const [orgLogoUrl, setOrgLogoUrl] = useState<string | undefined>(undefined)
  const [orgName, setOrgName] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrgLogoUrl(localStorage.getItem('org-logo-url') || undefined)
      setOrgName(localStorage.getItem('org-name') || undefined)
    }
  }, [])

  // Save as template dialog
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)

  function handleTabChange(tab: TabId) {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  async function handleApprove() {
    try {
      await approveProject.mutateAsync()
      toast('Event project approved', 'success')
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

  const statusConfig = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.DRAFT
  const startsAt = new Date(project.startsAt)
  const endsAt = new Date(project.endsAt)

  const dateDisplay = project.isMultiDay
    ? `${format(startsAt, 'MMM d')} – ${format(endsAt, 'MMM d, yyyy')}`
    : `${format(startsAt, 'EEEE, MMM d, yyyy')}, ${format(startsAt, 'h:mm a')} – ${format(endsAt, 'h:mm a')}`

  const creatorName = project.createdBy?.firstName
    ? `${project.createdBy.firstName} ${project.createdBy.lastName || ''}`.trim()
    : project.createdBy?.email

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
              {/* Presence bar */}
              {currentUserId && (
                <PresenceBar
                  eventProjectId={project.id}
                  currentUserId={currentUserId}
                  activeTab={activeTab}
                />
              )}

              {/* Day-Of Mode button */}
              {shouldShowDayOfButton(project) && (
                <button
                  onClick={() => router.push(`/events/${project.id}/dayof`)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer whitespace-nowrap"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  Day-Of Mode
                </button>
              )}

              {project.status === 'PENDING_APPROVAL' && (
                <button
                  onClick={handleApprove}
                  disabled={approveProject.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 active:scale-[0.97] transition-all cursor-pointer"
                >
                  {approveProject.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Approve
                </button>
              )}
            </div>
          </motion.div>

          {/* Section label — shows which tab is active, with inline actions */}
          <motion.div variants={listItem} className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-slate-900">{TAB_LABELS[activeTab]}</h1>
            {activeTab === 'overview' && ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(project.status) && (
              <button
                onClick={() => setIsTemplateDialogOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer"
              >
                <BookmarkPlus className="w-4 h-4" />
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
    </DashboardLayout>
  )
}
