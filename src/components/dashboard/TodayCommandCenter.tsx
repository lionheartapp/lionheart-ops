'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  MessageSquare,
  Monitor,
  Sparkles,
  Video,
  Wrench,
} from 'lucide-react'

type DashboardMode = 'admin' | 'maintenance' | 'it' | 'av' | string | null | undefined

interface AttentionItem {
  id: string
  label: string
  detail: string
  href?: string
  tone?: 'neutral' | 'amber' | 'red' | 'green' | 'blue'
  icon: typeof AlertTriangle
  priority: number
  actionLabel?: string
  onAction?: () => void
}

interface TodayCommandCenterProps {
  mode: DashboardMode
  firstName?: string
  schoolName?: string | null
  openTaskCount: number
  unreadCount: number
  upcomingCount: number
  todayEventCount: number
  activeTicketCount: number
  openTicketCount: number
  inProgressTicketCount: number
  facilityRequestCount: number
  avEventCount: number
  avNeedsEquipmentCount: number
  conflictCount: number
  pendingEventApprovalCount: number
  overdueTaskCount: number
  dueSoonTaskCount: number
  highPriorityTicketCount: number
  canApproveFacilities: boolean
  isAdmin: boolean
  onOpenTasks: () => void
  onOpenLeo: () => void
}

