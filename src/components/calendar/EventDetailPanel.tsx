'use client'

import { X, Clock, MapPin, Calendar, User, Tag, Trash2, Edit } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CalendarEventData } from '@/lib/hooks/useCalendar'

interface EventDetailPanelProps {
  event: CalendarEventData | null
  onClose: () => void
  onEdit: (event: CalendarEventData) => void
  onDelete: (eventId: string) => void
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

export default function EventDetailPanel({ event, onClose, onEdit, onDelete }: EventDetailPanelProps) {
  if (!event) return null

  const status = statusStyles[event.calendarStatus] || statusStyles.DRAFT

  return (
    <AnimatePresence>
      {event && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-gray-100">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: event.calendar.color }}
                  />
                  <span className="text-xs font-medium text-gray-500">{event.calendar.name}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                    {status.label}
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 truncate">{event.title}</h2>
              </div>
              <div className="flex items-center gap-1 ml-3">
                <button
                  onClick={() => onEdit(event)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Edit event"
                >
                  <Edit className="w-4 h-4 text-gray-500" />
                </button>
                <button
                  onClick={() => onDelete(event.id)}
                  className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                  aria-label="Delete event"
                >
                  <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Date/Time */}
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDateTime(event.startTime, event.isAllDay)}
                  </p>
                  {!event.isAllDay && (
                    <p className="text-sm text-gray-500">
                      to {formatDateTime(event.endTime, false)}
                    </p>
                  )}
                  {event.isAllDay && <p className="text-xs text-gray-400">All-day event</p>}
                </div>
              </div>

              {/* Location */}
              {(event.locationText || event.building) && (
                <div className="flex items-start gap-3">
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

              {/* Category */}
              {event.category && (
                <div className="flex items-center gap-3">
                  <Tag className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <span
                    className="text-sm font-medium px-2.5 py-1 rounded-full"
                    style={{
                      backgroundColor: `${event.category.color}15`,
                      color: event.category.color,
                    }}
                  >
                    {event.category.name}
                  </span>
                </div>
              )}

              {/* Creator */}
              {event.createdBy && (
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                      {event.createdBy.avatar ? (
                        <img src={event.createdBy.avatar} alt="" className="w-full h-full rounded-full" />
                      ) : (
                        <span className="text-xs font-medium text-gray-600">
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

              {/* Description */}
              {event.description && (
                <div className="pt-3 border-t border-gray-100">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{event.description}</p>
                </div>
              )}

              {/* Attendees */}
              {event.attendees && event.attendees.length > 0 && (
                <div className="pt-3 border-t border-gray-100">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    Attendees ({event.attendees.length})
                  </h3>
                  <div className="space-y-2">
                    {event.attendees.map((a) => (
                      <div key={a.id} className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          {a.user.avatar ? (
                            <img src={a.user.avatar} alt="" className="w-full h-full rounded-full" />
                          ) : (
                            <span className="text-xs font-medium text-gray-600">
                              {(a.user.firstName?.[0] || a.user.name?.[0] || '?').toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-900 truncate">
                          {a.user.firstName
                            ? `${a.user.firstName} ${a.user.lastName || ''}`
                            : a.user.name || 'Unknown'}
                        </span>
                        <span className={`text-xs ml-auto px-1.5 py-0.5 rounded-full ${
                          a.responseStatus === 'ACCEPTED' ? 'bg-green-50 text-green-600' :
                          a.responseStatus === 'DECLINED' ? 'bg-red-50 text-red-600' :
                          a.responseStatus === 'TENTATIVE' ? 'bg-amber-50 text-amber-600' :
                          'bg-gray-50 text-gray-500'
                        }`}>
                          {a.responseStatus.charAt(0) + a.responseStatus.slice(1).toLowerCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
