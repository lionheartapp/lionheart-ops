'use client'

import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  ArrowLeft,
  LayoutDashboard,
  CalendarDays,
  Users,
  ClipboardList,
  FileText,
  Truck,
  DollarSign,
  CheckSquare,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react'
import type { EventProject } from '@/lib/hooks/useEventProject'
import type { MyEventPermissions } from '@/lib/hooks/useEventPermissions'
import {
  SURFACE,
  BORDER,
  HAIRLINE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  WARM_CHIP,
  STATUS_ACCENT,
} from '@/lib/design/warm-tokens'

// ─── Status label (unified vocabulary) ──────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

// ─── Nav item definitions ─────────────────────────────────────────────────────

type TabId = 'overview' | 'schedule' | 'people' | 'registration' | 'documents' | 'logistics' | 'budget' | 'tasks' | 'comms'

interface NavItem {
  id: TabId
  label: string
  icon: LucideIcon
  /** Permission key required to see this tab. undefined = always visible. */
  requiredPermission?: keyof MyEventPermissions
}

interface NavSection {
  label: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Event',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'schedule', label: 'Schedule', icon: CalendarDays },
      { id: 'people', label: 'Team', icon: Users },
      { id: 'registration', label: 'Registration', icon: ClipboardList, requiredPermission: 'canViewRegistrations' },
    ],
  },
  {
    label: 'Planning',
    items: [
      { id: 'documents', label: 'Documents', icon: FileText, requiredPermission: 'canManageDocuments' },
      { id: 'logistics', label: 'Logistics', icon: Truck, requiredPermission: 'canManageLogistics' },
      { id: 'budget', label: 'Budget', icon: DollarSign, requiredPermission: 'canViewBudget' },
      { id: 'tasks', label: 'Tasks', icon: CheckSquare },
      { id: 'comms', label: 'Comms', icon: MessageSquare, requiredPermission: 'canSendComms' },
    ],
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

interface EventSidebarProps {
  project: EventProject
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  organizationLogoUrl?: string
  organizationName?: string
  /** Current user's event-level permissions. If undefined, show all tabs (loading state). */
  permissions?: MyEventPermissions
}

export type { TabId }

export default function EventSidebar({ project, activeTab, onTabChange, organizationLogoUrl, organizationName, permissions }: EventSidebarProps) {
  const router = useRouter()

  const statusLabel = STATUS_LABEL[project.status] ?? 'Draft'
  const statusAccent = STATUS_ACCENT[project.status] ?? STATUS_ACCENT.DRAFT
  const startsAt = new Date(project.startsAt)
  const endsAt = new Date(project.endsAt)

  const dateDisplay = project.isMultiDay
    ? `${format(startsAt, 'MMM d')}–${format(endsAt, 'MMM d')}`
    : format(startsAt, 'MMM d, yyyy')

  const locationDisplay = project.locationText || undefined

  return (
    <aside
      className="w-[220px] flex-shrink-0 flex flex-col h-full overflow-hidden"
      style={{
        backgroundColor: SURFACE,
        borderRight: `1px solid ${BORDER}`,
      }}
    >
      {/* Org logo — matches main nav sizing */}
      <div className="px-4 pt-8 pb-8 flex items-center justify-center">
        {organizationLogoUrl ? (
          <img
            src={organizationLogoUrl}
            alt={organizationName || 'Organization'}
            className="h-10 max-w-[140px] object-contain"
          />
        ) : (
          <span
            className="text-base font-semibold truncate"
            style={{ color: TEXT_PRIMARY, letterSpacing: '-0.015em' }}
          >
            {organizationName || 'School'}
          </span>
        )}
      </div>

      {/* Back to Events — below logo */}
      <div className="px-4 pb-0">
        <button
          onClick={() => router.push('/events')}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-[12.5px] font-medium transition-colors cursor-pointer"
          style={{ backgroundColor: WARM_CHIP, color: TEXT_SECONDARY }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#ede9e0'
            e.currentTarget.style.color = TEXT_PRIMARY
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = WARM_CHIP
            e.currentTarget.style.color = TEXT_SECONDARY
          }}
        >
          <ArrowLeft className="w-3.5 h-3.5 flex-shrink-0" />
          Back to Events
        </button>
      </div>

      {/* Event info card */}
      <div
        className="px-5 pt-8 pb-8"
        style={{ borderBottom: `1px solid ${HAIRLINE}` }}
      >
        <div
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-[3px] rounded-full mb-2"
          style={{
            backgroundColor: `${statusAccent}1a`,
            color: statusAccent,
          }}
        >
          <span
            className="w-[5px] h-[5px] rounded-full"
            style={{ backgroundColor: statusAccent }}
          />
          {statusLabel}
        </div>
        <div
          className="text-[13.5px] font-semibold leading-snug"
          style={{ color: TEXT_PRIMARY, letterSpacing: '-0.01em' }}
        >
          {project.title}
        </div>
        <div className="text-[11.5px] mt-1" style={{ color: TEXT_MUTED }}>
          {dateDisplay}
          {locationDisplay && ` · ${locationDisplay}`}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 pt-[24px]">
        {NAV_SECTIONS.map((section) => {
          // Filter items based on permissions (if permissions not loaded yet, show all)
          const visibleItems = permissions
            ? section.items.filter((item) => {
                if (!item.requiredPermission) return true
                return permissions[item.requiredPermission]
              })
            : section.items

          if (visibleItems.length === 0) return null

          return (
            <div key={section.label} className="mb-1">
              <div
                className="text-[10px] font-semibold uppercase tracking-[0.1em] px-4 mb-1.5 mt-4 first:mt-0"
                style={{ color: TEXT_MUTED }}
              >
                {section.label}
              </div>
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon
                  const isActive = activeTab === item.id
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => onTabChange(item.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 min-h-[40px] rounded-xl text-[13.5px] transition-colors cursor-pointer focus:outline-none"
                        style={{
                          backgroundColor: isActive ? WARM_CHIP : 'transparent',
                          color: isActive ? TEXT_PRIMARY : TEXT_SECONDARY,
                          fontWeight: isActive ? 600 : 500,
                          letterSpacing: '-0.005em',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.backgroundColor = '#f8f6f2'
                            e.currentTarget.style.color = TEXT_PRIMARY
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.backgroundColor = 'transparent'
                            e.currentTarget.style.color = TEXT_SECONDARY
                          }
                        }}
                      >
                        <Icon
                          className="w-[18px] h-[18px] flex-shrink-0"
                          strokeWidth={isActive ? 2.25 : 1.75}
                        />
                        {item.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

    </aside>
  )
}
