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
  ExternalLink,
  Eye,
  Tag,
  Layers,
} from 'lucide-react'
import { expandCollapse } from '@/lib/animations'
import TicketAssigneeSelect from './TicketAssigneeSelect'
import TicketWatchers from './TicketWatchers'
import AIDiagnosticPanel from './AIDiagnosticPanel'
import LaborCostPanel from './LaborCostPanel'
import PPESafetyPanel from './PPESafetyPanel'
import type { AiAnalysisCache } from '@/lib/types/maintenance-ai'

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
  createdAt: string
  submittedById: string
  submittedBy: {
    id: string
    firstName: string
    lastName: string
    email: string
    userRole?: { name: string } | null
  }
  assignedTo?: {
    id: string
    firstName: string
    lastName: string
  } | null
  building?: { id: string; name: string } | null
  area?: { id: string; name: string } | null
  room?: { id: string; roomNumber: string; displayName?: string | null } | null
  school?: { id: string; name: string } | null
  watchers?: {
    id: string
    userId: string
    user: { id: string; firstName: string; lastName: string; email: string }
  }[]
}

interface TicketDetailSidebarProps {
  ticket: SidebarTicket
  canManage: boolean
  canAssign: boolean
  isPrivileged: boolean
  currentUserId: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-slate-100 text-slate-500',
}

const CATEGORY_LABELS: Record<string, string> = {
  ELECTRICAL: 'Electrical',
  PLUMBING: 'Plumbing',
  HVAC: 'HVAC',
  STRUCTURAL: 'Structural',
  CUSTODIAL_BIOHAZARD: 'Custodial / Biohazard',
  IT_AV: 'IT / A/V',
  GROUNDS: 'Grounds',
  OTHER: 'Other',
}

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
          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-[10px] font-semibold text-primary-700 flex-shrink-0">
            {ticket.submittedBy.firstName[0]}
            {ticket.submittedBy.lastName[0]}
          </div>
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

      {/* PPE & Safety (Custodial/Biohazard only) */}
      {ticket.category === 'CUSTODIAL_BIOHAZARD' && (
        <CollapsibleSection
          title="PPE & Safety"
          icon={<AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
          defaultOpen
        >
          <PPESafetyPanel category={ticket.category} />
        </CollapsibleSection>
      )}

      {/* AI Diagnostics */}
      <CollapsibleSection
        title="AI Diagnostics"
        icon={<Layers className="w-3.5 h-3.5 text-slate-400" />}
      >
        <AIDiagnosticPanel
          ticketId={ticket.id}
          photos={ticket.photos}
          category={ticket.category}
          aiAnalysis={ticket.aiAnalysis as AiAnalysisCache | null}
        />
      </CollapsibleSection>

      {/* Labor & Costs */}
      {isPrivileged && (
        <CollapsibleSection
          title="Labor & Costs"
          icon={<Clock className="w-3.5 h-3.5 text-slate-400" />}
        >
          <LaborCostPanel ticketId={ticket.id} currentUserId={currentUserId} />
        </CollapsibleSection>
      )}
    </div>
  )
}
