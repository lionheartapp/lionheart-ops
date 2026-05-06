'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, HelpCircle, X, Send, Clock, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, CalendarDays, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { useEventInvitations, useRespondToInvitation } from '@/lib/hooks/useEventInvitations'
import type { EventInvitation } from '@/lib/hooks/useEventInvitations'
import { fetchApi } from '@/lib/api-client'
import { Input } from '@/components/ui/Input'

// ─── Helpers ────────────────────────────────────────────────────────────────

function displayName(u: { firstName: string | null; lastName: string | null; email: string }) {
  if (u.firstName || u.lastName) return `${u.firstName || ''} ${u.lastName || ''}`.trim()
  return u.email
}

function initials(u: { firstName: string | null; lastName: string | null; email: string }) {
  if (u.firstName && u.lastName) return `${u.firstName[0]}${u.lastName[0]}`.toUpperCase()
  if (u.firstName) return u.firstName[0].toUpperCase()
  return u.email[0].toUpperCase()
}

// ─── Conflict types ─────────────────────────────────────────────────────────

interface ScheduleConflict {
  id: string
  source: 'internal' | 'external'
  title: string
  startsAt: string
  endsAt: string
  isAllDay: boolean
  location: string | null
  provider?: string
}

function useMyConflicts(eventProjectId: string) {
  return useQuery({
    queryKey: ['my-event-conflicts', eventProjectId],
    queryFn: () =>
      fetchApi<{ conflicts: ScheduleConflict[]; hasConflicts: boolean }>(
        `/api/events/projects/${eventProjectId}/invitations/my-conflicts`,
      ),
  })
}

