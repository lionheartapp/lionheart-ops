'use client'

import { useDroppable } from '@dnd-kit/core'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Technician {
  id: string
  firstName: string
  lastName: string
}

interface TechnicianAssignPanelProps {
  technicians: Technician[]
  /** True when a drag is in progress — highlights the panel */
  isDragging: boolean
  /** ID of the technician target currently being hovered */
  hoveredTechId?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

// ─── TechAvatar (individual droppable) ───────────────────────────────────────

function TechAvatar({ tech, isDragging }: { tech: Technician; isDragging: boolean }) {
  const droppableId = `tech-${tech.id}`
  const { setNodeRef, isOver } = useDroppable({ id: droppableId })

  return (
    <div ref={setNodeRef} className="flex flex-col items-center gap-1">
      <div
        className={[
          'w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-150',
          isOver
            ? 'bg-emerald-500 text-white ring-2 ring-emerald-400 ring-offset-1 scale-110'
            : isDragging
            ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
            : 'bg-gray-100 text-gray-600',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {getInitials(tech.firstName, tech.lastName)}
      </div>
      <span
        className={[
          'text-[10px] truncate max-w-[56px] transition-colors duration-150',
          isOver ? 'text-emerald-700 font-semibold' : 'text-gray-400',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {tech.firstName}
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TechnicianAssignPanel({
  technicians,
  isDragging,
}: TechnicianAssignPanelProps) {
  if (technicians.length === 0) return null

  return (
    <div
      className={[
        'flex items-center gap-4 px-4 py-2.5 rounded-xl border transition-all duration-200',
        isDragging
          ? 'bg-emerald-50/60 border-emerald-200 shadow-sm'
          : 'bg-gray-50/40 border-gray-200/60',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        className={`text-xs font-medium whitespace-nowrap transition-colors ${
          isDragging ? 'text-emerald-700' : 'text-gray-400'
        }`}
      >
        Drag to assign:
      </span>
      <div className="flex items-center gap-3 overflow-x-auto pb-0.5">
        {technicians.map((tech) => (
          <TechAvatar key={tech.id} tech={tech} isDragging={isDragging} />
        ))}
      </div>
    </div>
  )
}
