'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  MapPin,
  User,
  Mail,
  Clock,
  AlertCircle,
  Calendar,
  ChevronRight,
  ChevronDown,
  DollarSign,
  ExternalLink,
  Eye,
  Pencil,
  Check,
  X,
  Tag,
  Layers,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getAuthHeaders } from '@/lib/api-client'
import { expandCollapse } from '@/lib/animations'
import TicketAssigneeSelect from './TicketAssigneeSelect'
import TicketWatchers from './TicketWatchers'
import LaborCostPanel from './LaborCostPanel'
import PPESafetyPanel from './PPESafetyPanel'
import { FIELD_LIBRARY } from '@/lib/services/categoryFieldLibrary'
import type { CategoryFieldType } from '@prisma/client'
import { Input } from '@/components/ui/Input'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SidebarTicket {
  id: string
  ticketNumber: string
  title: string
  description?: string | null
  status: string
  priority: string
  category: string
  photos: string[]
  aiAnalysis?: unknown | null
  scheduledDate?: string | null
  availabilityNote?: string | null
  estimatedRepairCostUSD?: number | null
  createdAt: string
  submittedById: string
  submittedBy: {
    id: string
    firstName: string
    lastName: string
    email: string
    avatar?: string | null
    userRole?: { name: string } | null
  }
  assignedTo?: {
    id: string
    firstName: string
    lastName: string
    avatar?: string | null
  } | null
  building?: { id: string; name: string } | null
  area?: { id: string; name: string } | null
  room?: { id: string; roomNumber: string; displayName?: string | null } | null
  school?: { id: string; name: string } | null
  watchers?: {
    id: string
    userId: string
    user: { id: string; firstName: string; lastName: string; email: string; avatar?: string | null }
  }[]
  assignmentLog?: {
    reason: string
    strategy: string
    source: string
    createdAt: string
  } | null
  customFields?: Record<string, unknown> | null
}

interface TicketDetailSidebarProps {
  ticket: SidebarTicket
  canManage: boolean
  canAssign: boolean
  isPrivileged: boolean
  currentUserId: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

import { PRIORITY_COLORS, CATEGORY_LABELS } from '@/lib/constants/maintenance'
import KBSuggestionsPanel from './KBSuggestionsPanel'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || '?'
}

