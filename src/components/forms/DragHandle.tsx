'use client'

import { forwardRef } from 'react'
import { GripVertical } from 'lucide-react'

interface DragHandleProps {
  listeners?: Record<string, unknown>
  attributes?: Record<string, unknown>
}

const DragHandle = forwardRef<HTMLButtonElement, DragHandleProps>(
  function DragHandle({ listeners, attributes }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className="touch-none text-[#a8a49d] hover:text-[#6a6864] cursor-grab active:cursor-grabbing transition-colors duration-200 p-0.5 -ml-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-400/40"
        aria-label="Drag to reorder"
        {...listeners}
        {...attributes}
      >
        <GripVertical className="w-4 h-4" />
      </button>
    )
  }
)

export default DragHandle
