'use client'

import { useState, useEffect } from 'react'
import { X, Clock, MapPin, Calendar, User, UserPlus, Tag, Trash2, Edit, CheckCircle, XCircle, Loader2, Shield, Trophy, Swords, MapPinned } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getEventColor,
  useEventDetail,
  useSubmitForApproval,
  useApproveEvent,
  useRejectEvent,
  useAddAttendees,
  useRemoveAttendee,
  type CalendarEventData,
  type EventApprovalData,
  type ApprovalChannelType,
} from '@/lib/hooks/useCalendar'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import { useToast } from '@/components/Toast'
import AttendeePicker, { type AttendeeSelection } from '@/components/calendar/AttendeePicker'

interface EventDetailPanelProps {
  event: CalendarEventData | null
  onClose: () => void
  onEdit: (event: CalendarEventData) => void
  onDelete: (event: CalendarEventData) => void
}

function formatDateTime(dateStr: string, isAllDay: boolean): string {
  const d = new Date(dateStr)
  if (isAllDay) {
    return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }
  return d.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
  PENDING_APPROVAL: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending Approval' },
  CONFIRMED: { bg: 'bg-green-50', text: 'text-green-700', label: 'Confirmed' },
  TENTATIVE: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Tentative' },
  REJECTED: { bg: 'bg-red-50', text: 'text-red-700', label: 'Rejected' },
  CANCELLED: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Cancelled' },
}

const CHANNEL_LABELS: Record<string, string> = {
  ADMIN: 'Administration',
  FACILITIES: 'Facilities',
  AV_PRODUCTION: 'A/V Production',
  CUSTODIAL: 'Custodial',
  SECURITY: 'Security',
  ATHLETIC_DIRECTOR: 'Athletic Director',
}

const APPROVAL_STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  PENDING: { icon: Clock, color: 'text-amber-500', label: 'Pending' },
  APPROVED: { icon: CheckCircle, color: 'text-green-500', label: 'Approved' },
  REJECTED: { icon: XCircle, color: 'text-red-500', label: 'Rejected' },
  AUTO_APPROVED: { icon: CheckCircle, color: 'text-green-400', label: 'Auto-approved' },
}

