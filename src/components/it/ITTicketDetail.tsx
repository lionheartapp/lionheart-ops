'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryOptions, queryKeys } from '@/lib/queries'
import { getAuthHeaders } from '@/lib/api-client'
import DetailDrawer from '@/components/DetailDrawer'
import ITActivityFeed from './ITActivityFeed'
import { StatusBadge, PriorityBadge, TypeBadge } from './ITStatusBadge'
import {
  User, MapPin, Calendar, ArrowRight, UserPlus,
  CheckCircle2, XCircle, PauseCircle, PlayCircle, Loader2,
} from 'lucide-react'

interface ITTicketDetailProps {
  ticketId: string | null
  isOpen: boolean
  onClose: () => void
  canManage: boolean
  members?: { id: string; firstName: string; lastName: string }[]
}

interface TicketDetail {
  id: string
  ticketNumber: string
  title: string
  description?: string | null
  status: string
  priority: string
  issueType: string
  source: string
  photos: string[]
  holdReason?: string | null
  holdNote?: string | null
  resolutionNote?: string | null
  cancellationReason?: string | null
  subRoomText?: string | null
  createdAt: string
  updatedAt: string
  submittedBy?: { id: string; firstName: string; lastName: string; email: string; avatar?: string | null } | null
  assignedTo?: { id: string; firstName: string; lastName: string; email: string; avatar?: string | null } | null
  building?: { id: string; name: string } | null
  area?: { id: string; name: string } | null
  room?: { id: string; roomNumber?: string; displayName?: string | null } | null
  school?: { id: string; name: string } | null
}

const NEXT_STATUS_ACTIONS: Record<string, { label: string; status: string; icon: typeof PlayCircle; color: string }[]> = {
  BACKLOG: [
    { label: 'Start', status: 'TODO', icon: PlayCircle, color: 'bg-blue-600 hover:bg-blue-700' },
  ],
  TODO: [
    { label: 'In Progress', status: 'IN_PROGRESS', icon: PlayCircle, color: 'bg-indigo-600 hover:bg-indigo-700' },
    { label: 'Hold', status: 'ON_HOLD', icon: PauseCircle, color: 'bg-yellow-600 hover:bg-yellow-700' },
  ],
  IN_PROGRESS: [
    { label: 'Resolve', status: 'DONE', icon: CheckCircle2, color: 'bg-green-600 hover:bg-green-700' },
    { label: 'Hold', status: 'ON_HOLD', icon: PauseCircle, color: 'bg-yellow-600 hover:bg-yellow-700' },
    { label: 'Cancel', status: 'CANCELLED', icon: XCircle, color: 'bg-red-600 hover:bg-red-700' },
  ],
  ON_HOLD: [
    { label: 'Resume', status: 'IN_PROGRESS', icon: PlayCircle, color: 'bg-indigo-600 hover:bg-indigo-700' },
    { label: 'Cancel', status: 'CANCELLED', icon: XCircle, color: 'bg-red-600 hover:bg-red-700' },
  ],
}

