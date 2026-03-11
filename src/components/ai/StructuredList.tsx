'use client'

import { Calendar, Wrench, Users, Package, MapPin, Building2, AlertCircle, CheckCircle, Timer } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventItem {
  title: string
  datetime?: string
  time?: string
  date?: string
  location?: string
  calendar?: string
  status?: string
  host?: string
  id?: string
}

interface TicketItem {
  title: string
  status?: string
  priority?: string
  category?: string
  location?: string
  created?: string
  assignee?: string
  id?: string
}

interface UserItem {
  name: string
  email?: string
  role?: string
  team?: string
  status?: string
}

interface InventoryItem {
  name: string
  quantity?: number
  available?: number
  category?: string
  location?: string
  status?: string
}

interface GenericItem {
  title: string
  subtitle?: string
  detail?: string
  badge?: string
  [key: string]: unknown
}

type ListItem = EventItem | TicketItem | UserItem | InventoryItem | GenericItem

export interface StructuredListData {
  type: 'events' | 'tickets' | 'users' | 'inventory' | 'generic'
  items: ListItem[]
  groupBy?: string
}

/** Callback when an item in a structured list is clicked */
export type OnItemClick = (type: string, item: ListItem) => void

// ─── Color Utilities ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  ACTIVE: 'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-500',
  confirmed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  URGENT: 'bg-red-500',
  HIGH: 'bg-orange-400',
  NORMAL: 'bg-yellow-400',
  MEDIUM: 'bg-yellow-400',
  LOW: 'bg-green-400',
}

const TIMELINE_COLORS = [
  'bg-green-400',
  'bg-blue-400',
  'bg-violet-400',
  'bg-amber-400',
  'bg-rose-400',
  'bg-teal-400',
  'bg-indigo-400',
  'bg-pink-400',
]

function getTimelineColor(index: number): string {
  return TIMELINE_COLORS[index % TIMELINE_COLORS.length]
}

const STATUS_ICONS: Record<string, typeof AlertCircle> = {
  OPEN: AlertCircle,
  IN_PROGRESS: Timer,
  RESOLVED: CheckCircle,
  CLOSED: CheckCircle,
}

// ─── Date Grouping ────────────────────────────────────────────────────────────

function groupEventsByDate(items: EventItem[]): Record<string, EventItem[]> {
  const groups: Record<string, EventItem[]> = {}

  for (const item of items) {
    // Try to extract a date group from datetime or date field
    const dateStr = item.date || item.datetime || ''
    let groupKey = 'Events'

    // Match patterns like "Today", "Tomorrow", "Monday, March 16"
    const todayMatch = dateStr.match(/^today/i)
    const tomorrowMatch = dateStr.match(/^tomorrow/i)
    const dayMatch = dateStr.match(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s*(.*)/i)
    const dateOnlyMatch = dateStr.match(/^(\w+day),?\s+(\w+\s+\d{1,2}(?:,?\s+\d{4})?)/i)
    const fullDateMatch = dateStr.match(/(\w+),?\s+(\w+\s+\d{1,2},?\s+\d{4})/i)

    if (todayMatch) {
      const today = new Date()
      const formatted = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      groupKey = `TODAY ${formatted.toUpperCase()}`
    } else if (tomorrowMatch) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const formatted = tomorrow.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      groupKey = `TOMORROW ${formatted.toUpperCase()}`
    } else if (fullDateMatch) {
      groupKey = `${fullDateMatch[1].toUpperCase()} ${fullDateMatch[2].toUpperCase()}`
    } else if (dateOnlyMatch) {
      groupKey = `${dateOnlyMatch[1].toUpperCase()} ${dateOnlyMatch[2].toUpperCase()}`
    } else if (dayMatch) {
      groupKey = dayMatch[0].toUpperCase()
    }

    if (!groups[groupKey]) groups[groupKey] = []
    groups[groupKey].push(item)
  }

  return groups
}

