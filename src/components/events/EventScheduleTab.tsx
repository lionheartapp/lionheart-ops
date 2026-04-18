'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO, addMinutes, addDays } from 'date-fns'
import {
  DndContext,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  GripVertical,
  FolderOpen,
  FileDown,
  Sparkles,
} from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import { fadeInUp } from '@/lib/animations'
import {
  useScheduleBlocks,
  useCreateScheduleBlock,
  useUpdateScheduleBlock,
  useDeleteScheduleBlock,
  useReorderScheduleBlocks,
  useScheduleSections,
  useCreateScheduleSection,
  useUpdateScheduleSection,
  useDeleteScheduleSection,
  useAssignBlockToSection,
  useReorderSections,
} from '@/lib/hooks/useEventSchedule'
import { type EventScheduleBlock, useEventProject } from '@/lib/hooks/useEventProject'
import { useToast } from '@/components/Toast'
import { ParallelBlockGrid } from '@/components/events/ParallelBlockGrid'
import { ScheduleTimelineView } from '@/components/events/ScheduleTimelineView'
import { ExportScheduleDrawer } from '@/components/events/ExportScheduleDrawer'
import { PCOServiceLinkModal } from '@/components/events/PCOServiceLinkModal'
import { usePCOAutoSync, type SectionSyncStatus } from '@/lib/hooks/usePCOServices'
import type { CreateScheduleBlockInput, UpdateScheduleBlockInput, BlockTypeConfig } from '@/lib/types/event-project'

// ─── Extracted sub-components and utilities ──────────────────────────────────

import {
  VALID_API_TYPES,
  type ApiBlockType,
  loadCustomTypes,
  saveCustomTypes,
  getAllBlockTypes,
  toApiType,
  type ComputedBlockTime,
  parseHHMM,
  formatTime12,
  formatDateTo12,
  computeBlockTimes,
  computeSmartDefaultStartTime,
} from '@/lib/schedule-utils'

import { AddBlockDrawer, type DrawerFormData } from '@/components/events/schedule/AddBlockDrawer'
import { AddScheduleDropdown } from '@/components/events/schedule/AddScheduleDropdown'
import { SectionHeader } from '@/components/events/schedule/SectionHeader'
import { BlockRowOverlay, DroppableSection, SortableSectionCard } from '@/components/events/schedule/SortableBlockRow'
import { SectionBlockList } from '@/components/events/schedule/SectionBlockList'
import { useScheduleDragDrop } from '@/lib/hooks/useScheduleDragDrop'

// ─── Skeleton ────────────────────────────────────────────────────────────────

function ScheduleSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-5 w-24 bg-slate-200 rounded" />
        <div className="h-9 w-28 bg-slate-200 rounded-full" />
      </div>
      {[...Array(2)].map((_, s) => (
        <div key={s} className="space-y-2">
          <div className="h-4 w-32 bg-slate-100 rounded" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl h-16" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function ScheduleEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-4">
        <CalendarDays className="w-7 h-7 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-2">No schedule items yet</h3>
      <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
        Build your event schedule by adding items for sessions, activities, meals, and more.
      </p>
      <button
        onClick={onAdd}
        className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer"
      >
        Add First Block
      </button>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface EventScheduleTabProps {
  eventProjectId: string
  defaultDate?: string
  eventStartDate?: string
  eventEndDate?: string
}

export function EventScheduleTab({ eventProjectId, defaultDate, eventStartDate, eventEndDate }: EventScheduleTabProps) {
  const [viewMode, setViewMode] = useState<'order' | 'timeline'>('order')
  const [exportDrawerOpen, setExportDrawerOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<EventScheduleBlock | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [addToSectionId, setAddToSectionId] = useState<string | null>(null)
  const [pcoLinkSectionId, setPcoLinkSectionId] = useState<string | null>(null)
  const [confirmDeleteBlock, setConfirmDeleteBlock] = useState<{ id: string; title: string } | null>(null)
  const [confirmDeleteSection, setConfirmDeleteSection] = useState<{ id: string; title: string; blockCount: number } | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const candidate = defaultDate
      ? new Date(defaultDate + 'T00:00:00')
      : new Date(format(new Date(), 'yyyy-MM-dd') + 'T00:00:00')
    // Clamp to event date range
    if (eventStartDate && eventEndDate) {
      const start = new Date(eventStartDate + 'T00:00:00')
      const end = new Date(eventEndDate + 'T00:00:00')
      if (candidate < start) return start
      if (candidate > end) return end
    }
    return candidate
  })

  // Derive the date string for section queries (must be before hooks)
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd')

  const { data: blocks, isLoading: blocksLoading } = useScheduleBlocks(eventProjectId)
  const { data: sections, isLoading: sectionsLoading } = useScheduleSections(eventProjectId, selectedDateStr)
  const createBlock = useCreateScheduleBlock(eventProjectId)
  const updateBlock = useUpdateScheduleBlock(eventProjectId)
  const deleteBlock = useDeleteScheduleBlock(eventProjectId)
  const reorderBlocks = useReorderScheduleBlocks(eventProjectId)
  const createSection = useCreateScheduleSection(eventProjectId, selectedDateStr)
  const updateSection = useUpdateScheduleSection(eventProjectId, selectedDateStr)
  const deleteSection = useDeleteScheduleSection(eventProjectId, selectedDateStr)
  const assignBlock = useAssignBlockToSection(eventProjectId)
  const reorderSections = useReorderSections(eventProjectId, selectedDateStr)
  const { toast } = useToast()

  // Auto-sync PCO-linked sections on mount (update-only — detects new items but doesn't import them)
  const pcoAutoSync = usePCOAutoSync(eventProjectId)
  const pcoAutoSyncFired = useRef(false)
  const [pcoSectionStatuses, setPcoSectionStatuses] = useState<Record<string, SectionSyncStatus>>({})
  useEffect(() => {
    if (eventProjectId && !pcoAutoSyncFired.current) {
      pcoAutoSyncFired.current = true
      pcoAutoSync.mutate(undefined, {
        onSuccess: (data) => {
          if (data.sections && data.sections.length > 0) {
            const statusMap: Record<string, SectionSyncStatus> = {}
            for (const s of data.sections) {
              if (s.newItemCount > 0) statusMap[s.sectionId] = s
            }
            setPcoSectionStatuses(statusMap)
          }
        },
      })
    }
  }, [eventProjectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const [customTypes, setCustomTypes] = useState<BlockTypeConfig[]>(() => loadCustomTypes(eventProjectId))

  // Build array of valid event dates for bounded navigation
  const eventDates = useMemo(() => {
    if (!eventStartDate || !eventEndDate) return null
    const start = new Date(eventStartDate + 'T00:00:00')
    const end = new Date(eventEndDate + 'T00:00:00')
    const dates: Date[] = []
    let cursor = start
    while (cursor <= end) {
      dates.push(cursor)
      cursor = addDays(cursor, 1)
    }
    return dates
  }, [eventStartDate, eventEndDate])

  const currentDateIndex = useMemo(() => {
    if (!eventDates) return -1
    const key = format(selectedDate, 'yyyy-MM-dd')
    return eventDates.findIndex((d) => format(d, 'yyyy-MM-dd') === key)
  }, [eventDates, selectedDate])

  const canGoPrev = eventDates ? currentDateIndex > 0 : false
  const canGoNext = eventDates ? currentDateIndex >= 0 && currentDateIndex < eventDates.length - 1 : false

  const allTypes = useMemo(() => getAllBlockTypes(eventProjectId, customTypes), [eventProjectId, customTypes])

  function handleAddCustomType(type: BlockTypeConfig) {
    const updated = [...customTypes, type]
    setCustomTypes(updated)
    saveCustomTypes(eventProjectId, updated)
  }

  // ─── AI Schedule Generation ──────────────────────────────────────────
  const [aiGenerating, setAIGenerating] = useState(false)
  const { data: eventProject } = useEventProject(eventProjectId)

  async function handleAIGenerate() {
    if (!eventProject || !eventStartDate) return
    setAIGenerating(true)
    try {
      const startDate = new Date(eventStartDate + 'T00:00:00')
      const endDate = eventEndDate ? new Date(eventEndDate + 'T00:00:00') : startDate
      const durationDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1)

      const res = await fetch('/api/events/ai/generate-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: eventProject.title,
          durationDays,
          expectedAttendance: eventProject.expectedAttendance ?? 50,
          description: eventProject.description ?? undefined,
        }),
      })
      const json = await res.json() as { ok: boolean; data?: { blocks: Array<{ dayOffset: number; startTime: string; endTime: string; title: string; type: string; location?: string }>; reasoning: string }; error?: { message: string } }

      if (!json.ok || !json.data) {
        toast(json.error?.message ?? 'Failed to generate schedule', 'error')
        return
      }

      const { blocks: templates } = json.data
      let created = 0
      for (const tpl of templates) {
        const blockDate = addDays(startDate, tpl.dayOffset)
        const dateStr = format(blockDate, 'yyyy-MM-dd')
        const [startH, startM] = tpl.startTime.split(':').map(Number)
        const [endH, endM] = tpl.endTime.split(':').map(Number)
        const startsAt = new Date(`${dateStr}T00:00:00`)
        startsAt.setHours(startH, startM, 0, 0)
        const endsAt = new Date(`${dateStr}T00:00:00`)
        endsAt.setHours(endH, endM, 0, 0)

        const payload: CreateScheduleBlockInput = {
          type: toApiType(tpl.type),
          title: tpl.title,
          startsAt,
          endsAt,
          locationText: tpl.location || undefined,
          sortOrder: (blocks?.length ?? 0) + created,
        }
        await createBlock.mutateAsync(payload)
        created++
      }
      toast(`Generated ${created} schedule items`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'AI generation failed', 'error')
    } finally {
      setAIGenerating(false)
    }
  }

  // ─── Block CRUD ───────────────────────────────────────────────────────

  async function handleCreate(data: DrawerFormData) {
    const dateStr = selectedDateStr

    // Compute start time based on position in section
    let startsAt: Date
    if (addToSectionId && sections) {
      const section = sections.find((s) => s.id === addToSectionId)
      const sectionBlocks = sectionedBlocks.map[addToSectionId] || []

      if (section?.layout === 'parallel') {
        // Parallel sections: all blocks share the section start time
        const { hours, minutes } = parseHHMM(section.startTime)
        startsAt = new Date(`${dateStr}T00:00:00`)
        startsAt.setHours(hours, minutes, 0, 0)
      } else if (section && sectionBlocks.length > 0) {
        // Sequential: append after last block
        const times = computeBlockTimes(section.startTime, dateStr, sectionBlocks)
        const lastBlock = sectionBlocks[sectionBlocks.length - 1]
        const lastTime = times.get(lastBlock.id)
        startsAt = lastTime ? new Date(lastTime.computedEnd) : new Date(`${dateStr}T08:00:00`)
      } else if (section) {
        // First block in section: use section startTime
        const { hours, minutes } = parseHHMM(section.startTime)
        startsAt = new Date(`${dateStr}T00:00:00`)
        startsAt.setHours(hours, minutes, 0, 0)
      } else {
        startsAt = new Date(`${dateStr}T08:00:00`)
      }
    } else {
      startsAt = new Date(`${dateStr}T08:00:00`)
    }

    // Pre items: offset backward from section start so they end when the section begins
    if (data.servicePosition === 'pre' && addToSectionId && sections) {
      const section = sections.find((s) => s.id === addToSectionId)
      if (section) {
        const { hours, minutes } = parseHHMM(section.startTime)
        const sectionStart = new Date(`${dateStr}T00:00:00`)
        sectionStart.setHours(hours, minutes, 0, 0)
        // Find existing pre items to stack before them
        const sectionBlocks = sectionedBlocks.map[addToSectionId] || []
        const existingPreItems = sectionBlocks.filter((b) => {
          const m = (b.metadata as Record<string, unknown>) || {}
          return m.servicePosition === 'pre' || m.pcoServicePosition === 'pre'
        })
        const existingPreTotal = existingPreItems.reduce((sum, b) => {
          const s = parseISO(b.startsAt)
          const e = parseISO(b.endsAt)
          return sum + Math.max(Math.round((e.getTime() - s.getTime()) / 60000), 1)
        }, 0)
        // New pre item starts before existing pre items
        startsAt = addMinutes(sectionStart, -(existingPreTotal + data.durationMinutes))
      }
    }

    const endsAt = addMinutes(startsAt, data.durationMinutes)

    const isCustomType = !VALID_API_TYPES.includes(data.type as ApiBlockType)
    const metadata: Record<string, unknown> = {}
    if (isCustomType) metadata.customType = data.type
    if (data.servicePosition && data.servicePosition !== 'during') metadata.servicePosition = data.servicePosition
    const payload: CreateScheduleBlockInput = {
      type: toApiType(data.type),
      title: data.title,
      description: data.description || undefined,
      startsAt,
      endsAt,
      locationText: data.locationText || undefined,
      sectionId: addToSectionId ?? undefined,
      sortOrder: blocks?.length ?? 0,
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    }
    try {
      await createBlock.mutateAsync(payload)
      toast('Item added', 'success')
      setDrawerOpen(false)
      setAddToSectionId(null)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to add item', 'error')
    }
  }

  async function handleUpdate(data: DrawerFormData) {
    if (!editingBlock) return

    // Use computed start time for the block's current position
    const computed = computedTimesMap.get(editingBlock.id)
    const startsAt = computed ? new Date(computed.computedStart) : parseISO(editingBlock.startsAt)
    const endsAt = addMinutes(startsAt, data.durationMinutes)

    const isCustomType = !VALID_API_TYPES.includes(data.type as ApiBlockType)
    // Merge with existing metadata (preserve PCO fields etc.)
    const existingMeta = (editingBlock.metadata as Record<string, unknown>) || {}
    const updatedMeta: Record<string, unknown> = { ...existingMeta }
    // Set or clear customType
    if (isCustomType) { updatedMeta.customType = data.type } else { delete updatedMeta.customType }
    // Set or clear servicePosition
    if (data.servicePosition && data.servicePosition !== 'during') {
      updatedMeta.servicePosition = data.servicePosition
    } else {
      delete updatedMeta.servicePosition
      delete updatedMeta.pcoServicePosition // clean up legacy key too
    }
    const updateData: UpdateScheduleBlockInput = {
      type: toApiType(data.type),
      title: data.title,
      description: data.description || undefined,
      startsAt,
      endsAt,
      locationText: data.locationText || undefined,
      metadata: Object.keys(updatedMeta).length > 0 ? updatedMeta : null,
    }
    try {
      await updateBlock.mutateAsync({ blockId: editingBlock.id, data: updateData })
      toast('Item updated', 'success')
      setEditingBlock(null)
      setDrawerOpen(false)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update item', 'error')
    }
  }

  function handleDelete(blockId: string) {
    const block = blocks?.find((b) => b.id === blockId)
    setConfirmDeleteBlock({ id: blockId, title: block?.title || 'this item' })
  }

  async function executeDeleteBlock() {
    if (!confirmDeleteBlock) return
    setDeletingId(confirmDeleteBlock.id)
    try {
      await deleteBlock.mutateAsync(confirmDeleteBlock.id)
      toast('Item removed', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove item', 'error')
    } finally {
      setDeletingId(null)
      setConfirmDeleteBlock(null)
    }
  }

  function openAddDrawer(sectionId?: string | null) {
    setEditingBlock(null)
    setAddToSectionId(sectionId ?? null)
    setDrawerOpen(true)
  }

  function openEditDrawer(block: EventScheduleBlock) {
    setEditingBlock(block)
    setDrawerOpen(true)
  }

  // ─── Section CRUD ─────────────────────────────────────────────────────

  async function handleCreateSection(title: string) {
    try {
      const smartStartTime = computeSmartDefaultStartTime(
        sections || [],
        sectionedBlocks.map,
        selectedDateStr,
      )
      await createSection.mutateAsync({ title, date: selectedDateStr, startTime: smartStartTime, layout: 'sequential', sortOrder: 0 })
      toast('Section created', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create section', 'error')
    }
  }

  async function handleRenameSection(sectionId: string, title: string) {
    try {
      await updateSection.mutateAsync({ sectionId, data: { title } })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to rename section', 'error')
    }
  }

  function handleDeleteSection(sectionId: string) {
    const section = sections?.find((s) => s.id === sectionId)
    const blockCount = sectionedBlocks.map[sectionId]?.length || 0
    setConfirmDeleteSection({ id: sectionId, title: section?.title || 'this section', blockCount })
  }

  async function executeDeleteSection() {
    if (!confirmDeleteSection) return
    try {
      await deleteSection.mutateAsync(confirmDeleteSection.id)
      toast('Section removed — blocks kept', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove section', 'error')
    } finally {
      setConfirmDeleteSection(null)
    }
  }

  async function handleSectionLayoutChange(sectionId: string, layout: 'sequential' | 'parallel') {
    try {
      await updateSection.mutateAsync({ sectionId, data: { layout } })
      toast(layout === 'parallel' ? 'Switched to breakout layout' : 'Switched to sequential layout', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to change layout', 'error')
    }
  }

  async function handleCreateBreakoutSection(title: string) {
    try {
      const smartStartTime = computeSmartDefaultStartTime(
        sections || [],
        sectionedBlocks.map,
        selectedDateStr,
      )
      await createSection.mutateAsync({ title, date: selectedDateStr, startTime: smartStartTime, layout: 'parallel', sortOrder: 0 })
      toast('Breakout section created', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to create breakout section', 'error')
    }
  }

  // Filter blocks for the selected date
  const dayBlocks = useMemo(() => {
    if (!blocks) return []
    const dateKey = format(selectedDate, 'yyyy-MM-dd')
    return blocks.filter((b) => format(parseISO(b.startsAt), 'yyyy-MM-dd') === dateKey)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [blocks, selectedDate])

  // ─── Drag-and-drop (extracted to custom hook) ─────────────────────────

  const {
    activeBlockId,
    activeSectionId,
    sensors,
    customCollision,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
    sectionedBlocks,
  } = useScheduleDragDrop({
    dayBlocks,
    sections,
    blocks,
    assignBlock,
    reorderBlocks: (blockIds: string[]) => reorderBlocks.mutate(blockIds),
    reorderSections,
  })

  // ─── Build view data ──────────────────────────────────────────────────

  const editInitial = useMemo<Partial<DrawerFormData> | undefined>(() => {
    if (!editingBlock) return undefined
    const startsAt = parseISO(editingBlock.startsAt)
    const endsAt = parseISO(editingBlock.endsAt)
    const durationMs = endsAt.getTime() - startsAt.getTime()
    const durationMinutes = Math.max(Math.round(durationMs / 60000), 1)
    const meta = (editingBlock.metadata as Record<string, unknown>) || {}
    const customType = meta.customType as string | undefined
    // Read from servicePosition first, fall back to legacy pcoServicePosition
    const position = (meta.servicePosition || meta.pcoServicePosition || 'during') as 'pre' | 'during' | 'post'
    return {
      type: customType || editingBlock.type,
      title: editingBlock.title,
      description: editingBlock.description || '',
      durationMinutes,
      locationText: editingBlock.locationText || '',
      servicePosition: position,
    }
  }, [editingBlock])

  // ─── Computed times map — recomputes on section/block/drag changes ───
  // Parallel sections are skipped — their blocks all share the section start time.
  const computedTimesMap = useMemo(() => {
    const combined = new Map<string, ComputedBlockTime>()
    if (!sections) return combined

    for (const section of sections) {
      if (section.layout === 'parallel') continue // parallel blocks don't use sequential time computation
      const sectionBlocks = sectionedBlocks.map[section.id] || []
      if (sectionBlocks.length === 0) continue
      const times = computeBlockTimes(section.startTime, selectedDateStr, sectionBlocks)
      for (const [id, time] of times) {
        combined.set(id, time)
      }
    }

    return combined
  }, [sections, sectionedBlocks, selectedDateStr])

  // ─── Section start time handler ─────────────────────────────────────
  async function handleSectionStartTimeChange(sectionId: string, newStartTime: string) {
    try {
      await updateSection.mutateAsync({ sectionId, data: { startTime: newStartTime } })

      // Re-sort all sections by startTime after a time change
      if (sections && sections.length > 1) {
        const updated = sections.map((s) =>
          s.id === sectionId ? { ...s, startTime: newStartTime } : s,
        )
        const sorted = [...updated].sort((a, b) => {
          const { hours: ha, minutes: ma } = parseHHMM(a.startTime)
          const { hours: hb, minutes: mb } = parseHHMM(b.startTime)
          return ha * 60 + ma - (hb * 60 + mb)
        })
        const alreadyInOrder = sorted.every((s, i) => s.id === sections[i]?.id)
        if (!alreadyInOrder) {
          reorderSections.mutate(sorted.map((s) => s.id))
        }
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update start time', 'error')
    }
  }

  const sectionSortableIds = (sections || []).map((s) => `sortable-section-${s.id}`)
  const activeBlock = activeBlockId ? dayBlocks.find((b) => b.id === activeBlockId) : null
  const activeSectionData = activeSectionId
    ? (sections || []).find((s) => s.id === activeSectionId)
    : null

  const isLoading = blocksLoading || sectionsLoading

  if (isLoading) return <ScheduleSkeleton />

  const hasSections = sections && sections.length > 0
  const hasBlocks = dayBlocks.length > 0

  return (
    <div className="space-y-5">
      {/* Day navigator + View mode toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Day navigator — bounded to event dates */}
        <div className="flex items-center justify-center border border-slate-300 rounded-xl p-1">
          <button
            onClick={() => canGoPrev && eventDates && setSelectedDate(eventDates[currentDateIndex - 1])}
            disabled={!canGoPrev}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
              canGoPrev
                ? 'text-slate-500 hover:bg-slate-200 hover:text-slate-900 cursor-pointer active:scale-95'
                : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-5 py-1 min-w-[200px] text-center">
            <h4 className="text-sm font-semibold text-slate-900">
              {format(selectedDate, 'EEEE, MMMM d')}
            </h4>
            {eventDates && eventDates.length > 1 && currentDateIndex >= 0 && (
              <p className="text-[11px] text-slate-400 mt-0.5">
                Day {currentDateIndex + 1} of {eventDates.length}
              </p>
            )}
          </div>
          <button
            onClick={() => canGoNext && eventDates && setSelectedDate(eventDates[currentDateIndex + 1])}
            disabled={!canGoNext}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
              canGoNext
                ? 'text-slate-500 hover:bg-slate-200 hover:text-slate-900 cursor-pointer active:scale-95'
                : 'text-slate-300 cursor-not-allowed'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Order / Timeline pill toggle + Add Block */}
        <div className="flex items-center justify-center sm:justify-end gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center bg-slate-100 border border-slate-300 rounded-full p-1">
            <button
              onClick={() => setViewMode('order')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                viewMode === 'order'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Order
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                viewMode === 'timeline'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Timeline
            </button>
          </div>

          {/* AI Generate */}
          {!hasBlocks && !hasSections && (
            <button
              onClick={handleAIGenerate}
              disabled={aiGenerating}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-indigo-200 bg-indigo-50 text-sm font-medium text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 disabled:opacity-50 transition-all cursor-pointer"
              title="Generate schedule with AI"
            >
              {aiGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{aiGenerating ? 'Generating...' : 'AI Generate'}</span>
            </button>
          )}

          {/* Export */}
          {hasBlocks && (
            <button
              onClick={() => setExportDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
              title="Export schedule"
            >
              <FileDown className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}

          <AddScheduleDropdown
            onAddBlock={() => openAddDrawer()}
            onAddSection={handleCreateSection}
            onAddBreakout={handleCreateBreakoutSection}
          />
        </div>
      </div>

      {/* Schedule content */}
      {!hasBlocks && !hasSections ? (
        <ScheduleEmptyState onAdd={() => openAddDrawer()} />
      ) : viewMode === 'timeline' ? (
        <ScheduleTimelineView
          blocks={dayBlocks}
          sections={sections || []}
          allTypes={allTypes}
          selectedDateStr={selectedDateStr}
          onEditBlock={openEditDrawer}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={customCollision}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {/* Section-level sortable context (for reordering sections) */}
          <SortableContext items={sectionSortableIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {/* Render sections (sortable) */}
              {(sections || []).map((section) => {
                const sectionBlocks = sectionedBlocks.map[section.id] || []
                const sectionBlockIds = sectionBlocks.map((b) => b.id)
                const isParallel = section.layout === 'parallel'

                const totalMins = sectionBlocks.reduce((sum, b) => {
                  const s = parseISO(b.startsAt)
                  const e = parseISO(b.endsAt)
                  return sum + Math.max(Math.round((e.getTime() - s.getTime()) / 60000), 1)
                }, 0)

                // Compute time span for section header
                let timeSpan: string
                if (isParallel && sectionBlocks.length > 0) {
                  // Parallel: show section start -> end of longest block
                  const maxDuration = sectionBlocks.reduce((max, b) => {
                    const s = parseISO(b.startsAt)
                    const e = parseISO(b.endsAt)
                    return Math.max(max, Math.round((e.getTime() - s.getTime()) / 60000))
                  }, 0)
                  const { hours, minutes } = parseHHMM(section.startTime)
                  const start = new Date(`${selectedDateStr}T00:00:00`)
                  start.setHours(hours, minutes, 0, 0)
                  const end = addMinutes(start, maxDuration)
                  timeSpan = `${formatDateTo12(start)} – ${formatDateTo12(end)}`
                } else if (!isParallel && sectionBlocks.length > 0) {
                  const sectionTimes = computeBlockTimes(section.startTime, selectedDateStr, sectionBlocks)
                  const lastBlockTime = sectionTimes.get(sectionBlocks[sectionBlocks.length - 1].id)
                  // Always use the section's configured startTime for the header (not pre-item times)
                  timeSpan = lastBlockTime
                    ? `${formatTime12(section.startTime)} – ${formatDateTo12(lastBlockTime.computedEnd)}`
                    : formatTime12(section.startTime)
                } else {
                  timeSpan = formatTime12(section.startTime)
                }

                // For parallel sections, show max duration instead of total sum
                const displayDuration = isParallel && sectionBlocks.length > 0
                  ? Math.max(...sectionBlocks.map((b) => {
                      const s = parseISO(b.startsAt)
                      const e = parseISO(b.endsAt)
                      return Math.round((e.getTime() - s.getTime()) / 60000)
                    }))
                  : totalMins

                return (
                  <SortableSectionCard key={section.id} section={section}>
                    {(listeners: Record<string, unknown>) => (
                      <div className="rounded-xl p-3 border bg-slate-50/50 border-slate-100">
                        <SectionHeader
                          section={section}
                          blockCount={sectionBlocks.length}
                          totalDuration={displayDuration}
                          timeSpan={timeSpan}
                          onRename={(title) => handleRenameSection(section.id, title)}
                          onStartTimeChange={(time) => handleSectionStartTimeChange(section.id, time)}
                          onLayoutChange={(layout) => handleSectionLayoutChange(section.id, layout)}
                          onDelete={() => handleDeleteSection(section.id)}
                          onAddBlock={() => openAddDrawer(section.id)}
                          onLinkPCO={() => setPcoLinkSectionId(section.id)}
                          dragListeners={listeners}
                        />
                        {/* PCO new items notification */}
                        {pcoSectionStatuses[section.id] && (
                          <button
                            onClick={() => setPcoLinkSectionId(section.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 mb-1 rounded-lg bg-indigo-50 border border-indigo-200 text-left transition-colors hover:bg-indigo-100 cursor-pointer"
                          >
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse flex-shrink-0" />
                            <span className="text-xs font-medium text-indigo-700 flex-1">
                              {pcoSectionStatuses[section.id].newItemCount} new item{pcoSectionStatuses[section.id].newItemCount !== 1 ? 's' : ''} in Planning Center
                              {pcoSectionStatuses[section.id].newItemTitles.length > 0 && (
                                <span className="font-normal text-indigo-500">
                                  {' — '}{pcoSectionStatuses[section.id].newItemTitles.slice(0, 3).join(', ')}
                                  {pcoSectionStatuses[section.id].newItemTitles.length > 3 && ` +${pcoSectionStatuses[section.id].newItemTitles.length - 3} more`}
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-indigo-500 flex-shrink-0">Review →</span>
                          </button>
                        )}
                        <DroppableSection sectionId={section.id}>
                          {/* Per-section SortableContext — strategy depends on layout */}
                          <SortableContext items={sectionBlockIds} strategy={isParallel ? rectSortingStrategy : verticalListSortingStrategy}>
                            {sectionBlocks.length > 0 ? (
                              isParallel ? (
                                <ParallelBlockGrid
                                  blocks={sectionBlocks}
                                  allTypes={allTypes}
                                  sectionStartTime={section.startTime}
                                  onEditBlock={openEditDrawer}
                                  onDelete={handleDelete}
                                  deletingId={deletingId}
                                />
                              ) : (
                                <SectionBlockList
                                  blocks={sectionBlocks}
                                  allTypes={allTypes}
                                  computedTimes={computedTimesMap}
                                  onEditBlock={openEditDrawer}
                                  onDelete={handleDelete}
                                  deletingId={deletingId}
                                />
                              )
                            ) : (
                              <div className="py-6 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                                Drag blocks here or click + to add
                              </div>
                            )}
                          </SortableContext>
                        </DroppableSection>
                      </div>
                    )}
                  </SortableSectionCard>
                )
              })}

              {/* Unsectioned blocks */}
              {(sectionedBlocks.unsectioned.length > 0 || (hasSections && activeBlockId)) && (
                <div>
                  {hasSections && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Unsectioned</span>
                      <span className="text-xs text-slate-400">{sectionedBlocks.unsectioned.length} block{sectionedBlocks.unsectioned.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                  <DroppableSection sectionId="unsectioned">
                    <SortableContext items={sectionedBlocks.unsectioned.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                      {sectionedBlocks.unsectioned.length > 0 ? (
                        <SectionBlockList
                          blocks={sectionedBlocks.unsectioned}
                          allTypes={allTypes}
                          onEditBlock={openEditDrawer}
                          onDelete={handleDelete}
                          deletingId={deletingId}
                        />
                      ) : (
                        <div className="py-4 text-center text-xs text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                          Drop here to remove from section
                        </div>
                      )}
                    </SortableContext>
                  </DroppableSection>
                </div>
              )}
            </div>
          </SortableContext>

          {/* Drag overlay */}
          <DragOverlay dropAnimation={null}>
            {activeBlock ? <BlockRowOverlay block={activeBlock} allTypes={allTypes} /> : null}
            {activeSectionData ? (
              <div className="bg-slate-100 rounded-xl p-3 border border-slate-200 shadow-lg opacity-90">
                <div className="flex items-center gap-2.5">
                  <GripVertical className="w-4 h-4 text-slate-400" />
                  <FolderOpen className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-900">{activeSectionData.title}</span>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Add / Edit Block Drawer */}
      <AddBlockDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setEditingBlock(null)
          setAddToSectionId(null)
        }}
        onSubmit={editingBlock ? handleUpdate : handleCreate}
        isSubmitting={editingBlock ? updateBlock.isPending : createBlock.isPending}
        allTypes={allTypes}
        onAddCustomType={handleAddCustomType}
        initialData={editInitial}
        submitLabel={editingBlock ? 'Save Changes' : 'Save Item'}
        eventProjectId={eventProjectId}
        blockId={editingBlock?.id ?? null}
      />

      {/* Export Schedule Drawer */}
      <ExportScheduleDrawer
        isOpen={exportDrawerOpen}
        onClose={() => setExportDrawerOpen(false)}
        eventProjectId={eventProjectId}
        allBlocks={blocks || []}
        allTypes={allTypes}
        eventDates={eventDates}
        selectedDateStr={selectedDateStr}
      />

      {/* Planning Center Link Modal */}
      {pcoLinkSectionId && (
        <PCOServiceLinkModal
          eventProjectId={eventProjectId}
          sectionId={pcoLinkSectionId}
          sectionTitle={sections?.find((s) => s.id === pcoLinkSectionId)?.title || 'Section'}
          onClose={() => {
            // Dismiss the PCO notification for this section
            setPcoSectionStatuses((prev) => {
              const next = { ...prev }
              delete next[pcoLinkSectionId]
              return next
            })
            setPcoLinkSectionId(null)
          }}
        />
      )}

      {/* Delete Block Confirmation */}
      <ConfirmDialog
        isOpen={!!confirmDeleteBlock}
        onClose={() => setConfirmDeleteBlock(null)}
        onConfirm={executeDeleteBlock}
        title="Delete Item"
        message={`Are you sure you want to delete "${confirmDeleteBlock?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={!!deletingId}
        loadingText="Deleting..."
      />

      {/* Delete Section Confirmation */}
      <ConfirmDialog
        isOpen={!!confirmDeleteSection}
        onClose={() => setConfirmDeleteSection(null)}
        onConfirm={executeDeleteSection}
        title="Delete Section"
        message={`Are you sure you want to delete "${confirmDeleteSection?.title}"?${confirmDeleteSection?.blockCount ? ` The ${confirmDeleteSection.blockCount} item${confirmDeleteSection.blockCount !== 1 ? 's' : ''} inside will be kept as unsectioned.` : ''}`}
        confirmText="Delete Section"
        variant="danger"
        isLoading={deleteSection.isPending}
        loadingText="Deleting..."
      />
    </div>
  )
}
