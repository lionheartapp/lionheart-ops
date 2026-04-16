'use client'

/**
 * EventBoard — the kanban board for the Events Hub.
 *
 * Four columns:
 *   DRAFT → PENDING_APPROVAL → CONFIRMED → IN_PROGRESS
 *
 * Drag-and-drop rules (enforced in `canTransition` below + server-side
 * in `transitionEventProject`):
 *
 *   Safe (direct):
 *     DRAFT ⇄ PENDING_APPROVAL          (submit / withdraw)
 *     CONFIRMED ⇄ IN_PROGRESS           (mark started / revert)
 *
 *   Guarded (opens Review Approval drawer, does NOT commit directly):
 *     PENDING_APPROVAL → CONFIRMED      (approval)
 *
 *   Blocked:
 *     DRAFT → CONFIRMED                 (no skipping approval)
 *     Anything involving COMPLETED / CANCELLED (archive is read-only)
 *
 * Completed / Cancelled events live in the Archive drawer, not on the board.
 */

import { useState, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { Plus, Users, User } from 'lucide-react'
import { EventBoardColumn } from './EventBoardColumn'
import { EventBoardCard } from './EventBoardCard'
import { ApprovalReviewDrawer } from '@/components/events/ApprovalReviewDrawer'
import CreateEventMenu, { type EventCreateMode } from '@/components/events/CreateEventMenu'
import {
  useTransitionEventProject,
  useApproveEventProject,
  type EventTransitionStatus,
  type EventProject,
} from '@/lib/hooks/useEventProject'
import { useToast } from '@/components/Toast'
import {
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  WARM_CHIP,
} from '@/lib/design/warm-tokens'

// ─── Board config ──────────────────────────────────────────────────────────

const BOARD_COLUMNS: {
  status: EventTransitionStatus
  title: string
  aiRanked?: boolean
}[] = [
  { status: 'DRAFT', title: 'Draft' },
  { status: 'PENDING_APPROVAL', title: 'Pending Approval', aiRanked: true },
  { status: 'CONFIRMED', title: 'Confirmed' },
  { status: 'IN_PROGRESS', title: 'In Progress' },
]

// Transition classification — mirror of the server allowlist plus the
// guarded approval transition.
type TransitionKind = 'safe' | 'guarded-approval' | 'blocked'

function classifyTransition(
  from: EventTransitionStatus,
  to: EventTransitionStatus,
): TransitionKind {
  if (from === to) return 'blocked'

  // Approval requires the Review Approval drawer — never a direct drop.
  if (from === 'PENDING_APPROVAL' && to === 'CONFIRMED') return 'guarded-approval'

  const key = `${from}->${to}`
  const safeTransitions = new Set([
    'DRAFT->PENDING_APPROVAL',
    'PENDING_APPROVAL->DRAFT',
    'CONFIRMED->IN_PROGRESS',
    'IN_PROGRESS->CONFIRMED',
  ])
  if (safeTransitions.has(key)) return 'safe'

  return 'blocked'
}

// ─── Component ─────────────────────────────────────────────────────────────

type BoardScope = 'all' | 'mine'

interface EventBoardProps {
  projects: EventProject[]
  /**
   * Called when a user selects any create mode from the Draft column's
   * "+" menu. Mirrors `handleOpenCreate` on the Events Hub page so all
   * create surfaces dispatch through the same switch.
   */
  onCreateDraftSelect: (mode: EventCreateMode) => void
  /** Required to decide which menu options to show (admin-only modes). */
  isAdmin: boolean
  currentUserId?: string | null
}

export function EventBoard({ projects, onCreateDraftSelect, isAdmin, currentUserId }: EventBoardProps) {
  const { toast } = useToast()
  const transitionMutation = useTransitionEventProject()

  // Scope toggle — All shows everything, Mine shows only the user's events
  const [scope, setScope] = useState<BoardScope>('all')
  const scopedProjects = useMemo(() => {
    if (scope === 'mine' && currentUserId) {
      return projects.filter((p) => p.createdById === currentUserId)
    }
    return projects
  }, [projects, scope, currentUserId])

  // Drag state
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeProject = useMemo(
    () => (activeId ? projects.find((p) => p.id === activeId) : null),
    [activeId, projects],
  )

  // Approval drawer state — opens when the user drags a Pending card into
  // the Confirmed column, to force a real review.
  const [approvalDrawerProject, setApprovalDrawerProject] = useState<EventProject | null>(null)
  const approveMutation = useApproveEventProject(approvalDrawerProject?.id ?? null)

  // Group projects by column. Archive statuses (COMPLETED / CANCELLED) are
  // intentionally excluded — they live in the ArchiveDrawer.
  const byColumn = useMemo(() => {
    const groups: Record<EventTransitionStatus, EventProject[]> = {
      DRAFT: [],
      PENDING_APPROVAL: [],
      CONFIRMED: [],
      IN_PROGRESS: [],
      COMPLETED: [],
      CANCELLED: [],
    }
    for (const p of scopedProjects) {
      const status = p.status as EventTransitionStatus
      if (status in groups) {
        groups[status].push(p)
      }
    }

    // Sort each column: Pending Approval by urgency (oldest first — longest
    // waiting gets priority), others by event date ascending.
    groups.PENDING_APPROVAL.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    for (const key of ['DRAFT', 'CONFIRMED', 'IN_PROGRESS'] as const) {
      groups[key].sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      )
    }
    return groups
  }, [scopedProjects])

  // Determine which columns are valid drop targets for the currently-dragged
  // card. This drives the dimming on invalid columns.
  const validDropTargets = useMemo(() => {
    if (!activeProject) return new Set<EventTransitionStatus>()
    const fromStatus = activeProject.status as EventTransitionStatus
    const valid = new Set<EventTransitionStatus>()
    for (const col of BOARD_COLUMNS) {
      const kind = classifyTransition(fromStatus, col.status)
      // Both safe and guarded-approval show as valid drop targets — the
      // guarded one just opens a drawer instead of committing directly.
      if (kind !== 'blocked') valid.add(col.status)
    }
    return valid
  }, [activeProject])

  // Sensors — PointerSensor with activation distance prevents accidental
  // drags when the user is just clicking the card.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  // ── Drag handlers ────────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return
    const overData = over.data.current as { type?: string; status?: EventTransitionStatus } | undefined
    if (!overData || overData.type !== 'column' || !overData.status) return

    const project = projects.find((p) => p.id === active.id)
    if (!project) return

    const fromStatus = project.status as EventTransitionStatus
    const toStatus = overData.status
    const kind = classifyTransition(fromStatus, toStatus)

    if (kind === 'blocked') {
      toast(`Cannot move from ${labelFor(fromStatus)} to ${labelFor(toStatus)}`, 'error')
      return
    }

    if (kind === 'guarded-approval') {
      // Open the Review Approval drawer instead of committing — the user
      // must read full context before clicking Approve.
      setApprovalDrawerProject(project)
      return
    }

    // Safe transition — commit immediately via the optimistic mutation.
    transitionMutation.mutate(
      { id: project.id, toStatus },
      {
        onSuccess: () => {
          toast(`Moved to ${labelFor(toStatus)}`, 'success')
        },
        onError: (err) => {
          toast(
            err instanceof Error ? err.message : 'Failed to move event',
            'error',
          )
        },
      },
    )
  }

  const handleDragCancel = () => {
    setActiveId(null)
  }

  // ── Approval drawer commit ───────────────────────────────────────────────

  const handleApprove = async () => {
    if (!approvalDrawerProject) return
    try {
      await approveMutation.mutateAsync()
      toast('Event approved', 'success')
      setApprovalDrawerProject(null)
    } catch (err) {
      toast(
        err instanceof Error ? err.message : 'Failed to approve event',
        'error',
      )
    }
  }

  // Count of user's own events (shown on "Mine" toggle even when in "All" scope)
  const myCount = currentUserId
    ? projects.filter((p) =>
        p.createdById === currentUserId &&
        p.status !== 'COMPLETED' &&
        p.status !== 'CANCELLED',
      ).length
    : 0

  return (
    <>
      {/* Scope toggle — sits above columns */}
      {currentUserId && (
        <div className="flex items-center gap-1 mb-4">
          <div
            className="inline-flex items-center gap-0.5 p-0.5 rounded-full"
            style={{ backgroundColor: WARM_CHIP }}
          >
            <button
              onClick={() => setScope('all')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all cursor-pointer"
              style={{
                backgroundColor: scope === 'all' ? '#ffffff' : 'transparent',
                color: scope === 'all' ? TEXT_PRIMARY : TEXT_SECONDARY,
                boxShadow:
                  scope === 'all'
                    ? '0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.04)'
                    : 'none',
              }}
              aria-pressed={scope === 'all'}
            >
              <Users className="w-3.5 h-3.5" strokeWidth={2} />
              All Events
            </button>
            <button
              onClick={() => setScope('mine')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all cursor-pointer"
              style={{
                backgroundColor: scope === 'mine' ? '#ffffff' : 'transparent',
                color: scope === 'mine' ? TEXT_PRIMARY : TEXT_SECONDARY,
                boxShadow:
                  scope === 'mine'
                    ? '0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.04)'
                    : 'none',
              }}
              aria-pressed={scope === 'mine'}
            >
              <User className="w-3.5 h-3.5" strokeWidth={2} />
              Mine
              {myCount > 0 && (
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: scope === 'mine' ? WARM_CHIP : 'rgba(0,0,0,0.06)',
                    color: TEXT_SECONDARY,
                  }}
                >
                  {myCount}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2">
          {BOARD_COLUMNS.map((col) => (
            <EventBoardColumn
              key={col.status}
              status={col.status}
              title={col.title}
              projects={byColumn[col.status]}
              aiRanked={col.aiRanked}
              addTrigger={
                col.status === 'DRAFT' ? (
                  <CreateEventMenu
                    isAdmin={isAdmin}
                    onSelect={onCreateDraftSelect}
                    align="right"
                    renderTrigger={({ open, toggle }) => (
                      <button
                        type="button"
                        onClick={toggle}
                        aria-haspopup="menu"
                        aria-expanded={open}
                        className="w-6 h-6 rounded-full flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                        style={{
                          color: open ? TEXT_PRIMARY : TEXT_MUTED,
                          backgroundColor: open ? WARM_CHIP : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = WARM_CHIP
                          e.currentTarget.style.color = TEXT_PRIMARY
                        }}
                        onMouseLeave={(e) => {
                          if (!open) {
                            e.currentTarget.style.backgroundColor = 'transparent'
                            e.currentTarget.style.color = TEXT_MUTED
                          }
                        }}
                        aria-label="Create new event"
                      >
                        <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                      </button>
                    )}
                  />
                ) : undefined
              }
              isValidDropTarget={
                !activeProject || validDropTargets.has(col.status)
              }
              isDragActive={!!activeProject}
              currentUserId={currentUserId}
            />
          ))}
        </div>

        {/* Drag overlay — shows a lifted card following the cursor */}
        <DragOverlay>
          {activeProject ? (
            <div style={{ transform: 'rotate(2deg)' }}>
              <EventBoardCard
                project={activeProject}
                isDraggable={false}
                isOwned={!!currentUserId && activeProject.createdById === currentUserId}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Guarded-approval drawer — opens when user drops a Pending card
          into the Confirmed column. */}
      {approvalDrawerProject && (
        <ApprovalReviewDrawer
          isOpen={true}
          onClose={() => setApprovalDrawerProject(null)}
          onApprove={handleApprove}
          isApproving={approveMutation.isPending}
          project={approvalDrawerProject}
        />
      )}
    </>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function labelFor(status: EventTransitionStatus): string {
  const labels: Record<EventTransitionStatus, string> = {
    DRAFT: 'Draft',
    PENDING_APPROVAL: 'Pending Approval',
    CONFIRMED: 'Confirmed',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  }
  return labels[status] ?? status
}