export default function TodayCommandCenter({
  mode,
  firstName,
  schoolName,
  openTaskCount,
  unreadCount,
  upcomingCount,
  todayEventCount,
  activeTicketCount,
  openTicketCount,
  inProgressTicketCount,
  facilityRequestCount,
  avEventCount,
  avNeedsEquipmentCount,
  conflictCount,
  pendingEventApprovalCount,
  overdueTaskCount,
  dueSoonTaskCount,
  highPriorityTicketCount,
  canApproveFacilities,
  isAdmin,
  onOpenTasks,
  onOpenLeo,
}: TodayCommandCenterProps) {
  const role = getRoleCopy(mode, isAdmin)
  const attentionItems = buildAttentionItems({
    mode,
    openTaskCount,
    unreadCount,
    upcomingCount,
    todayEventCount,
    activeTicketCount,
    openTicketCount,
    inProgressTicketCount,
    facilityRequestCount,
    avEventCount,
    avNeedsEquipmentCount,
    conflictCount,
    pendingEventApprovalCount,
    overdueTaskCount,
    dueSoonTaskCount,
    highPriorityTicketCount,
    canApproveFacilities,
    onOpenTasks,
  })

  const primaryItem = attentionItems[0]
  const secondaryItems = attentionItems.slice(1, 4)

  return (
    <section
      className="mb-5 sm:mb-6 bg-white border border-gray-200 rounded-xl p-4 sm:p-6"
      aria-labelledby="today-command-heading"
    >
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] gap-4 sm:gap-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {role.badgeIcon}
              {role.badge}
            </span>
            {schoolName && (
              <span className="inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500">
                {schoolName}
              </span>
            )}
          </div>

          <h2 id="today-command-heading" className="text-[22px] sm:text-3xl font-semibold leading-tight tracking-normal text-slate-950">
            {role.heading()}
          </h2>
          <p className="mt-2 max-w-2xl text-sm sm:text-base leading-6 text-slate-600">
            {role.description}
          </p>

          <div className="mt-4 sm:mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <MetricTile label="Needs attention" value={attentionItems.filter((item) => item.priority >= 30).length} />
            <MetricTile label="My work" value={openTaskCount} />
            <MetricTile label="Today" value={todayEventCount} />
            <MetricTile label="Messages" value={unreadCount} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Today needs attention</p>
              <p className="mt-1 text-sm text-slate-600">{attentionSummary(attentionItems)}</p>
            </div>
            <button
              type="button"
              onClick={onOpenLeo}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-slate-800 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              Ask Leo
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {primaryItem ? (
              <AttentionRow item={primaryItem} primary />
            ) : (
              <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-3">
                <p className="text-sm font-semibold text-emerald-900">Nothing urgent right now.</p>
                <p className="mt-0.5 text-xs text-emerald-700">The day is clear enough to plan ahead.</p>
              </div>
            )}
            {secondaryItems.map((item) => (
              <AttentionRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-xl sm:text-2xl font-semibold tabular-nums text-slate-950">{value}</p>
      <p className="mt-0.5 text-[10px] sm:text-xs font-medium leading-tight text-slate-500">{label}</p>
    </div>
  )
}

function AttentionRow({ item, primary = false }: { item: AttentionItem; primary?: boolean }) {
  const Icon = item.icon
  const content = (
    <div className={`flex items-start gap-3 rounded-lg border px-3 py-3 transition-colors duration-200 ${toneClasses(item.tone, primary)}`}>
      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/80">
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-950">{item.label}</p>
        <p className="mt-0.5 text-xs leading-5 text-slate-600">{item.detail}</p>
      </div>
      {(item.href || item.onAction) && (
        <ArrowRight className="mt-2 h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden />
      )}
    </div>
  )

  if (item.href) {
    return (
      <Link href={item.href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 rounded-lg">
        {content}
      </Link>
    )
  }

  if (item.onAction) {
    return (
      <button
        type="button"
        onClick={item.onAction}
        className="block w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 rounded-lg"
      >
        {content}
      </button>
    )
  }

  return content
}

function toneClasses(tone: AttentionItem['tone'], primary: boolean): string {
  if (tone === 'red') return 'border-red-200 bg-red-50'
  if (tone === 'amber') return 'border-amber-200 bg-amber-50'
  if (tone === 'green') return 'border-emerald-200 bg-emerald-50'
  if (tone === 'blue') return 'border-blue-200 bg-blue-50'
  return primary ? 'border-slate-300 bg-white' : 'border-slate-200 bg-white'
}

function getRoleCopy(mode: DashboardMode, isAdmin: boolean) {
  if (mode === 'it') {
    return {
      badge: 'IT command view',
      badgeIcon: <Monitor className="h-3.5 w-3.5" aria-hidden />,
      heading: () => 'IT priorities for today.',
      description: 'Start with classroom blockers, device issues, and the requests that need a human decision.',
      focusLabel: 'Queue pressure, assigned work, and staff messages.',
    }
  }

  if (mode === 'maintenance') {
    return {
      badge: 'Maintenance command view',
      badgeIcon: <Wrench className="h-3.5 w-3.5" aria-hidden />,
      heading: () => 'Campus work that needs attention.',
      description: 'Prioritize event approvals, open work orders, and anything that could affect the school day.',
      focusLabel: 'Approvals, open work, and jobs already in progress.',
    }
  }

  if (mode === 'av') {
    return {
      badge: 'A/V command view',
      badgeIcon: <Video className="h-3.5 w-3.5" aria-hidden />,
      heading: () => 'A/V work that needs to keep moving.',
      description: 'Focus on upcoming setups, missing equipment details, and event work waiting on your team.',
      focusLabel: 'Upcoming setups and incomplete event details.',
    }
  }

  if (isAdmin || mode === 'admin') {
    return {
      badge: 'School command view',
      badgeIcon: <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />,
      heading: () => 'Your school day at a glance.',
      description: 'Start with the items that need a decision, then check what is coming up today.',
      focusLabel: 'Approvals, calendar pressure, tasks, and messages.',
    }
  }

  return {
    badge: 'Staff command view',
    badgeIcon: <CheckSquare className="h-3.5 w-3.5" aria-hidden />,
    heading: () => 'What needs your attention today.',
    description: 'Your view stays focused on assigned work, requests you submitted, messages, and the events coming up.',
    focusLabel: 'Your tasks, requests, messages, and schedule.',
  }
}

function buildAttentionItems({
  mode,
  openTaskCount,
  unreadCount,
  upcomingCount,
  todayEventCount,
  activeTicketCount,
  openTicketCount,
  inProgressTicketCount,
  facilityRequestCount,
  avEventCount,
  avNeedsEquipmentCount,
  conflictCount,
  pendingEventApprovalCount,
  overdueTaskCount,
  dueSoonTaskCount,
  highPriorityTicketCount,
  canApproveFacilities,
  onOpenTasks,
}: Omit<TodayCommandCenterProps, 'firstName' | 'schoolName' | 'isAdmin' | 'onOpenLeo'>): AttentionItem[] {
  const items: AttentionItem[] = []

  if (conflictCount > 0) {
    items.push({
      id: 'event-conflicts',
      icon: AlertTriangle,
      label: `${conflictCount} scheduling ${conflictCount === 1 ? 'conflict' : 'conflicts'} detected`,
      detail: 'Review event logistics before rooms, teams, or families get conflicting details.',
      href: '/events',
      tone: 'red',
      priority: 100,
    })
  }

  if (overdueTaskCount > 0) {
    items.push({
      id: 'overdue-tasks',
      icon: CheckSquare,
      label: `${overdueTaskCount} overdue ${overdueTaskCount === 1 ? 'task' : 'tasks'}`,
      detail: 'These are past due and should be cleared or rescheduled first.',
      onAction: onOpenTasks,
      tone: 'red',
      priority: 95,
    })
  }

  if (canApproveFacilities && facilityRequestCount > 0) {
    items.push({
      id: 'facility-approvals',
      icon: ClipboardCheck,
      label: `${facilityRequestCount} event ${facilityRequestCount === 1 ? 'approval' : 'approvals'} waiting`,
      detail: 'Approve, reject, or send back before planning stalls.',
      href: '/approvals',
      tone: 'amber',
      priority: 90,
    })
  }

  if (pendingEventApprovalCount > 0 && !canApproveFacilities) {
    items.push({
      id: 'pending-event-approvals',
      icon: ClipboardCheck,
      label: `${pendingEventApprovalCount} event ${pendingEventApprovalCount === 1 ? 'approval is' : 'approvals are'} pending`,
      detail: 'Review what is blocking approval and move it forward.',
      href: '/approvals',
      tone: 'amber',
      priority: 88,
    })
  }

  if (highPriorityTicketCount > 0) {
    items.push({
      id: 'high-priority-requests',
      icon: AlertTriangle,
      label: `${highPriorityTicketCount} high-priority ${highPriorityTicketCount === 1 ? 'request' : 'requests'}`,
      detail: 'These should stay above normal queue work.',
      href: mode === 'it' ? '/it' : mode === 'maintenance' ? '/maintenance' : '/tickets',
      tone: 'amber',
      priority: 84,
    })
  }

  if (dueSoonTaskCount > 0) {
    items.push({
      id: 'due-soon-tasks',
      icon: CheckSquare,
      label: `${dueSoonTaskCount} ${dueSoonTaskCount === 1 ? 'task is' : 'tasks are'} due soon`,
      detail: 'Due today or tomorrow. Clear these before they become overdue.',
      onAction: onOpenTasks,
      tone: 'amber',
      priority: 78,
    })
  }

  if (mode === 'it') {
    if (openTicketCount > 0) {
      items.push({
        id: 'it-open',
        icon: Monitor,
        label: `${openTicketCount} open IT ${openTicketCount === 1 ? 'request' : 'requests'}`,
        detail: inProgressTicketCount > 0 ? `${inProgressTicketCount} already in progress.` : 'Nothing is marked in progress yet.',
        href: '/it',
        tone: openTicketCount >= 5 ? 'amber' : 'blue',
        priority: 64,
      })
    }
  } else if (mode === 'maintenance') {
    if (openTicketCount > 0) {
      items.push({
        id: 'maintenance-open',
        icon: Wrench,
        label: `${openTicketCount} open maintenance ${openTicketCount === 1 ? 'request' : 'requests'}`,
        detail: inProgressTicketCount > 0 ? `${inProgressTicketCount} work ${inProgressTicketCount === 1 ? 'order is' : 'orders are'} in progress.` : 'Review the queue and assign the next owner.',
        href: '/maintenance',
        tone: openTicketCount >= 5 ? 'amber' : 'blue',
        priority: 64,
      })
    }
  } else if (mode === 'av') {
    if (avNeedsEquipmentCount > 0) {
      items.push({
        id: 'av-missing-equipment',
        icon: Video,
        label: `${avNeedsEquipmentCount} A/V ${avNeedsEquipmentCount === 1 ? 'event needs' : 'events need'} equipment details`,
        detail: `${avEventCount} upcoming A/V ${avEventCount === 1 ? 'event is' : 'events are'} on the board.`,
        href: '/approvals',
        tone: 'amber',
        priority: 72,
      })
    }
  } else if (activeTicketCount > 0) {
    items.push({
      id: 'active-requests',
      icon: AlertTriangle,
      label: `${activeTicketCount} active ${activeTicketCount === 1 ? 'request' : 'requests'}`,
      detail: 'Open support work may need a status check.',
      href: '/tickets',
      tone: 'blue',
      priority: 54,
    })
  }

  if (todayEventCount > 0) {
    items.push({
      id: 'today-events',
      icon: CalendarDays,
      label: `${todayEventCount} ${todayEventCount === 1 ? 'item' : 'items'} on today's calendar`,
      detail: upcomingCount > todayEventCount ? `${upcomingCount} total over the next two weeks.` : 'Review today before the day gets busy.',
      href: '/calendar',
      tone: 'neutral',
      priority: 42,
    })
  }

  if (openTaskCount > 0) {
    items.push({
      id: 'my-work',
      icon: CheckSquare,
      label: `${openTaskCount} assigned ${openTaskCount === 1 ? 'task' : 'tasks'}`,
      detail: 'Open your task list and clear the next thing.',
      onAction: onOpenTasks,
      tone: 'neutral',
      priority: 35,
    })
  }

  if (unreadCount > 0) {
    items.push({
      id: 'messages',
      icon: MessageSquare,
      label: `${unreadCount} unread ${unreadCount === 1 ? 'message' : 'messages'}`,
      detail: 'Open staff updates that may affect today.',
      href: '/messaging',
      tone: 'neutral',
      priority: 30,
    })
  }

  return items.sort((a, b) => b.priority - a.priority)
}

function attentionSummary(items: AttentionItem[]): string {
  if (items.length === 0) return 'No urgent decisions right now.'
  if (items.length === 1) return '1 item needs a decision today.'
  return `${items.length} items need a decision today.`
}
