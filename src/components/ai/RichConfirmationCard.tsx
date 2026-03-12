'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarPlus, Clock, MapPin, Check, AlertTriangle, X, Wrench, Tag, AlertCircle, Users, ClipboardList, Calendar } from 'lucide-react'
import type { ActionConfirmation as ActionConfirmationType, ConfirmationCardData } from '@/lib/types/assistant'

const CATEGORY_LABELS: Record<string, string> = {
  PLUMBING: 'Plumbing',
  ELECTRICAL: 'Electrical',
  HVAC: 'HVAC',
  STRUCTURAL: 'Structural',
  CUSTODIAL_BIOHAZARD: 'Custodial / Biohazard',
  IT_AV: 'IT / AV',
  GROUNDS: 'Grounds',
  OTHER: 'Other',
}

const PRIORITY_STYLES: Record<string, { bg: string; text: string }> = {
  URGENT: { bg: 'bg-red-100', text: 'text-red-700' },
  HIGH: { bg: 'bg-orange-100', text: 'text-orange-700' },
  MEDIUM: { bg: 'bg-blue-100', text: 'text-blue-700' },
  LOW: { bg: 'bg-gray-100', text: 'text-gray-600' },
}

interface RichConfirmationCardProps {
  action: ActionConfirmationType & { richCard?: ConfirmationCardData }
  onConfirm: (modifiedPayload?: Record<string, unknown>) => void
  onCancel: () => void
}

/**
 * Rich event confirmation card for AI-assisted event creation.
 * Replaces the generic ActionConfirmation overlay when a rich_confirmation SSE
 * event is received. Shows event details, resource availability warnings,
 * and allows inline title editing before confirming.
 */