function avatarStyle(avatar?: string | null): React.CSSProperties | undefined {
  return avatar
    ? {
        backgroundImage: `url(${JSON.stringify(avatar)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined
}

function PersonAvatar({
  firstName,
  lastName,
  avatar,
  className,
}: {
  firstName: string
  lastName: string
  avatar?: string | null
  className?: string
}) {
  return (
    <div
      className={[
        'rounded-full bg-primary-100 flex items-center justify-center text-[10px] font-semibold text-primary-700 flex-shrink-0 overflow-hidden border border-white/70',
        className ?? 'w-7 h-7',
      ].join(' ')}
      style={avatarStyle(avatar)}
      title={`${firstName} ${lastName}`}
    >
      {!avatar && getInitials(firstName, lastName)}
    </div>
  )
}

// ─── Collapsible Section ────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string
  icon: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-slate-100 pt-4">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left cursor-pointer group"
      >
        {icon}
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex-1">
          {title}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            variants={expandCollapse}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            className="overflow-hidden"
          >
            <div className="pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Estimated Cost (inline editable) ───────────────────────────────────────

function EstimatedCostField({
  ticketId,
  initialValue,
  canManage,
}: {
  ticketId: string
  initialValue: number | null
  canManage: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialValue?.toString() ?? '')
  const [displayValue, setDisplayValue] = useState(initialValue)
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: async (cost: number | null) => {
      const res = await fetch(`/api/maintenance/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ estimatedRepairCostUSD: cost }),
      })
      if (!res.ok) throw new Error('Failed to update cost')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-ticket', ticketId] })
    },
  })

  function handleSave() {
    const parsed = value.trim() === '' ? null : parseFloat(value)
    if (parsed !== null && isNaN(parsed)) return
    setDisplayValue(parsed)
    setEditing(false)
    updateMutation.mutate(parsed)
  }

  function handleCancel() {
    setValue(displayValue?.toString() ?? '')
    setEditing(false)
  }

  return (
    <div className="border-t border-slate-100 pt-4">
      <div className="flex items-center gap-2 mb-2">
        <DollarSign className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Estimated Cost
        </span>
      </div>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-slate-500">$</span>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') handleCancel()
            }}
            autoFocus
            size="sm"
            className="w-24 text-sm"
            placeholder="0.00"
          />
          <button
            onClick={handleSave}
            className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCancel}
            className="p-1 text-slate-400 hover:bg-slate-100 rounded transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 group">
          <span className="text-sm text-slate-700">
            {displayValue != null
              ? `$${displayValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : 'Not set'}
          </span>
          {canManage && (
            <button
              onClick={() => {
                setValue(displayValue?.toString() ?? '')
                setEditing(true)
              }}
              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-all cursor-pointer"
              title="Edit estimated cost"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function TicketDetailSidebar({
  ticket,
  canManage,
  canAssign,
  isPrivileged,
  currentUserId,
}: TicketDetailSidebarProps) {
  const roomLabel = ticket.room
    ? ticket.room.displayName || ticket.room.roomNumber || 'Room'
    : null
  return (
    <div className="space-y-4">
      {/* Assignee */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <User className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Assignee
          </span>
        </div>
        <TicketAssigneeSelect
          ticketId={ticket.id}
          currentAssignee={ticket.assignedTo ?? null}
          canAssign={canAssign}
        />
        {ticket.assignmentLog && (
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            <span className="font-medium text-slate-500">Auto-routed:</span>{' '}
            {ticket.assignmentLog.reason}
          </p>
        )}
      </div>

      {/* Priority & Category */}
      <div className="border-t border-slate-100 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertCircle className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Priority</span>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                PRIORITY_COLORS[ticket.priority] ?? 'bg-slate-100 text-slate-600'
              }`}
            >
              {ticket.priority}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Tag className="w-3 h-3 text-slate-400" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase">Category</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              {CATEGORY_LABELS[ticket.category] ?? ticket.category}
            </span>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Location
          </span>
        </div>
        {ticket.school || ticket.building || ticket.area || ticket.room ? (
          <div className="space-y-1">
            {ticket.school && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                <span className="font-medium">{ticket.school.name}</span>
              </div>
            )}
            {ticket.building && (
              <div
                className={`flex items-center gap-1.5 text-xs text-slate-600 ${
                  ticket.school ? 'pl-3' : ''
                }`}
              >
                <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                <span>{ticket.building.name}</span>
              </div>
            )}
            {ticket.area && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600 pl-6">
                <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                <span>{ticket.area.name}</span>
              </div>
            )}
            {roomLabel && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600 pl-9">
                <ChevronRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
                <span className="font-medium">{roomLabel}</span>
              </div>
            )}
            {ticket.building && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(ticket.building.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 transition-colors mt-1"
              >
                <ExternalLink className="w-3 h-3" />
                View on Map
              </a>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-400">No location specified</p>
        )}
      </div>

      {/* Submitted */}
      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Submitted
          </span>
        </div>
        <div className="flex items-start gap-2.5">
          <PersonAvatar
            firstName={ticket.submittedBy.firstName}
            lastName={ticket.submittedBy.lastName}
            avatar={ticket.submittedBy.avatar}
          />
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-900">
              {ticket.submittedBy.firstName} {ticket.submittedBy.lastName}
            </p>
            {ticket.submittedBy.userRole && (
              <p className="text-[10px] text-slate-500">{ticket.submittedBy.userRole.name}</p>
            )}
            <a
              href={`mailto:${ticket.submittedBy.email}`}
              className="flex items-center gap-1 text-[10px] text-primary-600 hover:text-primary-700 transition-colors"
            >
              <Mail className="w-2.5 h-2.5" />
              {ticket.submittedBy.email}
            </a>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-2">
          <Clock className="w-3 h-3 flex-shrink-0" />
          <span>
            {formatAbsolute(ticket.createdAt)}{' '}
            <span className="text-slate-300">({formatRelative(ticket.createdAt)})</span>
          </span>
        </div>

        {/* Availability note */}
        {ticket.availabilityNote && (
          <div className="flex items-start gap-2 px-2.5 py-2 bg-amber-50 border border-amber-200 rounded-lg mt-2">
            <AlertCircle className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-semibold text-amber-800">Availability</p>
              <p className="text-[10px] text-amber-700">{ticket.availabilityNote}</p>
            </div>
          </div>
        )}

        {/* Scheduled date */}
        {ticket.scheduledDate && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-purple-700">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            <span>
              Scheduled:{' '}
              {new Date(ticket.scheduledDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>
        )}
      </div>

      {/* Estimated Repair Cost */}
      {isPrivileged && (
        <EstimatedCostField
          ticketId={ticket.id}
          initialValue={ticket.estimatedRepairCostUSD ?? null}
          canManage={canManage}
        />
      )}

      {/* Watchers */}
      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2 mb-2">
          <Eye className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Watchers
          </span>
          <span className="text-[10px] text-slate-400 ml-auto">
            {(ticket.watchers ?? []).length}
          </span>
        </div>
        <TicketWatchers
          ticketId={ticket.id}
          watchers={ticket.watchers ?? []}
          currentUserId={currentUserId}
          canManage={canManage}
        />
      </div>

      {/* PPE & Safety */}
      <CollapsibleSection
        title="PPE & Safety"
        icon={<AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
        defaultOpen={ticket.category === 'CUSTODIAL_BIOHAZARD' || ticket.priority === 'URGENT'}
      >
        <PPESafetyPanel category={ticket.category} />
      </CollapsibleSection>

      {/* Custom Fields */}
      {ticket.customFields && Object.keys(ticket.customFields).length > 0 && (
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Additional Details
            </span>
          </div>
          <div className="space-y-2">
            {Object.entries(ticket.customFields as Record<string, unknown>).map(([key, value]) => {
              const fieldDef = FIELD_LIBRARY[key as CategoryFieldType]
              if (!fieldDef || value === null || value === undefined) return null
              return (
                <div key={key} className="text-sm">
                  <span className="text-slate-500 text-xs">{fieldDef.label}</span>
                  <div className="text-slate-900 mt-0.5">
                    {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Labor & Costs */}
      {isPrivileged && (
        <CollapsibleSection
          title="Labor & Costs"
          icon={<Clock className="w-3.5 h-3.5 text-slate-400" />}
        >
          <LaborCostPanel ticketId={ticket.id} currentUserId={currentUserId} />
        </CollapsibleSection>
      )}

      {/* KB Article Suggestions */}
      {ticket.category && (
        <div className="pt-3 border-t border-slate-100">
          <KBSuggestionsPanel category={ticket.category} title={ticket.title} />
        </div>
      )}
    </div>
  )
}
