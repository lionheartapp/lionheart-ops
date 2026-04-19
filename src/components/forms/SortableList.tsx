'use client'

import { useState, type ReactNode } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
// ─── SortableItem wrapper ─────────────────────────────────────────────────────

interface SortableItemProps {
  id: string
  children: (props: {
    listeners: Record<string, unknown>
    attributes: Record<string, unknown>
    setNodeRef: (node: HTMLElement | null) => void
    isDragging: boolean
  }) => ReactNode
}

function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style}>
      {children({
        listeners: listeners ?? {},
        attributes: (attributes ?? {}) as unknown as Record<string, unknown>,
        setNodeRef: () => {},
        isDragging,
      })}
    </div>
  )
}

// ─── SortableList ─────────────────────────────────────────────────────────────

interface SortableListProps<T> {
  items: T[]
  keyFn: (item: T) => string
  onReorder: (items: T[]) => void
  renderItem: (
    item: T,
    index: number,
    dragProps: {
      listeners: Record<string, unknown>
      attributes: Record<string, unknown>
    }
  ) => ReactNode
  className?: string
}

export default function SortableList<T>({
  items,
  keyFn,
  onReorder,
  renderItem,
  className = 'space-y-2',
}: SortableListProps<T>) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const ids = items.map(keyFn)

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return

    onReorder(arrayMove([...items], oldIndex, newIndex))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item, index) => {
            const id = keyFn(item)
            return (
              <SortableItem key={id} id={id}>
                {({ listeners, attributes }) =>
                  renderItem(item, index, { listeners, attributes })
                }
              </SortableItem>
            )
          })}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeId ? (
          <div className="opacity-80 shadow-lg rounded-2xl">
            {(() => {
              const idx = ids.indexOf(activeId)
              if (idx === -1) return null
              return renderItem(items[idx], idx, { listeners: {}, attributes: {} })
            })()}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
