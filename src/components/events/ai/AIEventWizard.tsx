'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutPanelLeft, MessageSquare } from 'lucide-react'
import { AIEventChat } from './AIEventChat'
import { AIEventPreview } from './AIEventPreview'
import { useToast } from '@/components/Toast'
import type { AIEventSuggestion } from '@/lib/types/event-ai'

// ─── Types ────────────────────────────────────────────────────────────────────

// Valid schedule block types accepted by the API
type ValidBlockType = 'SESSION' | 'ACTIVITY' | 'MEAL' | 'FREE_TIME' | 'TRAVEL' | 'SETUP'

// Mapping from AI block types to valid API types
const BLOCK_TYPE_MAP: Record<string, ValidBlockType> = {
  SESSION: 'SESSION',
  ACTIVITY: 'ACTIVITY',
  MEAL: 'MEAL',
  FREE_TIME: 'FREE_TIME',
  TRAVEL: 'TRAVEL',
  SETUP: 'SETUP',
  BREAK: 'FREE_TIME',
  CEREMONY: 'SESSION',
  WORKSHOP: 'SESSION',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a date-only string (YYYY-MM-DD) to ISO datetime at midnight UTC */
function dateToISO(dateStr: string): string {
  // Already an ISO datetime? Pass through
  if (dateStr.includes('T')) return dateStr
  return `${dateStr}T00:00:00.000Z`
}

/**
 * Given a dayOffset, startTime (HH:MM), and the event start date,
 * compute the absolute ISO datetime for a schedule block.
 */
function resolveBlockDatetime(eventStartDate: string, dayOffset: number, time: string): string {
  const base = new Date(dateToISO(eventStartDate))
  base.setUTCDate(base.getUTCDate() + dayOffset)
  const [hours, minutes] = time.split(':').map(Number)
  base.setUTCHours(hours ?? 0, minutes ?? 0, 0, 0)
  return base.toISOString()
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AIEventWizard() {
  const router = useRouter()
  const { toast } = useToast()

  const [suggestion, setSuggestion] = useState<AIEventSuggestion | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Mobile: toggle between chat and preview panels
  const [mobilePanel, setMobilePanel] = useState<'chat' | 'preview'>('chat')

  // ─── AI callbacks ────────────────────────────────────────────────────────────

  const handleSuggestionGenerated = useCallback((newSuggestion: AIEventSuggestion) => {
    setSuggestion(newSuggestion)
    // On mobile, switch to preview when first suggestion arrives
    if (newSuggestion) {
      setMobilePanel('preview')
    }
  }, [])

  const handleRefinement = useCallback(
    (_field: string, _instruction: string) => {
      // Refinement is handled via handleSuggestionGenerated with the full updated suggestion
      // This callback is here for future use (field-level refinement)
    },
    [],
  )

  const handleEdit = useCallback((_field: string, _value: unknown) => {
    // Field edits are tracked in AIEventPreview's local state
    // No additional action needed at this level
  }, [])

  // ─── Create event from AI data ───────────────────────────────────────────────

  const handleConfirm = useCallback(
    async (data: AIEventSuggestion) => {
      setIsCreating(true)
      try {
        // 1. Create the EventProject
        const projectRes = await fetch('/api/events/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: data.title,
            description: data.description,
            startsAt: dateToISO(data.startsAt),
            endsAt: dateToISO(data.endsAt),
            isMultiDay: data.isMultiDay,
            expectedAttendance: data.expectedAttendance,
            locationText: data.locationText || undefined,
          }),
        })

        if (!projectRes.ok) {
          const err = await projectRes.json().catch(() => null)
          throw new Error(err?.error?.message ?? 'Failed to create event project')
        }

        const projectJson = await projectRes.json()
        const newProjectId: string = projectJson.data?.id

        if (!newProjectId) {
          throw new Error('No project ID returned from API')
        }

        // 2. Create schedule blocks (if any)
        if (data.scheduleBlocks && data.scheduleBlocks.length > 0) {
          await Promise.allSettled(
            data.scheduleBlocks.map((block, i) => {
              const blockType: ValidBlockType =
                BLOCK_TYPE_MAP[block.type?.toUpperCase() ?? ''] ?? 'SESSION'
              const startsAt = resolveBlockDatetime(data.startsAt, block.dayOffset, block.startTime)
              const endsAt = resolveBlockDatetime(data.startsAt, block.dayOffset, block.endTime)

              return fetch(`/api/events/projects/${newProjectId}/schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: blockType,
                  title: block.title,
                  startsAt,
                  endsAt,
                  sortOrder: i,
                  ...(block.location ? { location: block.location } : {}),
                }),
              })
            }),
          )
        }

        // 3. Create tasks (if any)
        if (data.suggestedTasks && data.suggestedTasks.length > 0) {
          await Promise.allSettled(
            data.suggestedTasks.map((task) =>
              fetch(`/api/events/projects/${newProjectId}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: task.title,
                  category: task.category ?? undefined,
                  priority: (['LOW', 'NORMAL', 'HIGH', 'CRITICAL'].includes(task.priority ?? ''))
                    ? task.priority
                    : 'NORMAL',
                }),
              }),
            ),
          )
        }

        // 4. Initialize budget (triggers preset category creation idempotently)
        // We trigger via GET — the budget tab will surface the actual data
        await fetch(`/api/events/projects/${newProjectId}/budget`).catch(() => {
          // Non-fatal: budget initialization is idempotent, can be done later
        })

        toast('Event created successfully', 'success')

        // 5. Navigate to the new event
        router.push(`/events/${newProjectId}?tab=overview`)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong'
        toast(`Failed to create event: ${message}`, 'error')
      } finally {
        setIsCreating(false)
      }
    },
    [router, toast],
  )

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200/50">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Create with Leo</h1>
          <p className="text-sm text-slate-500 mt-1">
            Describe your event and Leo will fill in the details.
          </p>
        </div>

        {/* Mobile toggle — visible only below lg */}
        <div className="flex items-center gap-1 lg:hidden">
          <button
            onClick={() => setMobilePanel('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              mobilePanel === 'chat'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat
          </button>
          <button
            onClick={() => setMobilePanel('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              mobilePanel === 'preview'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <LayoutPanelLeft className="w-3.5 h-3.5" />
            Preview
          </button>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Chat panel — 40% on desktop, full width on mobile when active */}
        <div
          className={`flex-shrink-0 border-r border-slate-200/50 overflow-hidden flex flex-col ${
            mobilePanel === 'chat' ? 'w-full' : 'hidden'
          } lg:flex lg:w-2/5`}
        >
          <AIEventChat
            onSuggestionGenerated={handleSuggestionGenerated}
            onRefinement={handleRefinement}
            isGenerating={isGenerating}
          />
        </div>

        {/* Preview panel — 60% on desktop, full width on mobile when active */}
        <div
          className={`flex-1 overflow-hidden flex flex-col ${
            mobilePanel === 'preview' ? 'w-full' : 'hidden'
          } lg:flex`}
        >
          <AIEventPreview
            suggestion={suggestion}
            onEdit={handleEdit}
            onConfirm={handleConfirm}
            isCreating={isCreating}
          />
        </div>
      </div>
    </div>
  )
}