function ApprovalChannelRow({
  approval,
  isAdmin,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: {
  approval: EventApprovalData
  isAdmin: boolean
  onApprove: (channelType: ApprovalChannelType) => void
  onReject: (channelType: ApprovalChannelType) => void
  isApproving: boolean
  isRejecting: boolean
}) {
  const config = APPROVAL_STATUS_CONFIG[approval.approvalStatus] || APPROVAL_STATUS_CONFIG.PENDING
  const StatusIcon = config.icon

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-4 h-4 ${config.color}`} />
          <span className="text-sm text-gray-900">{CHANNEL_LABELS[approval.channelType] || approval.channelType}</span>
        </div>
        <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
      </div>

      {/* Responded by */}
      {approval.respondedBy && approval.respondedAt && (
        <p className="text-xs text-gray-400 mt-0.5 ml-6">
          by {approval.respondedBy.firstName
            ? `${approval.respondedBy.firstName} ${approval.respondedBy.lastName || ''}`
            : approval.respondedBy.email}
          {' '}on {new Date(approval.respondedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
        </p>
      )}

      {/* Rejection reason */}
      {approval.approvalStatus === 'REJECTED' && approval.reason && (
        <p className="text-xs text-red-600 mt-1 ml-6 italic">&ldquo;{approval.reason}&rdquo;</p>
      )}

      {/* Admin action buttons */}
      {isAdmin && approval.approvalStatus === 'PENDING' && (
        <div className="flex gap-2 mt-2 ml-6">
          <button
            onClick={() => onApprove(approval.channelType)}
            disabled={isApproving}
            className="px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors flex items-center gap-1"
          >
            {isApproving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
            Approve
          </button>
          <button
            onClick={() => onReject(approval.channelType)}
            disabled={isRejecting}
            className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors flex items-center gap-1"
          >
            <XCircle className="w-3 h-3" />
            Reject
          </button>
        </div>
      )}
    </div>
  )
}

export default function EventDetailPanel({ event, onClose, onEdit, onDelete }: EventDetailPanelProps) {
  const focusTrapRef = useFocusTrap(!!event)
  const { toast } = useToast()

  // Approval state
  const [rejectingChannel, setRejectingChannel] = useState<ApprovalChannelType | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // Fetch full event detail (includes approvals)
  const { data: eventDetail } = useEventDetail(event?.id ?? null)

  // Approval mutations
  const submitForApproval = useSubmitForApproval()
  const approveEvent = useApproveEvent()
  const rejectEvent = useRejectEvent()

  // Attendee mutations
  const addAttendees = useAddAttendees()
  const removeAttendee = useRemoveAttendee()
  const [showAddAttendee, setShowAddAttendee] = useState(false)

  // Client-side permission check (server enforces real permissions)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isCreator, setIsCreator] = useState(false)

  useEffect(() => {
    if (!event) return
    const role = localStorage.getItem('user-role')?.toLowerCase()
    setIsAdmin(role === 'super admin' || role === 'administrator' || role === 'super-admin' || role === 'admin')
    const email = localStorage.getItem('user-email')
    setIsCreator(!!email && event.createdBy?.email === email)
  }, [event])

  useEffect(() => {
    if (!event) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (rejectingChannel) {
          setRejectingChannel(null)
          setRejectReason('')
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [event, onClose, rejectingChannel])

  // Reset state when event changes
  useEffect(() => {
    setRejectingChannel(null)
    setRejectReason('')
    setShowAddAttendee(false)
  }, [event?.id])

  const isAthletics = !!(event?.metadata as any)?.athleticsType
  const athleticsMeta = isAthletics ? (event?.metadata as any) : null

  const status = event ? (statusStyles[event.calendarStatus] || statusStyles.DRAFT) : statusStyles.DRAFT
  const approvals = eventDetail?.approvals || []

  const handleApprove = async (channelType: ApprovalChannelType) => {
    if (!event) return
    try {
      await approveEvent.mutateAsync({ eventId: event.id, channelType })
      toast('Channel approved', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to approve', 'error')
    }
  }

  const handleRejectClick = (channelType: ApprovalChannelType) => {
    setRejectingChannel(channelType)
    setRejectReason('')
  }

  const handleRejectConfirm = async () => {
    if (!event || !rejectingChannel || !rejectReason.trim()) return
    try {
      await rejectEvent.mutateAsync({ eventId: event.id, channelType: rejectingChannel, reason: rejectReason.trim() })
      toast('Channel rejected', 'success')
      setRejectingChannel(null)
      setRejectReason('')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to reject', 'error')
    }
  }

  const handleSubmitForApproval = async () => {
    if (!event) return
    try {
      await submitForApproval.mutateAsync(event.id)
      toast('Submitted for approval', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to submit', 'error')
    }
  }

  return (
    <AnimatePresence>
      {event && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-mobilenav"
            onClick={onClose}
          />

          {/* Rejection modal overlay */}
          {rejectingChannel && (
            <div className="fixed inset-0 z-lightbox flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/20" onClick={() => { setRejectingChannel(null); setRejectReason('') }} />
              <div className="relative ui-glass-overlay rounded-2xl p-5 w-full max-w-sm">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  Reject {CHANNEL_LABELS[rejectingChannel] || rejectingChannel}
                </h4>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason for rejection (required)"
                  aria-label="Reason for rejection"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-900/10 focus:border-gray-900 resize-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => { setRejectingChannel(null); setRejectReason('') }}
                    className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRejectConfirm}
                    disabled={!rejectReason.trim() || rejectEvent.isPending}
                    className="flex-1 px-3 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
                  >
                    {rejectEvent.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                    Reject
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Panel */}
          <motion.div
            ref={focusTrapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-panel-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:right-4 sm:top-4 sm:bottom-4 sm:max-w-[420px] ui-glass-overlay z-modal flex flex-col sm:rounded-2xl"
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                    {status.label}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 -mt-0.5">
                  {!isAthletics && (isAdmin || isCreator) && (
                    <button
                      onClick={() => onEdit(event)}
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                      aria-label="Edit event"
                    >
                      <Edit className="w-4 h-4 text-gray-400" />
                    </button>
                  )}
                  {!isAthletics && isAdmin && (
                    <button
                      onClick={() => onDelete(event)}
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-red-50 transition-colors"
                      aria-label="Delete event"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
              <h2 id="detail-panel-title" className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                {isAthletics && <Trophy className="w-5 h-5 flex-shrink-0 text-amber-500" />}
                {event.title}
              </h2>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {/* Athletics-specific info */}
              {isAthletics && athleticsMeta && (
                <div className="mb-4 pb-4 border-b border-gray-100">
                  {/* Sport badge */}
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-xs font-medium px-2.5 py-1 rounded-full"
                      style={{
                        backgroundColor: `${athleticsMeta.sportColor}15`,
                        color: athleticsMeta.sportColor,
                      }}
                    >
                      {athleticsMeta.sportName}
                    </span>
                    <span className="text-xs text-gray-400">
                      {athleticsMeta.teamLevel}
                    </span>
                  </div>

                  {/* Game-specific details */}
                  {athleticsMeta.athleticsType === 'game' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <Swords className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="text-sm">
                          <span className="text-gray-500">
                            {athleticsMeta.homeAway === 'HOME' ? 'vs' : '@'}{' '}
                          </span>
                          <span className="font-medium text-gray-900">{athleticsMeta.opponentName}</span>
                          <span className="ml-2 text-xs text-gray-400">
                            ({athleticsMeta.homeAway === 'HOME' ? 'Home' : athleticsMeta.homeAway === 'AWAY' ? 'Away' : 'Neutral'})
                          </span>
                        </div>
                      </div>
                      {athleticsMeta.venue && (
                        <div className="flex items-center gap-3">
                          <MapPinned className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-700">{athleticsMeta.venue}</span>
                        </div>
                      )}
                      {athleticsMeta.isFinal && athleticsMeta.homeScore != null && athleticsMeta.awayScore != null && (
                        <div className="flex items-center gap-3 mt-1">
                          <div className="w-4" />
                          <div className="text-sm font-semibold">
                            <span className="text-gray-900">
                              {athleticsMeta.homeAway === 'HOME' ? athleticsMeta.homeScore : athleticsMeta.awayScore}
                            </span>
                            <span className="text-gray-400 mx-1">–</span>
                            <span className="text-gray-900">
                              {athleticsMeta.homeAway === 'HOME' ? athleticsMeta.awayScore : athleticsMeta.homeScore}
                            </span>
                            <span className="ml-2 text-xs font-normal text-gray-400">Final</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Practice-specific details */}
                  {athleticsMeta.athleticsType === 'practice' && (
                    <div className="space-y-2">
                      {athleticsMeta.location && (
                        <div className="flex items-center gap-3">
                          <MapPinned className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-700">{athleticsMeta.location}</span>
                        </div>
                      )}
                      {athleticsMeta.notes && (
                        <p className="text-sm text-gray-600 pl-7">{athleticsMeta.notes}</p>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-gray-400 mt-3">
                    Managed from the Athletics tab
                  </p>
                </div>
              )}

              <div className="space-y-1">
                {/* Date/Time — icon row */}
                <div className="flex items-start gap-4 py-3">
                  <Clock className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-gray-900">
                      {formatDateTime(event.startTime, event.isAllDay)}
                    </p>
                    {!event.isAllDay && (
                      <p className="text-sm text-gray-500">
                        to {formatDateTime(event.endTime, false)}
                      </p>
                    )}
                    {event.isAllDay && <p className="text-xs text-gray-400 mt-0.5">All-day event</p>}
                  </div>
                </div>

                {/* Location — icon row */}
                {(event.locationText || event.building) && (
                  <div className="flex items-start gap-4 py-3">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      {event.locationText && (
                        <p className="text-sm text-gray-900">{event.locationText}</p>
                      )}
                      {event.building && (
                        <p className="text-sm text-gray-500">
                          {event.building.name}
                          {event.area && ` · ${event.area.name}`}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Calendar — icon row */}
                <div className="flex items-center gap-4 py-3">
                  <Calendar className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: event.calendar.color }}
                    />
                    <span className="text-sm text-gray-900">{event.calendar.name}</span>
                  </div>
                </div>

                {/* Category — icon row */}
                {event.category && (
                  <div className="flex items-center gap-4 py-3">
                    <Tag className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <span
                      className="text-sm font-medium px-2.5 py-1 rounded-full"
                      style={{
                        backgroundColor: `${event.category.color}12`,
                        color: event.category.color,
                      }}
                    >
                      {event.category.name}
                    </span>
                  </div>
                )}

                {/* Creator — icon row */}
                {event.createdBy && (
                  <div className="flex items-center gap-4 py-3">
                    <User className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                        {event.createdBy.avatar ? (
                          <img src={event.createdBy.avatar} alt="" className="w-full h-full rounded-full" />
                        ) : (
                          <span className="text-xs font-medium text-gray-500">
                            {(event.createdBy.firstName?.[0] || event.createdBy.name?.[0] || '?').toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-900">
                        {event.createdBy.firstName
                          ? `${event.createdBy.firstName} ${event.createdBy.lastName || ''}`
                          : event.createdBy.name || event.createdBy.email}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              {event.description && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{event.description}</p>
                </div>
              )}

              {/* Attendees */}
              {(event.attendees && event.attendees.length > 0 || isAdmin || isCreator) && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Attendees {event.attendees && event.attendees.length > 0 ? `(${event.attendees.length})` : ''}
                  </h3>
                  {event.attendees && event.attendees.length > 0 && (
                    <div className="space-y-1">
                      {event.attendees.map((a) => (
                        <div key={a.id} className="group flex items-center gap-2.5 py-1 rounded-lg hover:bg-gray-50 px-1 -mx-1">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                            {a.user.avatar ? (
                              <img src={a.user.avatar} alt="" className="w-full h-full rounded-full" />
                            ) : (
                              <span className="text-xs font-medium text-gray-500">
                                {(a.user.firstName?.[0] || a.user.name?.[0] || '?').toUpperCase()}
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-gray-900 truncate">
                            {a.user.firstName
                              ? `${a.user.firstName} ${a.user.lastName || ''}`
                              : a.user.name || 'Unknown'}
                          </span>
                          <span className={`text-xs ml-auto px-2 py-0.5 rounded-full ${
                            a.responseStatus === 'ACCEPTED' ? 'bg-green-50 text-green-600' :
                            a.responseStatus === 'DECLINED' ? 'bg-red-50 text-red-600' :
                            a.responseStatus === 'TENTATIVE' ? 'bg-amber-50 text-amber-600' :
                            'bg-gray-50 text-gray-500'
                          }`}>
                            {a.responseStatus.charAt(0) + a.responseStatus.slice(1).toLowerCase()}
                          </span>
                          {(isAdmin || isCreator) && (
                            <button
                              onClick={async () => {
                                try {
                                  await removeAttendee.mutateAsync({ eventId: event.id, userId: a.user.id })
                                  toast('Attendee removed', 'success')
                                } catch (err) {
                                  toast(err instanceof Error ? err.message : 'Failed to remove attendee', 'error')
                                }
                              }}
                              disabled={removeAttendee.isPending}
                              className="opacity-0 group-hover:opacity-100 p-1 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-full hover:bg-red-50 transition-all flex-shrink-0"
                              aria-label={`Remove ${a.user.firstName || 'attendee'}`}
                            >
                              <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add attendee */}
                  {(isAdmin || isCreator) && (
                    <div className="mt-2">
                      {showAddAttendee ? (
                        <div className="space-y-2">
                          <AttendeePicker
                            compact
                            value={[]}
                            onChange={async (selected: AttendeeSelection[]) => {
                              if (selected.length === 0) return
                              try {
                                await addAttendees.mutateAsync({
                                  eventId: event.id,
                                  userIds: selected.map((s) => s.id),
                                })
                                toast(`${selected.length === 1 ? 'Attendee' : 'Attendees'} added`, 'success')
                                setShowAddAttendee(false)
                              } catch (err) {
                                toast(err instanceof Error ? err.message : 'Failed to add attendees', 'error')
                              }
                            }}
                          />
                          <button
                            onClick={() => setShowAddAttendee(false)}
                            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowAddAttendee(true)}
                          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors py-1"
                        >
                          <UserPlus className="w-4 h-4" />
                          Add attendee
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Approval Status Section */}
              {(approvals.length > 0 || event.calendarStatus === 'DRAFT') && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-gray-400" />
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Approval Status
                    </h3>
                  </div>

                  {/* Submit for approval button (DRAFT + creator only) */}
                  {event.calendarStatus === 'DRAFT' && isCreator && approvals.length === 0 && (
                    <button
                      onClick={handleSubmitForApproval}
                      disabled={submitForApproval.isPending}
                      className="w-full py-2.5 text-sm font-semibold text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      {submitForApproval.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                      Submit for Approval
                    </button>
                  )}

                  {/* Approval channel rows */}
                  {approvals.length > 0 && (
                    <div className="space-y-1 divide-y divide-gray-50">
                      {approvals.map((approval) => (
                        <ApprovalChannelRow
                          key={approval.id}
                          approval={approval}
                          isAdmin={isAdmin}
                          onApprove={handleApprove}
                          onReject={handleRejectClick}
                          isApproving={approveEvent.isPending}
                          isRejecting={rejectEvent.isPending}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
