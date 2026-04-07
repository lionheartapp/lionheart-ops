'use client'

import { parseISO } from 'date-fns'
import type { EventScheduleBlock } from '@/lib/hooks/useEventProject'
import type { BlockTypeConfig } from '@/lib/types/event-project'
import { type ComputedBlockTime, formatDateTo12, formatDuration } from '@/lib/schedule-utils'
import { SortableBlockRow } from './SortableBlockRow'

// ─── Props ───────────────────────────────────────────────────────────────────

interface SectionBlockListProps {
  blocks: EventScheduleBlock[]
  allTypes: BlockTypeConfig[]
  computedTimes?: Map<string, ComputedBlockTime>
  onEditBlock: (block: EventScheduleBlock) => void
  onDelete: (blockId: string) => void
  deletingId: string | null
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SectionBlockList({ blocks, allTypes, computedTimes, onEditBlock, onDelete, deletingId }: SectionBlockListProps) {
  return (
    <div className="space-y-1.5">
      {blocks.map((block) => {
        const startsAt = parseISO(block.startsAt)
        const endsAt = parseISO(block.endsAt)
        const durationMins = Math.max(Math.round((endsAt.getTime() - startsAt.getTime()) / 60000), 1)

        // Use computed times if available, otherwise show duration only
        const computed = computedTimes?.get(block.id)
        const timeRange = computed
          ? `${formatDateTo12(computed.computedStart)} – ${formatDateTo12(computed.computedEnd)}`
          : `${formatDuration(durationMins)}`

        return (
          <SortableBlockRow
            key={block.id}
            block={block}
            allTypes={allTypes}
            durationMins={durationMins}
            timeRange={timeRange}
            onEdit={onEditBlock}
            onDelete={onDelete}
            isDeleting={deletingId === block.id}
          />
        )
      })}
    </div>
  )
}
