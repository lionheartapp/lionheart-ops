'use client'

import { useState } from 'react'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import {
  Clock,
  MapPin,
  User,
  GripVertical,
  Loader2,
} from 'lucide-react'
import type { EventScheduleBlock } from '@/lib/hooks/useEventProject'
import type { EventScheduleSection } from '@/lib/hooks/useEventSchedule'
import type { BlockTypeConfig } from '@/lib/types/event-project'
import { getBlockTypeConfig, formatDuration } from '@/lib/schedule-utils'

// ─── Block Row Content (shared between sortable row and drag overlay) ────────

interface BlockRowContentProps {
  block: EventScheduleBlock
  allTypes: BlockTypeConfig[]
  durationMins: number
  timeRange: string
  isDragging?: boolean
  isOverlay?: boolean
}

export function BlockRowContent({ block, allTypes, durationMins, timeRange, isDragging, isOverlay }: BlockRowContentProps) {
  const displayType = (block.metadata as Record<string, unknown>)?.customType as string | undefined
  const typeConfig = getBlockTypeConfig(displayType || block.type, allTypes)
  const meta = (block.metadata as Record<string, unknown>) || {}
  const servicePos = (meta.servicePosition || meta.pcoServicePosition) as string | undefined

  return (
    <>
      {/* Category bar */}
      <div
        className={`flex-shrink-0 w-0.5 self-stretch rounded-full ${typeConfig.hexColor ? '' : typeConfig.dotColor}`}
        style={typeConfig.hexColor ? { backgroundColor: typeConfig.hexColor } : undefined}
      />

      {/* Title + time underneath */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-slate-900 truncate">{block.title}</span>
          {servicePos === 'pre' && (
            <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full flex-shrink-0">Pre</span>
          )}
          {servicePos === 'post' && (
            <span className="text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full flex-shrink-0">Post</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {!isOverlay && timeRange && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3 h-3 flex-shrink-0" />
              <span>{timeRange}</span>
            </div>
          )}
          {block.locationText && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <MapPin className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[120px]">{block.locationText}</span>
            </div>
          )}
          {block.lead && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <User className="w-3 h-3 flex-shrink-0" />
              <span className="truncate max-w-[100px]">
                {block.lead.firstName
                  ? `${block.lead.firstName} ${block.lead.lastName || ''}`.trim()
                  : block.lead.email}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Duration pill — at the end */}
      {!isOverlay && (
        <div className="flex-shrink-0 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100">
          <span className="text-xs font-medium text-slate-500">{formatDuration(durationMins)}</span>
        </div>
      )}
    </>
  )
}

// ─── Sortable Block Row ─────────────────────────────────────────────────────

interface SortableBlockRowProps {
  block: EventScheduleBlock
  allTypes: BlockTypeConfig[]
  durationMins: number
  timeRange: string
  onEdit: (block: EventScheduleBlock) => void
  onDelete: (blockId: string) => void
  isDeleting?: boolean
}

export function SortableBlockRow({
  block,
  allTypes,
  durationMins,
  timeRange,
  onEdit,
  onDelete,
  isDeleting,
}: SortableBlockRowProps) {
  const [isHovered, setIsHovered] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isSorting } = useSortable({
    id: block.id,
    transition: {
      duration: 250,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: 'relative' as const,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative flex items-center gap-3 px-3 py-3 bg-white border rounded-xl cursor-default ${
        isDragging
          ? 'border-indigo-300 shadow-lg ring-2 ring-indigo-100'
          : isSorting
            ? '' // During sort animation, don't add extra transitions that fight dnd-kit
            : 'hover:border-slate-300 hover:shadow-sm transition-colors'
      } ${!isDragging && !isSorting ? 'border-slate-200/80' : 'border-slate-200/80'}`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex-shrink-0 p-1.5 -m-1.5 rounded-lg opacity-40 group-hover:opacity-70 hover:bg-slate-100 transition-all cursor-grab active:cursor-grabbing"
        role="button"
        aria-label={`Reorder ${block.title}`}
      >
        <GripVertical className="w-4 h-4 text-slate-400" />
      </div>

      <BlockRowContent
        block={block}
        allTypes={allTypes}
        durationMins={durationMins}
        timeRange={timeRange}
      />

      {/* Hover actions — overlays on top of the duration pill */}
      <div className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pl-4 bg-gradient-to-l from-white via-white to-transparent transition-opacity ${isHovered && !isDragging ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button
          onClick={() => onEdit(block)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(block.id)}
          disabled={isDeleting}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-red-500 hover:bg-red-50 hover:border-red-200 transition-all cursor-pointer disabled:opacity-60"
        >
          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
        </button>
      </div>
    </div>
  )
}

// ─── Drag Overlay Preview ────────────────────────────────────────────────────

export function BlockRowOverlay({ block, allTypes }: { block: EventScheduleBlock; allTypes: BlockTypeConfig[] }) {
  return (
    <div className="flex items-center gap-3 px-3 py-3 bg-white border-2 border-indigo-300 rounded-xl shadow-xl ring-4 ring-indigo-50 cursor-grabbing max-w-[500px]">
      <div className="flex-shrink-0 p-1.5">
        <GripVertical className="w-4 h-4 text-indigo-400" />
      </div>
      <BlockRowContent block={block} allTypes={allTypes} durationMins={0} timeRange="" isOverlay />
    </div>
  )
}

// ─── Droppable Section Container ─────────────────────────────────────────────

interface DroppableSectionProps {
  sectionId: string
  children: React.ReactNode
  isOver?: boolean
}

export function DroppableSection({ sectionId, children, isOver }: DroppableSectionProps) {
  const { setNodeRef, isOver: dropIsOver } = useDroppable({ id: `section-${sectionId}` })
  const active = isOver || dropIsOver

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[48px] rounded-xl transition-all ${
        active ? 'bg-indigo-50/50 ring-2 ring-indigo-200 ring-dashed' : ''
      }`}
    >
      {children}
    </div>
  )
}

// ─── Sortable Section Wrapper ────────────────────────────────────────────────

interface SortableSectionCardProps {
  section: EventScheduleSection
  children: (listeners: Record<string, unknown>) => React.ReactNode
}

export function SortableSectionCard({ section, children }: SortableSectionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `sortable-section-${section.id}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children(listeners ?? {})}
    </div>
  )
}
