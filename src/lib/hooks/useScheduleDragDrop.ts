'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  type CollisionDetection,
} from '@dnd-kit/core'
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { UNSECTIONED } from '@/lib/schedule-utils'
import type { EventScheduleBlock } from '@/lib/hooks/useEventProject'
import type { EventScheduleSection } from '@/lib/hooks/useEventSchedule'
import type { UseMutationResult } from '@tanstack/react-query'

// ─── Types ───────────────────────────────────────────────────────────────

interface UseScheduleDragDropParams {
  dayBlocks: EventScheduleBlock[]
  sections: EventScheduleSection[] | undefined
  blocks: EventScheduleBlock[] | undefined
  assignBlock: UseMutationResult<unknown, unknown, { blockId: string; sectionId: string | null }>
  reorderBlocks: (blockIds: string[]) => void
  reorderSections: UseMutationResult<unknown, unknown, string[]>
}

interface UseScheduleDragDropResult {
  activeBlockId: string | null
  activeSectionId: string | null
  sensors: ReturnType<typeof useSensors>
  customCollision: CollisionDetection
  handleDragStart: (event: DragStartEvent) => void
  handleDragOver: (event: DragOverEvent) => void
  handleDragEnd: (event: DragEndEvent) => void
  handleDragCancel: () => void
  dragContainerMap: Record<string, string> | null
  dragOrderMap: Record<string, string[]> | null
  sectionedBlocks: {
    map: Record<string, EventScheduleBlock[]>
    unsectioned: EventScheduleBlock[]
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────

export function useScheduleDragDrop({
  dayBlocks,
  sections,
  blocks,
  assignBlock,
  reorderBlocks,
  reorderSections,
}: UseScheduleDragDropParams): UseScheduleDragDropResult {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [dragContainerMap, setDragContainerMap] = useState<Record<string, string> | null>(null)
  const [dragOrderMap, setDragOrderMap] = useState<Record<string, string[]> | null>(null)

  // ─── Sensors ─────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // ─── Custom collision detection ──────────────────────────────────────
  // Blocks-first, then sections as fallback. This ensures dragging over a
  // block in the same section triggers SortableContext shifting (not just
  // the section droppable zone).

  const customCollision: CollisionDetection = useCallback((args) => {
    const dragId = String(args.active.id)

    // If dragging a section, only consider other sortable-section items
    if (dragId.startsWith('sortable-section-')) {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter(
          (c) => String(c.id).startsWith('sortable-section-')
        ),
      })
    }

    // Dragging a block — section-aware collision detection
    const blockContainers = args.droppableContainers.filter((c) => {
      const id = String(c.id)
      return !id.startsWith('section-') && !id.startsWith('sortable-section-')
    })
    const sectionContainers = args.droppableContainers.filter((c) =>
      String(c.id).startsWith('section-')
    )

    // Determine which section the pointer is inside
    const sectionHits = pointerWithin({ ...args, droppableContainers: sectionContainers })

    if (sectionHits.length > 0) {
      const targetSectionId = sectionHits[0].id
      const sectionRect = args.droppableRects.get(targetSectionId)

      if (sectionRect) {
        // Find blocks whose vertical center falls within this section's rect
        const blocksInSection = blockContainers.filter((c) => {
          const blockRect = args.droppableRects.get(c.id)
          if (!blockRect) return false
          const blockCenterY = blockRect.top + blockRect.height / 2
          return blockCenterY >= sectionRect.top && blockCenterY <= sectionRect.bottom
        })

        if (blocksInSection.length > 0) {
          // Section has blocks — use closestCenter among them for reordering
          return closestCenter({ ...args, droppableContainers: blocksInSection })
        }

        // Section is empty — return the section drop zone for cross-section move
        return sectionHits
      }
    }

    // Pointer not inside any section — fall back to closest block
    const blockHits = closestCenter({ ...args, droppableContainers: blockContainers })
    if (blockHits.length > 0) return blockHits

    return closestCenter(args)
  }, [])

  // ─── Drag start ──────────────────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string
    if (id.startsWith('sortable-section-')) {
      setActiveSectionId(id.replace('sortable-section-', ''))
      setActiveBlockId(null)
      return
    }
    setActiveBlockId(id)
    setActiveSectionId(null)

    // Initialize container map + order map from current data
    const containerMap: Record<string, string> = {}
    const orderMap: Record<string, string[]> = {}

    for (const block of dayBlocks) {
      const container = block.sectionId ?? UNSECTIONED
      containerMap[block.id] = container
      if (!orderMap[container]) orderMap[container] = []
      orderMap[container].push(block.id)
    }

