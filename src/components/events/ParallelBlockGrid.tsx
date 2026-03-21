'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical,
  MapPin,
  User,
  Clock,
  Loader2,
} from 'lucide-react'
import type { EventScheduleBlock } from '@/lib/hooks/useEventProject'

// ─── Block type config (shared shape from EventScheduleTab) ──────────────────

interface BlockTypeConfig {
  value: string
  label: string
  dotColor: string
  color: string
  bg: string
  isCustom?: boolean
  hexColor?: string
}

function getBlockTypeConfig(type: string, allTypes: BlockTypeConfig[]): BlockTypeConfig {
  return allTypes.find((t) => t.value === type) ?? allTypes[0]
}

function formatDuration(mins: number): string {
  if (mins < 0) mins = 0
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

// ─── Sortable Breakout Card ──────────────────────────────────────────────────

interface SortableBreakoutCardProps {
  block: EventScheduleBlock
  allTypes: BlockTypeConfig[]
  durationMins: number
  sectionStartTime: string
  onEdit: (block: EventScheduleBlock) => void
  onDelete: (blockId: string) => Promise<void>
  isDeleting?: boolean
}

function SortableBreakoutCard({
  block,
  allTypes,
  durationMins,
  sectionStartTime,
  onEdit,
  onDelete,
  isDeleting,
}: SortableBreakoutCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const displayType = (block.metadata as Record<string, unknown>)?.customType as string | undefined
  const typeConfig = getBlockTypeConfig(displayType || block.type, allTypes)

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
      className={`group relative bg-white border rounded-2xl p-4 cursor-default ${
        isDragging
          ? 'border-indigo-300 shadow-lg ring-2 ring-indigo-100'
          : isSorting
            ? 'border-slate-200/80'
            : 'border-slate-200/80 hover:border-slate-300 hover:shadow-sm transition-colors'
      }`}
    >
      {/* Color bar — full height */}
      <div
        className={`absolute left-12 top-3 bottom-3 w-0.5 rounded-full ${typeConfig.hexColor ? '' : typeConfig.dotColor}`}
        style={typeConfig.hexColor ? { backgroundColor: typeConfig.hexColor } : undefined}
      />

      <div className="flex gap-3">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="flex-shrink-0 p-1.5 -m-1.5 mt-0.5 rounded-lg opacity-40 group-hover:opacity-70 hover:bg-slate-100 transition-all cursor-grab active:cursor-grabbing"
          role="button"
          aria-label={`Reorder ${block.title}`}
        >
          <GripVertical className="w-4 h-4 text-slate-400" />
        </div>

        {/* Spacer for color bar */}
        <div className="flex-shrink-0 w-1" />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h5 className="text-sm font-medium text-slate-900 truncate">{block.title}</h5>
          <div className="space-y-0.5 mt-1">
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3 h-3 flex-shrink-0" />
              <span>{sectionStartTime}</span>
            </div>
            {block.locationText && (
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{block.locationText}</span>
              </div>
            )}
            {block.lead && (
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <User className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">
                  {block.lead.firstName
                    ? `${block.lead.firstName} ${block.lead.lastName || ''}`.trim()
                    : block.lead.email}
                </span>
              </div>
            )}
          </div>

          {/* Duration pill — bottom right */}
          <div className="flex justify-end mt-2">
            <div className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100">
              <span className="text-xs font-medium text-slate-500">{formatDuration(durationMins)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hover actions — top right */}
      <div
        className={`absolute top-3 right-3 flex items-center gap-1 transition-opacity ${
          isHovered && !isDragging ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          onClick={() => onEdit(block)}
          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
          title="Edit block"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        <button
          onClick={() => onDelete(block.id)}
          disabled={isDeleting}
          className="p-1.5 rounded-lg border border-slate-200 bg-white text-red-500 hover:bg-red-50 hover:border-red-200 transition-all cursor-pointer disabled:opacity-60"
          title="Delete block"
        >
          {isDeleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Parallel Block Grid ─────────────────────────────────────────────────────

export interface ParallelBlockGridProps {
  blocks: EventScheduleBlock[]
  allTypes: BlockTypeConfig[]
  sectionStartTime: string
  onEditBlock: (block: EventScheduleBlock) => void
  onDelete: (blockId: string) => Promise<void>
  deletingId: string | null
}

export function ParallelBlockGrid({
  blocks,
  allTypes,
  sectionStartTime,
  onEditBlock,
  onDelete,
  deletingId,
}: ParallelBlockGridProps) {
  // Format section start time for display (HH:mm → h:mm AM/PM)
  const formattedTime = (() => {
    const [h, m] = (sectionStartTime || '08:00').split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${h12}:${String(m).padStart(2, '0')} ${period}`
  })()

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {blocks.map((block) => {
        const startsAt = new Date(block.startsAt)
        const endsAt = new Date(block.endsAt)
        const durationMins = Math.max(Math.round((endsAt.getTime() - startsAt.getTime()) / 60000), 1)

        return (
          <SortableBreakoutCard
            key={block.id}
            block={block}
            allTypes={allTypes}
            durationMins={durationMins}
            sectionStartTime={formattedTime}
            onEdit={onEditBlock}
            onDelete={onDelete}
            isDeleting={deletingId === block.id}
          />
        )
      })}
    </div>
  )
}