export default function ITTicketDetail({ ticketId, isOpen, onClose, canManage, members = [] }: ITTicketDetailProps) {
  const queryClient = useQueryClient()
  const [showAssign, setShowAssign] = useState(false)
  const [holdReason, setHoldReason] = useState('')
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const [transitionNote, setTransitionNote] = useState('')

  const { data, isLoading } = useQuery({
    ...queryOptions.itTicketDetail(ticketId ?? ''),
    enabled: !!ticketId,
  })

  const ticket = data as TicketDetail | undefined

  const statusMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch(`/api/it/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      }).then((r) => {
        if (!r.ok) throw new Error('Status transition failed')
        return r.json()
      }),
    onSuccess: () => {
      setPendingStatus(null)
      setTransitionNote('')
      setHoldReason('')
      queryClient.invalidateQueries({ queryKey: queryKeys.itTicketDetail.byId(ticketId!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.itTicketComments.byTicket(ticketId!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.itTickets.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.itBoard.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.itDashboard.all })
    },
  })

  const assignMutation = useMutation({
    mutationFn: (assignedToId: string) =>
      fetch(`/api/it/tickets/${ticketId}/assign`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ assignedToId }),
      }).then((r) => {
        if (!r.ok) throw new Error('Assignment failed')
        return r.json()
      }),
    onSuccess: () => {
      setShowAssign(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.itTicketDetail.byId(ticketId!) })
      queryClient.invalidateQueries({ queryKey: queryKeys.itTickets.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.itBoard.all })
    },
  })

  const handleStatusChange = (status: string) => {
    if (status === 'ON_HOLD') {
      setPendingStatus('ON_HOLD')
      return
    }
    if (status === 'CANCELLED') {
      setPendingStatus('CANCELLED')
      return
    }
    if (status === 'DONE') {
      setPendingStatus('DONE')
      return
    }
    statusMutation.mutate({ status })
  }

  const confirmStatusChange = () => {
    if (!pendingStatus) return
    const body: Record<string, unknown> = { status: pendingStatus }
    if (pendingStatus === 'ON_HOLD') {
      body.holdReason = holdReason || 'On hold'
      body.holdNote = transitionNote || undefined
    }
    if (pendingStatus === 'CANCELLED') body.cancellationReason = transitionNote || 'Cancelled'
    if (pendingStatus === 'DONE') body.resolutionNote = transitionNote || undefined
    statusMutation.mutate(body)
  }

  const location = [
    ticket?.building?.name,
    ticket?.area?.name,
    ticket?.room?.displayName || ticket?.room?.roomNumber,
  ].filter(Boolean).join(' › ')

  return (
    <DetailDrawer isOpen={isOpen} onClose={onClose} title={ticket?.ticketNumber ?? 'Ticket'} width="lg">
      {isLoading || !ticket ? (
        <div className="space-y-4 animate-pulse p-4">
          <div className="h-6 w-48 bg-slate-200 rounded" />
          <div className="h-4 w-32 bg-slate-100 rounded" />
          <div className="h-20 w-full bg-slate-100 rounded-xl" />
        </div>
      ) : (
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 pb-4 border-b border-slate-200/50">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">{ticket.title}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              <TypeBadge type={ticket.issueType} />
              {ticket.source === 'SUB_SUBMITTED' && (
                <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700">
                  Substitute
                </span>
              )}
            </div>
          </div>

          {/* Meta info */}
          <div className="px-6 py-4 space-y-3 border-b border-slate-200/50">
            {ticket.description && (
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{ticket.description}</p>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <User className="w-4 h-4 text-slate-400" />
                <span>
                  {ticket.submittedBy
                    ? `${ticket.submittedBy.firstName} ${ticket.submittedBy.lastName}`
                    : ticket.subRoomText
                    ? `Sub (${ticket.subRoomText})`
                    : 'Unknown'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
              </div>
              {(location || ticket.subRoomText) && (
                <div className="flex items-center gap-2 text-slate-600 col-span-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{location || ticket.subRoomText}</span>
                </div>
              )}
              {ticket.school && (
                <div className="text-xs text-slate-500">
                  Campus: {ticket.school.name}
                </div>
              )}
            </div>

            {/* Assignee */}
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-slate-400" />
              {ticket.assignedTo ? (
                <span className="text-sm text-slate-700">
                  {ticket.assignedTo.firstName} {ticket.assignedTo.lastName}
                </span>
              ) : (
                <span className="text-sm text-slate-400">Unassigned</span>
              )}
              {canManage && (
                <button
                  onClick={() => setShowAssign(!showAssign)}
                  className="text-xs text-blue-600 hover:text-blue-700 ml-2"
                >
                  {showAssign ? 'Cancel' : ticket.assignedTo ? 'Reassign' : 'Assign'}
                </button>
              )}
            </div>

            {/* Assign dropdown */}
            {showAssign && canManage && (
              <div className="ml-6 space-y-1 max-h-40 overflow-y-auto">
                {members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => assignMutation.mutate(m.id)}
                    disabled={assignMutation.isPending}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-100 transition-colors flex items-center gap-2"
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">
                      {m.firstName[0]}{m.lastName[0]}
                    </div>
                    {m.firstName} {m.lastName}
                  </button>
                ))}
              </div>
            )}

            {/* Hold / Resolution notes */}
            {ticket.holdReason && (
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
                <span className="font-medium">Hold reason:</span> {ticket.holdReason}
                {ticket.holdNote && <p className="mt-1 text-yellow-700">{ticket.holdNote}</p>}
              </div>
            )}
            {ticket.resolutionNote && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                <span className="font-medium">Resolution:</span> {ticket.resolutionNote}
              </div>
            )}
            {ticket.cancellationReason && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                <span className="font-medium">Cancelled:</span> {ticket.cancellationReason}
              </div>
            )}
          </div>

          {/* Status transition buttons */}
          {canManage && NEXT_STATUS_ACTIONS[ticket.status] && (
            <div className="px-6 py-3 border-b border-slate-200/50">
              {pendingStatus ? (
                <div className="space-y-2">
                  {pendingStatus === 'ON_HOLD' ? (
                    <>
                      <select
                        value={holdReason}
                        onChange={(e) => setHoldReason(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 bg-white"
                      >
                        <option value="">Select hold reason...</option>
                        <option value="PARTS">Waiting for parts</option>
                        <option value="VENDOR">Waiting for vendor</option>
                        <option value="USER_AVAILABILITY">User unavailable</option>
                        <option value="THIRD_PARTY">Third party dependency</option>
                        <option value="OTHER">Other</option>
                      </select>
                      <input
                        type="text"
                        value={transitionNote}
                        onChange={(e) => setTransitionNote(e.target.value)}
                        placeholder="Additional notes (optional)..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                      />
                    </>
                  ) : (
                    <input
                      type="text"
                      value={transitionNote}
                      onChange={(e) => setTransitionNote(e.target.value)}
                      placeholder={
                        pendingStatus === 'CANCELLED'
                          ? 'Cancellation reason...'
                          : 'Resolution note (optional)...'
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                    />
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={confirmStatusChange}
                      disabled={statusMutation.isPending || (pendingStatus === 'ON_HOLD' && !holdReason.trim())}
                      className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
                    >
                      {statusMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                      Confirm
                    </button>
                    <button
                      onClick={() => { setPendingStatus(null); setTransitionNote(''); setHoldReason('') }}
                      className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {NEXT_STATUS_ACTIONS[ticket.status]?.map((action) => (
                    <button
                      key={action.status}
                      onClick={() => handleStatusChange(action.status)}
                      disabled={statusMutation.isPending}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-sm font-medium transition-colors ${action.color}`}
                    >
                      <action.icon className="w-3.5 h-3.5" />
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Activity feed */}
          <div className="flex-1 overflow-hidden px-6 py-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Activity</h3>
            <ITActivityFeed ticketId={ticket.id} isPrivileged={canManage} />
          </div>
        </div>
      )}
    </DetailDrawer>
  )
}
