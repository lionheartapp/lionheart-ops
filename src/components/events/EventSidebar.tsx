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
} from 'lucide-react'
import type { EventProject } from '@/lib/hooks/useEventProject'

// ─── Status badge config ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dotColor: string; bgColor: string; textColor: string }> = {
  DRAFT: { label: 'Draft', dotColor: 'bg-slate-400', bgColor: 'bg-slate-100', textColor: 'text-slate-600' },
  PENDING_APPROVAL: { label: 'Pending', dotColor: 'bg-amber-400', bgColor: 'bg-amber-50', textColor: 'text-amber-700' },
  CONFIRMED: { label: 'Confirmed', dotColor: 'bg-green-500', bgColor: 'bg-green-50', textColor: 'text-green-700' },
  IN_PROGRESS: { label: 'In Progress', dotColor: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
  COMPLETED: { label: 'Completed', dotColor: 'bg-purple-500', bgColor: 'bg-purple-50', textColor: 'text-purple-700' },
  CANCELLED: { label: 'Cancelled', dotColor: 'bg-red-400', bgColor: 'bg-red-50', textColor: 'text-red-600' },
}

// ─── Nav item definitions ─────────────────────────────────────────────────────

type TabId = 'overview' | 'schedule' | 'people' | 'registration' | 'documents' | 'logistics' | 'budget' | 'tasks' | 'comms'

interface NavSection {
  label: string
  items: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Event',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'schedule', label: 'Schedule', icon: CalendarDays },
      { id: 'people', label: 'People', icon: Users },
      { id: 'registration', label: 'Registration', icon: ClipboardList },
    ],
  },
  {
    label: 'Planning',
    items: [
      { id: 'documents', label: 'Documents', icon: FileText },
      { id: 'logistics', label: 'Logistics', icon: Truck },
      { id: 'budget', label: 'Budget', icon: DollarSign },
      { id: 'tasks', label: 'Tasks', icon: CheckSquare },
      { id: 'comms', label: 'Comms', icon: MessageSquare },
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
}

export type { TabId }

export default function EventSidebar({ project, activeTab, onTabChange, organizationLogoUrl, organizationName }: EventSidebarProps) {
  const router = useRouter()

  const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.DRAFT
  const startsAt = new Date(project.startsAt)
  const endsAt = new Date(project.endsAt)

  const dateDisplay = project.isMultiDay
    ? `${format(startsAt, 'MMM d')}–${format(endsAt, 'MMM d')}`
    : format(startsAt, 'MMM d, yyyy')

  const locationDisplay = project.locationText || undefined

  return (
    <aside className="w-[220px] flex-shrink-0 bg-white border-r border-slate-200/80 flex flex-col h-full overflow-hidden">
      {/* Back to Events — top of sidebar for easy access */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={() => router.push('/events')}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[13px] text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 flex-shrink-0" />
          Back to Events
        </button>
      </div>

      {/* Org logo */}
      {organizationLogoUrl && (
        <div className="px-5 pt-2 pb-2 border-b border-slate-100">
          <img
            src={organizationLogoUrl}
            alt={organizationName || 'Organization'}
            className="h-8 w-auto object-contain"
          />
        </div>
      )}

      {/* Event info card */}
      <div className="px-5 py-3.5 border-b border-slate-100">
        <div className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-[3px] rounded-full mb-1.5 ${status.bgColor} ${status.textColor}`}>
          <span className={`w-[5px] h-[5px] rounded-full ${status.dotColor}`} />
          {status.label}
        </div>
        <div className="text-[13px] font-semibold text-slate-900 leading-snug">{project.title}</div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          {dateDisplay}
          {locationDisplay && ` · ${locationDisplay}`}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 pt-2">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-1">
            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.07em] px-4 mb-1 mt-3 first:mt-0">
              {section.label}
            </div>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => onTabChange(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl text-sm transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 ${
                        isActive
                          ? 'text-slate-900 font-semibold bg-[rgb(236,241,252)]'
                          : 'text-slate-600 hover:bg-white/30 hover:text-slate-900 border border-transparent'
                      }`}
                    >
                      <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary-500' : ''}`} />
                      {item.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

    </aside>
  )
}
