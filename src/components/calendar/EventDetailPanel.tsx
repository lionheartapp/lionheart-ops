'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { X, Clock, MapPin, Calendar, User, UserPlus, Tag, Trash2, Edit, CheckCircle, XCircle, Loader2, Shield, Trophy, Swords, MapPinned, ThumbsUp, ThumbsDown, HelpCircle, ExternalLink, Video, Repeat, Download, Copy } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getEventColor,
  useEventDetail,
  useUpdateEvent,
  useAddAttendees,
  useRemoveAttendee,
  useRsvp,
  getEventMetadata,
  type CalendarEventData,
  type EventMetadata,
} from '@/lib/hooks/useCalendar'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'
import { useToast } from '@/components/Toast'
import AttendeePicker, { type AttendeeSelection } from '@/components/calendar/AttendeePicker'
import RsvpDialog from '@/components/calendar/RsvpDialog'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'

interface EventDetailPanelProps {
  event: CalendarEventData | null
  onClose: () => void
  onEdit: (event: CalendarEventData) => void
  onDelete: (event: CalendarEventData) => void
  onDuplicate?: (event: CalendarEventData) => void
}

function downloadIcs(event: CalendarEventData) {
  const pad = (n: number) => n.toString().padStart(2, '0')
  const toIcsDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lionheart//Calendar//EN',
    'BEGIN:VEVENT',
    `DTSTART:${toIcsDate(event.startTime)}`,
    `DTEND:${toIcsDate(event.endTime)}`,
    `SUMMARY:${event.title.replace(/[,;\\]/g, '\\$&')}`,
  ]
  if (event.description) lines.push(`DESCRIPTION:${event.description.replace(/\n/g, '\\n').replace(/[,;\\]/g, '\\$&')}`)
  if (event.locationText) lines.push(`LOCATION:${event.locationText.replace(/[,;\\]/g, '\\$&')}`)
  lines.push(`UID:${event.id}@lionheartapp.com`)
  lines.push('END:VEVENT', 'END:VCALENDAR')

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '-').slice(0, 50)}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