export default function RichConfirmationCard({
  action,
  onConfirm,
  onCancel,
}: RichConfirmationCardProps) {
  const card = action.richCard
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState(card?.title || '')

  if (!card) return null

  const isTicket = card.cardType === 'ticket'

  const handleConfirm = () => {
    // If title was modified, pass updated payload with new title
    if (editedTitle !== card.title && editedTitle.trim()) {
      onConfirm({
        ...action.payload,
        title: editedTitle.trim(),
      })
    } else {
      onConfirm()
    }
  }

  const renderTicketContent = () => {
    if (card.cardType !== 'ticket') return null
    const priorityStyle = PRIORITY_STYLES[card.priority] || PRIORITY_STYLES.MEDIUM

    return (
      <>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-2 border-b border-gray-100">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50">
            <Wrench className="h-4 w-4 text-amber-600" />
          </div>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Create Maintenance Ticket
          </span>
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-2.5">
          {/* Editable Title */}
          <div>
            {isEditingTitle ? (
              <input
                autoFocus
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    setIsEditingTitle(false)
                  }
                }}
                className="w-full text-sm font-semibold text-gray-900 border border-blue-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              />
            ) : (
              <button
                className="text-left w-full group cursor-pointer"
                onClick={() => setIsEditingTitle(true)}
                title="Click to edit title"
              >
                <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-200">
                  {editedTitle || card.title}
                </span>
                <span className="ml-1.5 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  edit
                </span>
              </button>
            )}
          </div>

          {/* Category */}
          <div className="flex items-start gap-2">
            <Tag className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-gray-600">
              {CATEGORY_LABELS[card.category] || card.category}
            </span>
          </div>

          {/* Priority */}
          <div className="flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${priorityStyle.bg} ${priorityStyle.text}`}>
              {card.priority}
            </span>
          </div>

          {/* Location */}
          {card.location && (
            <div className="flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
              <span className="text-xs text-gray-600">{card.location}</span>
            </div>
          )}

          {/* Description */}
          {card.description && (
            <p className="text-xs text-gray-500 line-clamp-2 pl-0.5">
              {card.description}
            </p>
          )}
        </div>
      </>
    )
  }

  const renderEventContent = () => {
    if (card.cardType === 'ticket') return null
    return (
      <>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-2 border-b border-gray-100">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
            <CalendarPlus className="h-4 w-4 text-blue-600" />
          </div>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Create Event
          </span>
          {(card as any).calendarName && (
            <span className="ml-auto flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
              <Calendar className="h-3 w-3" />
              {(card as any).calendarName}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-2.5">
          {/* Editable Title */}
          <div>
            {isEditingTitle ? (
              <input
                autoFocus
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    setIsEditingTitle(false)
                  }
                }}
                className="w-full text-sm font-semibold text-gray-900 border border-blue-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              />
            ) : (
              <button
                className="text-left w-full group cursor-pointer"
                onClick={() => setIsEditingTitle(true)}
                title="Click to edit title"
              >
                <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-200">
                  {editedTitle || card.title}
                </span>
                <span className="ml-1.5 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  edit
                </span>
              </button>
            )}
          </div>

          {/* Date/Time */}
          <div className="flex items-start gap-2">
            <Clock className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-gray-600">
              {card.startDisplay}
              {card.endDisplay && card.endDisplay !== 'Not set' && (
                <> &mdash; {card.endDisplay}</>
              )}
            </span>
          </div>

          {/* Location */}
          {card.location && (
            <div className="flex items-start gap-2">
              <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
              <span className="text-xs text-gray-600">{card.location}</span>
            </div>
          )}

          {/* Conflict Warning */}
          {(card as any).conflictWarning && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
              <span className="text-xs font-medium text-amber-800">
                {(card as any).conflictWarning}
              </span>
            </div>
          )}

          {/* Description */}
          {card.description && (
            <p className="text-xs text-gray-500 line-clamp-2 pl-0.5">
              {card.description}
            </p>
          )}

          {/* Attendees */}
          {(card as any).attendees && (card as any).attendees.length > 0 && (
            <div className="flex items-start gap-2">
              <Users className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
              <span className="text-xs text-gray-600">
                {(card as any).attendees.join(', ')}
              </span>
            </div>
          )}

          {/* Equipment List */}
          {(card as any).equipmentList && (card as any).equipmentList.length > 0 && (
            <div className="pt-1">
              <div className="flex items-center gap-1.5 mb-1.5">
                <ClipboardList className="h-3.5 w-3.5 text-gray-500" />
                <p className="text-xs font-medium text-gray-700">Equipment Needed</p>
              </div>
              <div className="space-y-0.5 pl-0.5">
                {(card as any).equipmentList.map((eq: { item: string; quantity: number }, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    <span className="text-xs text-gray-600">
                      {eq.quantity > 1 ? `${eq.quantity}x ` : ''}{eq.item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resources */}
          {card.resources && card.resources.length > 0 && (
            <div className="pt-1">
              <p className="text-xs font-medium text-gray-700 mb-1.5">Resources</p>
              <div className="space-y-1">
                {card.resources.map((resource, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    {resource.status === 'ok' && (
                      <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                    )}
                    {resource.status === 'low' && (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                    )}
                    {resource.status === 'unavailable' && (
                      <X className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                    )}
                    <span className="text-xs text-gray-600">
                      {resource.name}
                      {resource.status === 'ok' && (
                        <span className="text-gray-400 ml-1">({resource.available} available)</span>
                      )}
                      {resource.status === 'low' && (
                        <span className="text-amber-600 ml-1">({resource.available} available &mdash; low stock)</span>
                      )}
                      {resource.status === 'unavailable' && (
                        <span className="text-red-500 ml-1">(unavailable)</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approval Channels */}
          {card.approvalChannels && card.approvalChannels.length > 0 && (
            <div className="pt-1">
              <p className="text-xs font-medium text-gray-700 mb-1.5">Approvals needed</p>
              <div className="space-y-0.5">
                {card.approvalChannels.map((channel, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-600">{channel}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Requires Approval Notice */}
          {(card as any).requiresApproval && (
            <div className="flex items-center gap-1.5 pt-1">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0 animate-pulse" />
              <span className="text-xs font-medium text-blue-600">
                Will be submitted for approval
              </span>
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 rounded-2xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
      >
        <motion.div
          className="mx-4 w-full max-w-sm rounded-xl bg-white border border-gray-200 shadow-lg"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
        >
          {isTicket ? renderTicketContent() : renderEventContent()}

          {/* Buttons */}
          <div className="flex gap-2 px-4 pb-4 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 px-5 py-2.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-colors duration-200 cursor-pointer"
              style={{ minHeight: '44px' }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-colors duration-200 cursor-pointer"
              style={{ minHeight: '44px' }}
            >
              Confirm
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