    setDragContainerMap(containerMap)
    setDragOrderMap(orderMap)
  }, [dayBlocks])

  // ─── Drag over (continuous — handles cross-container movement) ───────

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over || !dragContainerMap || !dragOrderMap) return

    const activeId = active.id as string
    // Skip section drags
    if (activeId.startsWith('sortable-section-')) return

    const overId = over.id as string

    // Determine which container the active block is currently in
    const activeContainer = dragContainerMap[activeId]
    if (!activeContainer) return

    // Determine target container
    let overContainer: string | null = null

    if (overId.startsWith('section-')) {
      // Dropped over a section drop zone
      const sectionId = overId.replace('section-', '')
      overContainer = sectionId === 'unsectioned' ? UNSECTIONED : sectionId
    } else if (overId.startsWith('sortable-section-')) {
      // Over a sortable section wrapper — ignore (that's for section reordering)
      return
    } else {
      // Over another block — get that block's container
      overContainer = dragContainerMap[overId] ?? null
    }

    if (!overContainer || activeContainer === overContainer) {
      // Same container — reorder within (SortableContext handles the visual shift)
      return
    }

    // Moving from one container to another
    const activeItems = [...(dragOrderMap[activeContainer] || [])]
    const overItems = [...(dragOrderMap[overContainer] || [])]

    // Remove from old container
    const fromIndex = activeItems.indexOf(activeId)
    if (fromIndex >= 0) activeItems.splice(fromIndex, 1)

    // Determine insert position in new container
    let insertIndex = overItems.length
    if (!overId.startsWith('section-')) {
      // Dropped on a specific block — insert at that position
      const overIndex = overItems.indexOf(overId)
      if (overIndex >= 0) {
        insertIndex = overIndex
      }
    }

    overItems.splice(insertIndex, 0, activeId)

    setDragContainerMap((prev) => ({
      ...prev!,
      [activeId]: overContainer!,
    }))
    setDragOrderMap((prev) => ({
      ...prev!,
      [activeContainer]: activeItems,
      [overContainer!]: overItems,
    }))
  }, [dragContainerMap, dragOrderMap])

  // ─── Drag end ────────────────────────────────────────────────────────

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const wasDraggingSection = activeSectionId !== null
    const currentContainerMap = dragContainerMap
    const currentOrderMap = dragOrderMap

    // Always clear overlay tracking (hides the drag overlay)
    setActiveBlockId(null)
    setActiveSectionId(null)

    // Helper to clear drag maps — called on every code path
    const clearDragMaps = () => {
      setDragContainerMap(null)
      setDragOrderMap(null)
    }

    const { active, over } = event
    if (!over) { clearDragMaps(); return }

    const activeId = active.id as string
    const overId = over.id as string

    // ─── Section reorder ───────────────────────────────────────────
    if (wasDraggingSection && activeId.startsWith('sortable-section-') && overId.startsWith('sortable-section-')) {
      clearDragMaps()
      if (activeId === overId) return
      const currentSections = sections || []
      const oldIndex = currentSections.findIndex((s) => `sortable-section-${s.id}` === activeId)
      const newIndex = currentSections.findIndex((s) => `sortable-section-${s.id}` === overId)
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(currentSections, oldIndex, newIndex)
        reorderSections.mutate(reordered.map((s) => s.id))
      }
      return
    }

    // ─── Block drag logic ──────────────────────────────────────────
    if (!currentContainerMap || !currentOrderMap) { clearDragMaps(); return }

    const block = blocks?.find((b) => b.id === activeId)
    if (!block) { clearDragMaps(); return }

    const originalContainer = block.sectionId ?? UNSECTIONED
    const finalContainer = currentContainerMap[activeId] ?? originalContainer
    const finalSectionId = finalContainer === UNSECTIONED ? null : finalContainer

    // Check if container changed
    if (originalContainer !== finalContainer) {
      // Cross-section move — fire mutations first, then delay clearing drag maps
      // so sectionedBlocks keeps showing the block in the new section until
      // the mutation's optimistic update takes over in the query cache.
      assignBlock.mutate({ blockId: activeId, sectionId: finalSectionId })
      const newOrder = currentOrderMap[finalContainer]
      if (newOrder && newOrder.length > 1) {
        reorderBlocks(newOrder)
      }
      requestAnimationFrame(clearDragMaps)
    } else {
      // Same container — clear immediately, then compute reorder
      clearDragMaps()
      // If over target is a section zone (not a block), nothing to reorder
      if (overId.startsWith('section-') || activeId === overId) return

      const containerBlocks = dayBlocks
        .filter((b) => (b.sectionId ?? UNSECTIONED) === finalContainer)
        .sort((a, b) => a.sortOrder - b.sortOrder)

      const oldIndex = containerBlocks.findIndex((b) => b.id === activeId)
      const newIndex = containerBlocks.findIndex((b) => b.id === overId)
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(containerBlocks, oldIndex, newIndex)
        reorderBlocks(reordered.map((b) => b.id))
      }
    }
  }, [blocks, dayBlocks, sections, activeSectionId, assignBlock, reorderBlocks, reorderSections, dragContainerMap, dragOrderMap])

  // ─── Drag cancel ─────────────────────────────────────────────────────

  const handleDragCancel = useCallback(() => {
    setActiveBlockId(null)
    setActiveSectionId(null)
    setDragContainerMap(null)
    setDragOrderMap(null)
  }, [])

  // ─── Sectioned blocks computation ────────────────────────────────────
  // Groups blocks by section — uses drag state when actively dragging for
  // visual shifting.

  const sectionedBlocks = useMemo(() => {
    const map: Record<string, EventScheduleBlock[]> = {}
    const unsectioned: EventScheduleBlock[] = []

    if (dragContainerMap && dragOrderMap) {
      // During drag: use local container assignments and order
      const blockMap = new Map(dayBlocks.map((b) => [b.id, b]))

      for (const [containerId, blockIds] of Object.entries(dragOrderMap)) {
        const orderedBlocks = blockIds
          .map((id) => blockMap.get(id))
          .filter(Boolean) as EventScheduleBlock[]

        if (containerId === UNSECTIONED) {
          unsectioned.push(...orderedBlocks)
        } else {
          map[containerId] = orderedBlocks
        }
      }
    } else {
      // Not dragging: use server data
      for (const block of dayBlocks) {
        if (block.sectionId) {
          if (!map[block.sectionId]) map[block.sectionId] = []
          map[block.sectionId].push(block)
        } else {
          unsectioned.push(block)
        }
      }
    }

    return { map, unsectioned }
  }, [dayBlocks, dragContainerMap, dragOrderMap])

  return {
    activeBlockId,
    activeSectionId,
    sensors,
    customCollision,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    dragContainerMap,
    dragOrderMap,
    sectionedBlocks,
  }
}