function extractTime(item: EventItem): string {
  if (item.time) return item.time
  const datetime = item.datetime || ''
  // Extract time from strings like "today at 2:30 PM" or "Tomorrow at 6:00 AM"
  const timeMatch = datetime.match(/(?:at\s+)?(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i)
  return timeMatch ? timeMatch[1] : ''
}

// ─── Renderers ────────────────────────────────────────────────────────────────

function EventsList({ items, onItemClick }: { items: EventItem[]; onItemClick?: OnItemClick }) {
  const groups = groupEventsByDate(items)

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([dateGroup, events]) => (
        <div key={dateGroup}>
          {/* Date Group Header */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold tracking-wider text-primary-600 uppercase">
              {dateGroup.startsWith('TODAY') && '☀️ '}{dateGroup}
            </span>
          </div>

          {/* Events in this group */}
          <div className="space-y-0">
            {events.map((event, idx) => {
              const time = extractTime(event)
              const color = getTimelineColor(idx)
              return (
                <div
                  key={idx}
                  className={`flex items-stretch gap-3 py-3 border-t border-gray-100 first:border-t-0 rounded-lg transition-colors duration-150 ${
                    onItemClick ? 'cursor-pointer hover:bg-primary-50/60 -mx-1.5 px-1.5' : ''
                  }`}
                  onClick={onItemClick ? () => onItemClick('events', event) : undefined}
                >
                  {/* Time column */}
                  <div className="w-16 flex-shrink-0 text-right pr-1 pt-0.5">
                    <span className="text-sm font-semibold text-gray-700">{time}</span>
                  </div>

                  {/* Timeline bar */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className={`w-1.5 flex-1 rounded-full ${color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 py-0.5">
                    <p className="text-sm font-semibold text-gray-900 truncate">{event.title}</p>
                    {event.location && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-gray-500 truncate">{event.location}</span>
                      </div>
                    )}
                    {event.calendar && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-gray-500 truncate">{event.calendar}</span>
                      </div>
                    )}
                    {event.host && (
                      <span className="text-xs text-gray-400">Host: {event.host}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function TicketsList({ items, onItemClick }: { items: TicketItem[]; onItemClick?: OnItemClick }) {
  return (
    <div className="space-y-0">
      {items.map((ticket, idx) => {
        const StatusIcon = STATUS_ICONS[ticket.status || ''] || AlertCircle
        const statusColor = STATUS_COLORS[ticket.status || ''] || 'bg-gray-100 text-gray-600'
        const priorityColor = PRIORITY_COLORS[ticket.priority || ''] || 'bg-gray-300'

        return (
          <div
            key={idx}
            className={`flex items-center gap-3 py-3 border-t border-gray-100 first:border-t-0 rounded-lg transition-colors duration-150 ${
              onItemClick ? 'cursor-pointer hover:bg-primary-50/60 -mx-1.5 px-1.5' : ''
            }`}
            onClick={onItemClick ? () => onItemClick('tickets', ticket) : undefined}
          >
            {/* Priority indicator */}
            <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${priorityColor}`} />

            {/* Status icon */}
            <StatusIcon className={`w-4.5 h-4.5 flex-shrink-0 ${
              ticket.status === 'OPEN' ? 'text-red-500' :
              ticket.status === 'IN_PROGRESS' ? 'text-blue-500' :
              ticket.status === 'RESOLVED' ? 'text-green-500' : 'text-gray-400'
            }`} />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900 truncate">{ticket.title}</p>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {ticket.category && (
                  <span className="text-xs text-gray-500">{ticket.category}</span>
                )}
                {ticket.location && (
                  <span className="text-xs text-gray-400">• {ticket.location}</span>
                )}
                {ticket.assignee && (
                  <span className="text-xs text-gray-400">• {ticket.assignee}</span>
                )}
                {ticket.created && (
                  <span className="text-xs text-gray-400">• {ticket.created}</span>
                )}
              </div>
            </div>

            {/* Status badge */}
            {ticket.status && (
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${statusColor}`}>
                {ticket.status.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function UsersList({ items, onItemClick }: { items: UserItem[]; onItemClick?: OnItemClick }) {
  return (
    <div className="space-y-0">
      {items.map((user, idx) => {
        const initials = user.name
          .split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)

        const avatarColors = [
          'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
          'bg-rose-500', 'bg-teal-500', 'bg-indigo-500', 'bg-pink-500',
        ]

        return (
          <div
            key={idx}
            className={`flex items-center gap-3 py-3 border-t border-gray-100 first:border-t-0 rounded-lg transition-colors duration-150 ${
              onItemClick ? 'cursor-pointer hover:bg-primary-50/60 -mx-1.5 px-1.5' : ''
            }`}
            onClick={onItemClick ? () => onItemClick('users', user) : undefined}
          >
            {/* Avatar */}
            <div className={`w-9 h-9 rounded-full ${avatarColors[idx % avatarColors.length]} flex items-center justify-center flex-shrink-0`}>
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
              <div className="flex items-center gap-2 mt-1">
                {user.email && (
                  <span className="text-xs text-gray-500 truncate">{user.email}</span>
                )}
                {user.team && (
                  <span className="text-xs text-gray-400">• {user.team}</span>
                )}
              </div>
            </div>

            {/* Role badge */}
            {user.role && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-700 flex-shrink-0">
                {user.role}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function InventoryList({ items, onItemClick }: { items: InventoryItem[]; onItemClick?: OnItemClick }) {
  return (
    <div className="space-y-0">
      {items.map((item, idx) => (
        <div
          key={idx}
          className={`flex items-center gap-3 py-3 border-t border-gray-100 first:border-t-0 rounded-lg transition-colors duration-150 ${
            onItemClick ? 'cursor-pointer hover:bg-primary-50/60 -mx-1.5 px-1.5' : ''
          }`}
          onClick={onItemClick ? () => onItemClick('inventory', item) : undefined}
        >
          {/* Icon */}
          <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200/50 flex items-center justify-center flex-shrink-0">
            <Package className="w-4.5 h-4.5 text-amber-600" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
            <div className="flex items-center gap-2 mt-1">
              {item.category && (
                <span className="text-xs text-gray-500">{item.category}</span>
              )}
              {item.location && (
                <span className="text-xs text-gray-400">• {item.location}</span>
              )}
            </div>
          </div>

          {/* Quantity */}
          {(item.available !== undefined || item.quantity !== undefined) && (
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-gray-900">
                {item.available !== undefined ? item.available : item.quantity}
              </p>
              <p className="text-xs text-gray-400">
                {item.available !== undefined ? 'available' : 'total'}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function GenericList({ items, onItemClick }: { items: GenericItem[]; onItemClick?: OnItemClick }) {
  return (
    <div className="space-y-0">
      {items.map((item, idx) => (
        <div
          key={idx}
          className={`flex items-center gap-3 py-3 border-t border-gray-100 first:border-t-0 rounded-lg transition-colors duration-150 ${
            onItemClick ? 'cursor-pointer hover:bg-primary-50/60 -mx-1.5 px-1.5' : ''
          }`}
          onClick={onItemClick ? () => onItemClick('generic', item) : undefined}
        >
          {/* Color bar */}
          <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${getTimelineColor(idx)}`} />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{item.title}</p>
            {item.subtitle && (
              <span className="text-xs text-gray-500">{item.subtitle}</span>
            )}
            {item.detail && (
              <span className="text-xs text-gray-400 block mt-0.5">{item.detail}</span>
            )}
          </div>

          {/* Badge */}
          {item.badge && (
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 flex-shrink-0">
              {item.badge}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StructuredList({ data, onItemClick }: { data: StructuredListData; onItemClick?: OnItemClick }) {
  if (!data.items || data.items.length === 0) return null

  const listTypeIcon = {
    events: Calendar,
    tickets: Wrench,
    users: Users,
    inventory: Package,
    generic: Building2,
  }

  const Icon = listTypeIcon[data.type] || Building2

  return (
    <div className="mt-1.5 -mx-1 rounded-lg bg-gray-50/80 border border-gray-100 overflow-hidden">
      {/* List header bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {data.items.length} {data.type === 'generic' ? 'items' : data.type}
        </span>
      </div>

      {/* List content */}
      <div className="px-3 py-1.5">
        {data.type === 'events' && <EventsList items={data.items as EventItem[]} onItemClick={onItemClick} />}
        {data.type === 'tickets' && <TicketsList items={data.items as TicketItem[]} onItemClick={onItemClick} />}
        {data.type === 'users' && <UsersList items={data.items as UserItem[]} onItemClick={onItemClick} />}
        {data.type === 'inventory' && <InventoryList items={data.items as InventoryItem[]} onItemClick={onItemClick} />}
        {data.type === 'generic' && <GenericList items={data.items as GenericItem[]} onItemClick={onItemClick} />}
      </div>
    </div>
  )
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Clean up common LLM artifacts around :::list blocks:
 * - Strip code fences (```json ... ```) wrapping the block
 * - Strip backtick-quoted :::list blocks
 * - Remove stray "json" labels from code fence openings
 */
function cleanListArtifacts(text: string): string {
  let cleaned = text

  // Remove ```json / ``` wrapping around :::list blocks
  // Handles: ```json\n:::list{...}:::\n``` and ``` :::list{...}::: ```
  cleaned = cleaned.replace(/```(?:json)?\s*\n?\s*(:::list[\s\S]*?:::)\s*\n?\s*```/g, '$1')

  // Remove standalone ``` that might appear near list blocks
  cleaned = cleaned.replace(/```(?:json)?\s*\n(:::list)/g, '$1')
  cleaned = cleaned.replace(/(:::)\s*\n\s*```/g, '$1')

  // Remove backtick-quoted list blocks: `:::list{...}:::`
  cleaned = cleaned.replace(/`(:::list[\s\S]*?:::)`/g, '$1')

  return cleaned
}

/**
 * Parse structured list blocks from assistant message text.
 * Format: :::list{"type":"events","items":[...]}:::
 *
 * When isStreaming=true, any incomplete :::list block at the end is hidden
 * (returned as { pendingBlock: true }) so raw JSON isn't shown during streaming.
 *
 * Returns an array of { text, listData, pendingBlock } segments for rendering.
 */
export function parseStructuredLists(
  text: string,
  isStreaming = false
): Array<{ text?: string; listData?: StructuredListData; pendingBlock?: boolean }> {
  // First clean up any code fence artifacts
  const cleaned = cleanListArtifacts(text)

  const segments: Array<{ text?: string; listData?: StructuredListData; pendingBlock?: boolean }> = []
  const regex = /:::list([\s\S]*?):::/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(cleaned)) !== null) {
    // Add text before this block
    if (match.index > lastIndex) {
      const before = cleaned.slice(lastIndex, match.index).trim()
      if (before) segments.push({ text: before })
    }

    // Parse the JSON block
    try {
      const jsonStr = match[1].trim()
      const data = JSON.parse(jsonStr) as StructuredListData
      if (data && data.type && Array.isArray(data.items)) {
        segments.push({ listData: data })
      } else {
        segments.push({ text: match[0] })
      }
    } catch {
      segments.push({ text: match[0] })
    }

    lastIndex = match.index + match[0].length
  }

  // Handle remaining text after last match
  if (lastIndex < cleaned.length) {
    const remaining = cleaned.slice(lastIndex).trim()
    if (remaining) {
      // During streaming, check if there's an incomplete :::list block being typed
      if (isStreaming && remaining.includes(':::list')) {
        // Split at the incomplete block — show text before it, hide the rest
        const incompleteIdx = remaining.indexOf(':::list')
        const beforeIncomplete = remaining.slice(0, incompleteIdx).trim()
        if (beforeIncomplete) segments.push({ text: beforeIncomplete })
        // Signal that a list block is loading
        segments.push({ pendingBlock: true })
      } else if (isStreaming && (remaining.includes(':::') || remaining.match(/```(?:json)?\s*$/))) {
        // Partial opening delimiter during streaming — hide it
        const delimIdx = remaining.search(/:::|```(?:json)?\s*$/)
        const beforeDelim = remaining.slice(0, delimIdx).trim()
        if (beforeDelim) segments.push({ text: beforeDelim })
        segments.push({ pendingBlock: true })
      } else {
        segments.push({ text: remaining })
      }
    }
  }

  return segments.length > 0 ? segments : [{ text }]
}
