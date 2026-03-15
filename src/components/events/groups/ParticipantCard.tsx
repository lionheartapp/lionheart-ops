'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Shield, GripVertical, X } from 'lucide-react'
import type { GroupParticipant } from '@/lib/hooks/useEventGroups'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ParticipantCardProps {
  participant: GroupParticipant
  /** If draggable=true, the card is in the unassigned pool and can be dragged. */
  draggable?: boolean
  /** If onRemove is provided, show an X button to remove from group. */
  onRemove?: () => void
  /** Overlay mode: slightly scaled up, no drag handle shown. */
  isOverlay?: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getInitials(first: string | null, last: string | null): string {
  const f = first?.charAt(0).toUpperCase() ?? ''
  const l = last?.charAt(0).toUpperCase() ?? ''
  return `${f}${l}` || '?'
}

const GRADE_COLORS: Record<string, string> = {
  'K': 'bg-purple-100 text-purple-700',
  '1': 'bg-blue-100 text-blue-700',
  '2': 'bg-blue-100 text-blue-700',
  '3': 'bg-green-100 text-green-700',
  '4': 'bg-green-100 text-green-700',
  '5': 'bg-yellow-100 text-yellow-700',
  '6': 'bg-orange-100 text-orange-700',
  '7': 'bg-orange-100 text-orange-700',
  '8': 'bg-red-100 text-red-700',
}

function gradeColor(grade: string | null): string {
  if (!grade) return 'bg-gray-100 text-gray-600'
  return GRADE_COLORS[grade] ?? 'bg-gray-100 text-gray-600'
}

// ─── Draggable Inner Card ────────────────────────────────────────────────────────

function DraggableCard({ participant, onRemove, isOverlay }: ParticipantCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `participant-${participant.registrationId}`,
    data: { registrationId: participant.registrationId, participant },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-2.5 px-3 py-2 rounded-xl
        bg-white border border-gray-200
        transition-shadow duration-150
        ${isOverlay ? 'shadow-xl scale-105 rotate-1 border-blue-300' : 'hover:shadow-md hover:border-gray-300'}
        ${isDragging ? '' : 'cursor-grab active:cursor-grabbing'}
      `}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        {...attributes}
        className="text-gray-300 hover:text-gray-500 flex-shrink-0 touch-none"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      {/* Avatar */}
      <Avatar participant={participant} size="sm" />

      {/* Name + grade */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate leading-tight">
          {participant.firstName} {participant.lastName}
        </p>
        {participant.grade && (
          <span
            className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none mt-0.5 ${gradeColor(participant.grade)}`}
          >
            Gr. {participant.grade}
          </span>
        )}
      </div>

      {/* Medical flag */}
      {participant.hasMedicalFlags && (
        <span aria-label="Has medical flags">
          <Shield className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
        </span>
      )}

      {/* Remove button */}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0 cursor-pointer"
          aria-label="Remove from group"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

// ─── Static Card (in group, not draggable from pool) ────────────────────────────

function StaticCard({ participant, onRemove }: ParticipantCardProps) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white border border-gray-200 hover:shadow-sm transition-shadow">
      <Avatar participant={participant} size="sm" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate leading-tight">
          {participant.firstName} {participant.lastName}
        </p>
        {participant.grade && (
          <span
            className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none mt-0.5 ${gradeColor(participant.grade)}`}
          >
            Gr. {participant.grade}
          </span>
        )}
      </div>

      {participant.hasMedicalFlags && (
        <span aria-label="Has medical flags">
          <Shield className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
        </span>
      )}

      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0 cursor-pointer"
          title="Remove from group"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

// ─── Avatar Sub-component ────────────────────────────────────────────────────────

export function Avatar({
  participant,
  size = 'sm',
}: {
  participant: GroupParticipant
  size?: 'sm' | 'md'
}) {
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'

  if (participant.photoUrl) {
    return (
      <img
        src={participant.photoUrl}
        alt={`${participant.firstName} ${participant.lastName}`}
        className={`${dim} rounded-full object-cover flex-shrink-0`}
      />
    )
  }

  return (
    <div
      className={`${dim} rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-semibold flex-shrink-0`}
    >
      {getInitials(participant.firstName, participant.lastName)}
    </div>
  )
}

// ─── Main Export ─────────────────────────────────────────────────────────────────

export default function ParticipantCard(props: ParticipantCardProps) {
  if (props.draggable) {
    return <DraggableCard {...props} />
  }
  return <StaticCard {...props} />
}