function describeRecurrence(rrule: string): string {
  // Simple parser for common RRULE patterns — avoids importing the full rrule lib client-side
  const parts = rrule.replace('RRULE:', '').split(';').reduce<Record<string, string>>((acc, p) => {
    const [k, v] = p.split('=')
    if (k && v) acc[k] = v
    return acc
  }, {})

  const freq = parts.FREQ
  const interval = parseInt(parts.INTERVAL || '1', 10)
  const count = parts.COUNT ? parseInt(parts.COUNT, 10) : null
  const until = parts.UNTIL

  let base = ''
  switch (freq) {
    case 'DAILY': base = interval === 1 ? 'Daily' : `Every ${interval} days`; break
    case 'WEEKLY': base = interval === 1 ? 'Weekly' : `Every ${interval} weeks`; break
    case 'MONTHLY': base = interval === 1 ? 'Monthly' : `Every ${interval} months`; break
    case 'YEARLY': base = interval === 1 ? 'Yearly' : `Every ${interval} years`; break
    default: return 'Repeats'
  }

  if (parts.BYDAY) {
    const dayMap: Record<string, string> = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' }
    const days = parts.BYDAY.split(',').map((d) => dayMap[d] || d).join(', ')
    base += ` on ${days}`
  }

  if (count) base += `, ${count} times`
  if (until) {
    const d = new Date(until.replace(/(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3'))
    base += ` until ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }

  return base
}

function relativeEventTime(startIso: string): string | null {
  const now = new Date()
  const start = new Date(startIso)
  now.setHours(0, 0, 0, 0)
  const startDay = new Date(start)
  startDay.setHours(0, 0, 0, 0)
  const diffMs = startDay.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / 86_400_000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday'
  if (diffDays > 1 && diffDays <= 14) return `In ${diffDays} days`
  if (diffDays < -1 && diffDays >= -14) return `${Math.abs(diffDays)} days ago`
  return null
}

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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
  DRAFT: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Draft' },
  PENDING_APPROVAL: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending Approval' },
  CONFIRMED: { bg: 'bg-green-50', text: 'text-green-700', label: 'Confirmed' },
  TENTATIVE: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Tentative' },
  REJECTED: { bg: 'bg-red-50', text: 'text-red-700', label: 'Rejected' },
  CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Cancelled' },
}

export default function EventDetailPanel({ event, onClose, onEdit, onDelete, onDuplicate }: EventDetailPanelProps) {
  const focusTrapRef = useFocusTrap(!!event)
  const { toast } = useToast()

  // Fetch full event detail
  const { data: eventDetail } = useEventDetail(event?.id ?? null)

  // Inline editing
  const updateEvent = useUpdateEvent()
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [editingTime, setEditingTime] = useState(false)
  const [startDraft, setStartDraft] = useState('')
  const [endDraft, setEndDraft] = useState('')
  const [editingLocation, setEditingLocation] = useState(false)
  const [locationDraft, setLocationDraft] = useState('')

  // Attendee mutations
  const addAttendees = useAddAttendees()
  const removeAttendee = useRemoveAttendee()
  const [showAddAttendee, setShowAddAttendee] = useState(false)

  // RSVP
  const rsvpMutation = useRsvp()
  const [rsvpDialogStatus, setRsvpDialogStatus] = useState<'DECLINED' | 'TENTATIVE' | null>(null)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)

  // Client-side permission check (server enforces real permissions)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isCreator, setIsCreator] = useState(false)

  useEffect(() => {
    if (!event) return
    const role = localStorage.getItem('user-role')?.toLowerCase()
    setIsAdmin(role === 'super admin' || role === 'administrator' || role === 'super-admin' || role === 'admin')
    const email = localStorage.getItem('user-email')
    setIsCreator(!!email && event.createdBy?.email === email)
    setCurrentUserEmail(email)
  }, [event])

  useEffect(() => {
    if (!event) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [event, onClose])

  // Reset state when event changes
  useEffect(() => {
    setShowAddAttendee(false)
    setEditingTitle(false)
    setEditingDescription(false)
    setEditingTime(false)
    setEditingLocation(false)
  }, [event?.id])

  // RSVP: find current user's attendee record
  const myAttendee = useMemo(() => {
    if (!currentUserEmail || !eventDetail?.attendees) return null
    return eventDetail.attendees.find(
      (a: any) => a.user?.email === currentUserEmail
    ) || null
  }, [currentUserEmail, eventDetail])

  const handleRsvp = async (status: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE', responseNote?: string) => {
    if (!event) return
    try {
      await rsvpMutation.mutateAsync({ eventId: event.id, status, responseNote })
      toast(`RSVP: ${status === 'ACCEPTED' ? 'Accepted' : status === 'DECLINED' ? 'Declined' : 'Maybe'}`, 'success')
      setRsvpDialogStatus(null)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to RSVP', 'error')
    }
  }

  const eventMeta: EventMetadata | null = event ? getEventMetadata(event) : null
  const isAthletics = !!eventMeta?.athleticsType
  const athleticsMeta = isAthletics ? eventMeta : null
  const isExternal = event?.sourceModule === 'external'
  const externalMeta = isExternal ? (event?.metadata as { url?: string | null; conferenceUrl?: string | null; sourceCalendarName?: string | null } | null) : null

  const status = event ? (statusStyles[event.calendarStatus] || statusStyles.DRAFT) : statusStyles.DRAFT
  return (
    <AnimatePresence>
      {event && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-mobilenav"
            onClick={onClose}
          />

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
                  {!isAthletics && !isExternal && (isAdmin || isCreator) && (
                    <button
                      onClick={() => onEdit(event)}
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
                      aria-label="Edit event"
                    >
                      <Edit className="w-4 h-4 text-slate-400" />
                    </button>
                  )}
                  {!isAthletics && !isExternal && onDuplicate && (isAdmin || isCreator) && (
                    <button
                      onClick={() => onDuplicate(event)}
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
                      aria-label="Duplicate event"
                    >
                      <Copy className="w-4 h-4 text-slate-400" />
                    </button>
                  )}
                  {!isAthletics && !isExternal && isAdmin && (
                    <button
                      onClick={() => onDelete(event)}
                      className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-red-50 transition-colors"
                      aria-label="Delete event"
                    >
                      <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" />
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && titleDraft.trim()) {
                        try {
                          await updateEvent.mutateAsync({ id: event.id, title: titleDraft.trim() })
                          setEditingTitle(false)
                          toast('Title updated', 'success')
                        } catch { toast('Failed to update', 'error') }
                      }
                      if (e.key === 'Escape') setEditingTitle(false)
                    }}
                    className="flex-1 text-xl font-semibold text-slate-900"
                  />
                  <button
                    onClick={async () => {
                      if (!titleDraft.trim()) return
                      try {
                        await updateEvent.mutateAsync({ id: event.id, title: titleDraft.trim() })
                        setEditingTitle(false)
                        toast('Title updated', 'success')
                      } catch { toast('Failed to update', 'error') }
                    }}
                    disabled={updateEvent.isPending || !titleDraft.trim()}
                    className="p-1.5 rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <h2
                  id="detail-panel-title"
                  className={`text-xl font-semibold text-slate-900 flex items-center gap-2 ${(isAdmin || isCreator) && !isExternal && !isAthletics ? 'cursor-pointer hover:bg-slate-50 rounded-lg -mx-2 px-2 py-0.5 transition-colors' : ''}`}
                  onClick={() => {
                    if ((isAdmin || isCreator) && !isExternal && !isAthletics) {
                      setTitleDraft(event.title)
                      setEditingTitle(true)
                    }
                  }}
                >
                  {isAthletics && <Trophy className="w-5 h-5 flex-shrink-0 text-amber-500" />}
                  {event.title}
                </h2>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {/* External calendar event info */}
              {isExternal && (
                <div className="mb-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-600">
                      {externalMeta?.sourceCalendarName || event.calendar?.name || 'Google Calendar'}
                    </span>
                    <span className="text-xs text-slate-400">External</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {externalMeta?.conferenceUrl && (
                      <a
                        href={externalMeta.conferenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Video className="w-3.5 h-3.5" />
                        Join Meeting
                      </a>
                    )}

                    {externalMeta?.url && (
                      <a
                        href={externalMeta.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open in Google Calendar
                      </a>
                    )}
                  </div>

                  <p className="text-xs text-slate-400 mt-3">
                    This event is synced from your connected calendar (read-only)
                  </p>
                </div>
              )}

              {/* Event Project deep-link */}
              {event.sourceModule === 'event-project' && event.sourceId && (
                <div className="mb-4 pb-4 border-b border-slate-100">
                  {(event.calendarStatus === 'PENDING' || event.calendarStatus === 'PENDING_APPROVAL') && (
                    <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100">
                      <p className="text-xs font-medium text-amber-800">This event is awaiting approval.</p>
                      <p className="text-xs text-amber-600 mt-0.5">Review and approve from the event project page.</p>
                    </div>
                  )}
                  {event.calendarStatus === 'DRAFT' && (
                    <div className="mb-3 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-xs font-medium text-slate-700">This event is a draft and not yet visible to others.</p>
                    </div>
                  )}
                  <Link href={`/events/${event.sourceId}`}>
                    <button className="w-full px-4 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer flex items-center justify-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      View Event Project
                    </button>
                  </Link>
                </div>
              )}

              {/* Athletics-specific info */}
              {isAthletics && athleticsMeta && (
                <div className="mb-4 pb-4 border-b border-slate-100">
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
                    <span className="text-xs text-slate-400">
                      {athleticsMeta.teamLevel}
                    </span>
                  </div>

                  {/* Game-specific details */}
                  {athleticsMeta.athleticsType === 'game' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <Swords className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div className="text-sm">
                          <span className="text-slate-500">
                            {athleticsMeta.homeAway === 'HOME' ? 'vs' : '@'}{' '}
                          </span>
                          <span className="font-medium text-slate-900">{athleticsMeta.opponentName}</span>
                          <span className="ml-2 text-xs text-slate-400">
                            ({athleticsMeta.homeAway === 'HOME' ? 'Home' : athleticsMeta.homeAway === 'AWAY' ? 'Away' : 'Neutral'})
                          </span>
                        </div>
                      </div>
                      {athleticsMeta.venue && (
                        <div className="flex items-center gap-3">
                          <MapPinned className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="text-sm text-slate-700">{athleticsMeta.venue}</span>
                        </div>
                      )}
                      {athleticsMeta.isFinal && athleticsMeta.homeScore != null && athleticsMeta.awayScore != null && (
                        <div className="flex items-center gap-3 mt-1">
                          <div className="w-4" />
                          <div className="text-sm font-semibold">
                            <span className="text-slate-900">
                              {athleticsMeta.homeAway === 'HOME' ? athleticsMeta.homeScore : athleticsMeta.awayScore}
                            </span>
                            <span className="text-slate-400 mx-1">–</span>
                            <span className="text-slate-900">
                              {athleticsMeta.homeAway === 'HOME' ? athleticsMeta.awayScore : athleticsMeta.homeScore}
                            </span>
                            <span className="ml-2 text-xs font-normal text-slate-400">Final</span>
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
                          <MapPinned className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="text-sm text-slate-700">{athleticsMeta.location}</span>
                        </div>
                      )}
                      {athleticsMeta.notes && (
                        <p className="text-sm text-slate-600 pl-7">{athleticsMeta.notes}</p>
                      )}
                    </div>
                  )}

                  <p className="text-xs text-slate-400 mt-3">
                    Managed from the Athletics tab
                  </p>
                </div>
              )}

              <div className="space-y-1">
                {/* Date/Time — icon row, inline editable */}
                <div className="flex items-start gap-4 py-3">
                  <Clock className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                  {editingTime ? (
                    <div className="space-y-2 flex-1">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500">Start</label>
                        <Input
                          size="sm"
                          type="datetime-local"
                          value={startDraft}
                          onChange={(e) => setStartDraft(e.target.value)}
                          className="w-full text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500">End</label>
                        <Input
                          size="sm"
                          type="datetime-local"
                          value={endDraft}
                          onChange={(e) => setEndDraft(e.target.value)}
                          className="w-full text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            try {
                              await updateEvent.mutateAsync({
                                id: event.id,
                                startTime: new Date(startDraft).toISOString(),
                                endTime: new Date(endDraft).toISOString(),
                              })
                              setEditingTime(false)
                              toast('Time updated', 'success')
                            } catch { toast('Failed to update', 'error') }
                          }}
                          disabled={updateEvent.isPending}
                          className="px-3 py-1 text-xs font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 cursor-pointer transition-colors"
                        >
                          {updateEvent.isPending ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingTime(false)}
                          className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`${(isAdmin || isCreator) && !isExternal && !isAthletics ? 'cursor-pointer hover:bg-slate-50 rounded-lg -mx-2 px-2 py-0.5 transition-colors' : ''}`}
                      onClick={() => {
                        if ((isAdmin || isCreator) && !isExternal && !isAthletics) {
                          setStartDraft(toLocalInput(event.startTime))
                          setEndDraft(toLocalInput(event.endTime))
                          setEditingTime(true)
                        }
                      }}
                    >
                      <p className="text-sm text-slate-900">
                        {formatDateTime(event.startTime, event.isAllDay)}
                        {(() => {
                          const rel = relativeEventTime(event.startTime)
                          return rel ? <span className="ml-2 text-xs text-slate-400 font-normal">({rel})</span> : null
                        })()}
                      </p>
                      {!event.isAllDay && (
                        <p className="text-sm text-slate-500">
                          to {formatDateTime(event.endTime, false)}
                        </p>
                      )}
                      {event.isAllDay && <p className="text-xs text-slate-400 mt-0.5">All-day event</p>}
                    </div>
                  )}
                </div>

                {/* Recurrence info */}
                {(event.rrule || event.parentEventId) && (
                  <div className="flex items-center gap-4 py-3">
                    <Repeat className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <p className="text-sm text-slate-600">
                      {event.rrule ? describeRecurrence(event.rrule) : 'Part of a recurring series'}
                    </p>
                  </div>
                )}

                {/* Location — icon row, inline editable */}
                <div className="flex items-start gap-4 py-3">
                  <MapPin className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                  {editingLocation ? (
                    <div className="space-y-2 flex-1">
                      <Input
                        size="sm"
                        autoFocus
                        value={locationDraft}
                        onChange={(e) => setLocationDraft(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            try {
                              await updateEvent.mutateAsync({ id: event.id, locationText: locationDraft.trim() || '' })
                              setEditingLocation(false)
                              toast('Location updated', 'success')
                            } catch { toast('Failed to update', 'error') }
                          }
                          if (e.key === 'Escape') setEditingLocation(false)
                        }}
                        placeholder="Enter location..."
                        className="w-full text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            try {
                              await updateEvent.mutateAsync({ id: event.id, locationText: locationDraft.trim() || '' })
                              setEditingLocation(false)
                              toast('Location updated', 'success')
                            } catch { toast('Failed to update', 'error') }
                          }}
                          disabled={updateEvent.isPending}
                          className="px-3 py-1 text-xs font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 cursor-pointer transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingLocation(false)}
                          className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 cursor-pointer transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (event.locationText || event.building) ? (
                    <div
                      className={`${(isAdmin || isCreator) && !isExternal && !isAthletics ? 'cursor-pointer hover:bg-slate-50 rounded-lg -mx-2 px-2 py-0.5 transition-colors' : ''}`}
                      onClick={() => {
                        if ((isAdmin || isCreator) && !isExternal && !isAthletics) {
                          setLocationDraft(event.locationText || '')
                          setEditingLocation(true)
                        }
                      }}
                    >
                      {event.locationText && (
                        <p className="text-sm text-slate-900">{event.locationText}</p>
                      )}
                      {event.building && (
                        <p className="text-sm text-slate-500">
                          {event.building.name}
                          {event.area && ` · ${event.area.name}`}
                        </p>
                      )}
                    </div>
                  ) : (isAdmin || isCreator) && !isExternal && !isAthletics ? (
                    <button
                      onClick={() => { setLocationDraft(''); setEditingLocation(true) }}
                      className="text-sm text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      Add location...
                    </button>
                  ) : (
                    <p className="text-sm text-slate-400">No location</p>
                  )}
                </div>

                {/* Calendar — icon row */}
                <div className="flex items-center gap-4 py-3">
                  <Calendar className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: event.calendar.color }}
                    />
                    <span className="text-sm text-slate-900">{event.calendar.name}</span>
                  </div>
                </div>

                {/* Category — icon row */}
                {event.category && (
                  <div className="flex items-center gap-4 py-3">
                    <Tag className="w-5 h-5 text-slate-400 flex-shrink-0" />
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
                    <User className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                        {event.createdBy.avatar ? (
                          <img src={event.createdBy.avatar} alt="" className="w-full h-full rounded-full" />
                        ) : (
                          <span className="text-xs font-medium text-slate-500">
                            {(event.createdBy.firstName?.[0] || event.createdBy.name?.[0] || '?').toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-slate-900">
                        {event.createdBy.firstName
                          ? `${event.createdBy.firstName} ${event.createdBy.lastName || ''}`
                          : event.createdBy.name || event.createdBy.email}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Description — inline editable for admins/creators */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                {editingDescription ? (
                  <div className="space-y-2">
                    <Textarea
                      autoFocus
                      value={descriptionDraft}
                      onChange={(e) => setDescriptionDraft(e.target.value)}
                      className="w-full text-sm text-slate-700 resize-none"
                      rows={4}
                      placeholder="Add a description..."
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          try {
                            await updateEvent.mutateAsync({ id: event.id, description: descriptionDraft })
                            setEditingDescription(false)
                            toast('Description updated', 'success')
                          } catch {
                            toast('Failed to update', 'error')
                          }
                        }}
                        disabled={updateEvent.isPending}
                        className="px-3 py-1 text-xs font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 disabled:opacity-50 cursor-pointer transition-colors"
                      >
                        {updateEvent.isPending ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingDescription(false)}
                        className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 cursor-pointer transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : event.description ? (
                  <p
                    className={`text-sm text-slate-700 whitespace-pre-wrap ${(isAdmin || isCreator) && !isExternal && !isAthletics ? 'cursor-pointer hover:bg-slate-50 rounded-lg -mx-2 px-2 py-1 transition-colors' : ''}`}
                    onClick={() => {
                      if ((isAdmin || isCreator) && !isExternal && !isAthletics) {
                        setDescriptionDraft(event.description || '')
                        setEditingDescription(true)
                      }
                    }}
                  >
                    {event.description}
                  </p>
                ) : (isAdmin || isCreator) && !isExternal && !isAthletics ? (
                  <button
                    onClick={() => { setDescriptionDraft(''); setEditingDescription(true) }}
                    className="text-sm text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    Add a description...
                  </button>
                ) : null}
              </div>

              {/* Attendees */}
              {(event.attendees && event.attendees.length > 0 || isAdmin || isCreator) && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Attendees {event.attendees && event.attendees.length > 0 ? (() => {
                      const a = eventDetail?.attendees || event.attendees || []
                      const yes = a.filter((x: any) => x.responseStatus === 'ACCEPTED').length
                      const no = a.filter((x: any) => x.responseStatus === 'DECLINED').length
                      const maybe = a.filter((x: any) => x.responseStatus === 'TENTATIVE').length
                      const pending = a.filter((x: any) => x.responseStatus === 'PENDING').length
                      const parts: string[] = []
                      if (yes) parts.push(`${yes} yes`)
                      if (no) parts.push(`${no} no`)
                      if (maybe) parts.push(`${maybe} maybe`)
                      if (pending) parts.push(`${pending} pending`)
                      return `(${parts.join(', ')})`
                    })() : ''}
                  </h3>
                  {/* RSVP buttons for current user */}
                  {myAttendee && (
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-50">
                      <span className="text-xs text-slate-500 mr-1">Your RSVP:</span>
                      <button
                        onClick={() => handleRsvp('ACCEPTED')}
                        disabled={rsvpMutation.isPending}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors cursor-pointer flex items-center gap-1 ${
                          myAttendee.responseStatus === 'ACCEPTED'
                            ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
                            : 'bg-slate-50 text-slate-600 hover:bg-green-50 hover:text-green-700'
                        }`}
                      >
                        <ThumbsUp className="w-3 h-3" />
                        Yes
                      </button>
                      <button
                        onClick={() => setRsvpDialogStatus('TENTATIVE')}
                        disabled={rsvpMutation.isPending}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors cursor-pointer flex items-center gap-1 ${
                          myAttendee.responseStatus === 'TENTATIVE'
                            ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                            : 'bg-slate-50 text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                        }`}
                      >
                        <HelpCircle className="w-3 h-3" />
                        Maybe
                      </button>
                      <button
                        onClick={() => setRsvpDialogStatus('DECLINED')}
                        disabled={rsvpMutation.isPending}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-colors cursor-pointer flex items-center gap-1 ${
                          myAttendee.responseStatus === 'DECLINED'
                            ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                            : 'bg-slate-50 text-slate-600 hover:bg-red-50 hover:text-red-700'
                        }`}
                      >
                        <ThumbsDown className="w-3 h-3" />
                        No
                      </button>
                    </div>
                  )}
                  {event.attendees && event.attendees.length > 0 && (
                    <div className="space-y-1">
                      {(eventDetail?.attendees || event.attendees || []).map((a: any) => (
                        <div key={a.id || a.user?.id}>
                        <div className="group flex items-center gap-2.5 py-1 rounded-lg hover:bg-slate-50 px-1 -mx-1">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                            {a.user.avatar ? (
                              <img src={a.user.avatar} alt="" className="w-full h-full rounded-full" />
                            ) : (
                              <span className="text-xs font-medium text-slate-500">
                                {(a.user.firstName?.[0] || a.user.name?.[0] || '?').toUpperCase()}
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-slate-900 truncate">
                            {a.user.firstName
                              ? `${a.user.firstName} ${a.user.lastName || ''}`
                              : a.user.name || 'Unknown'}
                          </span>
                          <span className={`text-xs ml-auto px-2 py-0.5 rounded-full ${
                            a.responseStatus === 'ACCEPTED' ? 'bg-green-50 text-green-600' :
                            a.responseStatus === 'DECLINED' ? 'bg-red-50 text-red-600' :
                            a.responseStatus === 'TENTATIVE' ? 'bg-amber-50 text-amber-600' :
                            'bg-slate-50 text-slate-500'
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
                              className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 p-1 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-full hover:bg-red-50 transition-all flex-shrink-0"
                              aria-label={`Remove ${a.user.firstName || 'attendee'}`}
                            >
                              <X className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                            </button>
                          )}
                        </div>
                        {(a.responseStatus === 'DECLINED' || a.responseStatus === 'TENTATIVE') && a.responseNote && (isAdmin || isCreator) && (
                          <p className="text-xs text-slate-400 italic ml-11 -mt-0.5 mb-1">&ldquo;{a.responseNote}&rdquo;</p>
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
                            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowAddAttendee(true)}
                          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors py-1"
                        >
                          <UserPlus className="w-4 h-4" />
                          Add attendee
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Add to personal calendar (ICS download) */}
              {!isExternal && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => downloadIcs(event)}
                    className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Add to personal calendar
                  </button>
                </div>
              )}

              {/* Approval now handled via EventProject gates — see /events/[id] */}
            </div>
          </motion.div>

          <RsvpDialog
            isOpen={!!rsvpDialogStatus}
            status={rsvpDialogStatus || 'DECLINED'}
            onSubmit={(note) => handleRsvp(rsvpDialogStatus!, note)}
            onCancel={() => setRsvpDialogStatus(null)}
          />
        </>
      )}
    </AnimatePresence>
  )
}