function ConflictStatus({ eventProjectId }: { eventProjectId: string }) {
  const { data, isLoading } = useMyConflicts(eventProjectId)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
        <Clock className="w-3 h-3 animate-spin" />
        Checking your schedule...
      </div>
    )
  }

  if (!data || !data.hasConflicts) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
        <span className="text-xs font-medium text-emerald-700">No schedule conflicts</span>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        <span className="text-xs font-medium text-amber-700">
          {data.conflicts.length} schedule conflict{data.conflicts.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="border-t border-amber-100 divide-y divide-amber-100">
        {data.conflicts.slice(0, 5).map((c) => (
          <div key={c.id} className="flex items-center gap-2.5 px-3 py-2">
            <CalendarDays className="w-3 h-3 text-amber-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-800 truncate">{c.title}</p>
              <p className="text-[10px] text-slate-500">
                {c.isAllDay
                  ? 'All day'
                  : `${format(new Date(c.startsAt), 'h:mm a')} – ${format(new Date(c.endsAt), 'h:mm a')}`}
                {c.location && ` · ${c.location}`}
              </p>
            </div>
            {c.source === 'external' && c.provider && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium flex-shrink-0">
                {c.provider === 'google_calendar' ? 'Google' : 'Outlook'}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const STATUS_CONFIG = {
  PENDING: { label: 'Pending', color: 'bg-slate-100 text-slate-600', icon: Clock },
  ACCEPTED: { label: 'Accepted', color: 'bg-emerald-100 text-emerald-700', icon: Check },
  MAYBE: { label: 'Maybe', color: 'bg-amber-100 text-amber-700', icon: HelpCircle },
  DECLINED: { label: 'Declined', color: 'bg-red-100 text-red-700', icon: X },
} as const

// ─── RSVP Banner (shown to the invited user) ───────────────────────────────

function RSVPBanner({
  invitation,
  eventProjectId,
}: {
  invitation: EventInvitation
  eventProjectId: string
}) {
  const respond = useRespondToInvitation(eventProjectId)
  const [declineReason, setDeclineReason] = useState('')
  const [showDeclineInput, setShowDeclineInput] = useState(false)

  if (invitation.status !== 'PENDING') {
    const config = STATUS_CONFIG[invitation.status]
    const Icon = config.icon
    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${config.color} mb-4`}>
        <Icon className="w-4 h-4 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            You {invitation.status === 'ACCEPTED' ? 'accepted' : invitation.status === 'MAYBE' ? 'might attend' : 'declined'} this event
          </p>
          {invitation.responseNote && (
            <p className="text-xs mt-0.5 opacity-80">&ldquo;{invitation.responseNote}&rdquo;</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => respond.mutate({ status: 'PENDING' as never })}
          className="text-xs underline opacity-70 hover:opacity-100 cursor-pointer"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 mb-4 space-y-3"
    >
      <div className="flex items-start gap-3">
        <Send className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900">You&apos;re invited to this event</p>
          {invitation.note && (
            <p className="text-xs text-slate-500 mt-1">&ldquo;{invitation.note}&rdquo;</p>
          )}
        </div>
      </div>

      {/* Schedule conflict check */}
      <ConflictStatus eventProjectId={eventProjectId} />

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={respond.isPending}
          onClick={() => respond.mutate({ status: 'ACCEPTED' })}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-50"
        >
          <Check className="w-3.5 h-3.5" />
          Accept
        </button>
        <button
          type="button"
          disabled={respond.isPending}
          onClick={() => respond.mutate({ status: 'MAYBE' })}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors cursor-pointer disabled:opacity-50"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          Maybe
        </button>
        <button
          type="button"
          disabled={respond.isPending}
          onClick={() => {
            if (showDeclineInput) {
              respond.mutate({ status: 'DECLINED', responseNote: declineReason })
            } else {
              setShowDeclineInput(true)
            }
          }}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
        >
          <X className="w-3.5 h-3.5" />
          Decline
        </button>
      </div>

      <AnimatePresence>
        {showDeclineInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 pt-1">
              <Input
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Reason (optional)..."
                autoFocus
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    respond.mutate({ status: 'DECLINED', responseNote: declineReason })
                  }
                }}
              />
              <button
                type="button"
                onClick={() => respond.mutate({ status: 'DECLINED', responseNote: declineReason })}
                disabled={respond.isPending}
                className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 cursor-pointer disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Invitation List (shown to the organizer) ──────────────────────────────

function InvitationRow({ invitation }: { invitation: EventInvitation }) {
  const config = STATUS_CONFIG[invitation.status]
  const Icon = config.icon

  return (
    <div className="flex items-center gap-3 py-2.5">
      {invitation.user.avatar ? (
        <img
          src={invitation.user.avatar}
          alt=""
          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <span className="w-8 h-8 rounded-full bg-slate-100 text-[10px] font-bold flex items-center justify-center text-slate-600 flex-shrink-0">
          {initials(invitation.user)}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">
          {displayName(invitation.user)}
        </p>
        {invitation.responseNote && (
          <p className="text-xs text-slate-500 truncate">&ldquo;{invitation.responseNote}&rdquo;</p>
        )}
      </div>
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium ${config.color}`}
      >
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    </div>
  )
}

// ─── Main Section ──────────────────────────────────────────────────────────

interface EventInvitationsSectionProps {
  eventProjectId: string
  currentUserId: string
}

export function EventInvitationsSection({
  eventProjectId,
  currentUserId,
}: EventInvitationsSectionProps) {
  const { data: invitations, isLoading } = useEventInvitations(eventProjectId)
  const [expanded, setExpanded] = useState(true)

  if (isLoading || !invitations || invitations.length === 0) return null

  // Check if the current user has an invitation
  const myInvitation = invitations.find((inv) => inv.userId === currentUserId)

  // Counts for the summary
  const accepted = invitations.filter((i) => i.status === 'ACCEPTED').length
  const maybe = invitations.filter((i) => i.status === 'MAYBE').length
  const declined = invitations.filter((i) => i.status === 'DECLINED').length
  const pending = invitations.filter((i) => i.status === 'PENDING').length

  return (
    <div className="space-y-3">
      {/* RSVP banner for the current user (if invited) */}
      {myInvitation && (
        <RSVPBanner invitation={myInvitation} eventProjectId={eventProjectId} />
      )}

      {/* Invitation list for organizer view */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer"
        >
          <Send className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-medium text-slate-900 flex-1 text-left">
            Invited People
          </span>
          <div className="flex items-center gap-1.5 text-[11px]">
            {accepted > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                {accepted} yes
              </span>
            )}
            {maybe > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                {maybe} maybe
              </span>
            )}
            {declined > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                {declined} no
              </span>
            )}
            {pending > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                {pending} pending
              </span>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 divide-y divide-slate-100">
                {invitations.map((inv) => (
                  <InvitationRow key={inv.id} invitation={inv} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
