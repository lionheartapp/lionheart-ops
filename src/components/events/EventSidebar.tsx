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
}

export type { TabId }

export default function EventSidebar({ project, activeTab, onTabChange, organizationLogoUrl }: EventSidebarProps) {
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
      {/* Logo / Brand mark — clickable back to main dashboard */}
      <div className="px-5 pt-[18px] pb-[14px] border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          {organizationLogoUrl ? (
            <img
              src={organizationLogoUrl}
              alt="Logo"
              className="w-7 h-7 rounded-lg object-cover"
            />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1.5C4.41 1.5 1.5 4.41 1.5 8s2.91 6.5 6.5 6.5 6.5-2.91 6.5-6.5S11.59 1.5 8 1.5zm0 2.5a2 2 0 110 4 2 2 0 010-4zm0 9a5 5 0 01-3.93-1.9C5.12 10.1 6.5 9.5 8 9.5s2.88.6 3.93 1.6A5 5 0 018 13.5z"/>
              </svg>
            </div>
          )}
          <span className="text-[15px] font-semibold text-slate-900 tracking-[-0.01em]">Lionheart</span>
        </div>
      </div>

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
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-1">
            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.07em] px-2 mb-1 mt-2 first:mt-0">
              {section.label}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center gap-2 px-2 py-[7px] rounded-md text-[13px] transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-indigo-500 opacity-100' : 'opacity-70'}`} />
                  {item.label}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Back button at bottom */}
      <div className="px-3 py-3 border-t border-slate-100">
        <button
          onClick={() => router.push('/events')}
          className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-[13px] text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 flex-shrink-0 opacity-70" />
          Back to Events
        </button>
      </div>
    </aside>
  )
}
