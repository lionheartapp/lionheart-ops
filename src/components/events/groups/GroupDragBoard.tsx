'use client'

import { useState, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Search, Plus, Wand2, Filter } from 'lucide-react'
import { motion } from 'framer-motion'
import { staggerContainer, fadeInUp } from '@/lib/animations'
import { useToast } from '@/components/Toast'
import {
  useGroups,
  useGroupAssignments,
  useAssignToGroup,
  useRemoveFromGroup,
  useAutoAssign,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
} from '@/lib/hooks/useEventGroups'
import type { EventGroupType, EventGroup, GroupParticipant } from '@/lib/hooks/useEventGroups'
import GroupCard from './GroupCard'
import ParticipantCard from './ParticipantCard'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface GroupDragBoardProps {
  eventProjectId: string
  groupType: EventGroupType
}

// ─── Skeleton ───────────────────────────────────────────────────────────────────

function BoardSkeleton() {
  return (
    <div className="flex gap-4 animate-pulse">
      {/* Pool skeleton */}
      <div className="w-72 flex-shrink-0 space-y-2">
        <div className="h-9 bg-slate-200 rounded-xl" />
        <div className="h-5 bg-slate-100 rounded w-32" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 bg-slate-100 rounded-xl" />
        ))}
      </div>

      {/* Groups skeleton */}
      <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 bg-slate-100 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

// ─── Add Group Form ──────────────────────────────────────────────────────────────

function AddGroupInlineForm({
  groupType,
  onAdd,
  onCancel,
}: {
  groupType: EventGroupType
  onAdd: (data: { type: EventGroupType; name: string; capacity?: number }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState('')

  const defaultName = {
    BUS: 'Bus',
    CABIN: 'Cabin',
    SMALL_GROUP: 'Group',
  }[groupType]

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onAdd({
      type: groupType,
      name: name.trim(),
      capacity: capacity ? parseInt(capacity, 10) : undefined,
    })
    onCancel()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="ui-glass p-4 rounded-2xl border border-blue-200 space-y-3"
    >
      <h4 className="text-sm font-semibold text-slate-800">New {defaultName}</h4>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={`${defaultName} name`}
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <input
        type="number"
        value={capacity}
        onChange={(e) => setCapacity(e.target.value)}
        placeholder="Capacity (optional)"
        min={1}
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!name.trim()}
          className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
        >
          Add {defaultName}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── Unassigned Pool ─────────────────────────────────────────────────────────────

function UnassignedPool({
  participants,
  isLoading,
  eventProjectId,
  groupType,
  groups,
}: {
  participants: GroupParticipant[]
  isLoading: boolean
  eventProjectId: string
  groupType: EventGroupType
  groups: EventGroup[]
}) {
  const [search, setSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const autoAssign = useAutoAssign(eventProjectId)
  const { toast } = useToast()

  const filtered = useMemo(() => {
    return participants.filter((p) => {
      const fullName = `${p.firstName} ${p.lastName}`.toLowerCase()
      const matchesSearch = !search || fullName.includes(search.toLowerCase())
      const matchesGrade = !gradeFilter || p.grade === gradeFilter
      return matchesSearch && matchesGrade
    })
  }, [participants, search, gradeFilter])

  const grades = useMemo(() => {
    const gradeSet = new Set<string>()
    participants.forEach((p) => {
      if (p.grade) gradeSet.add(p.grade)
    })
    return Array.from(gradeSet).sort()
  }, [participants])

  async function handleAutoAssign() {
    try {
      const result = await autoAssign.mutateAsync({ groupType })
      toast(`Auto-assigned ${result.assignmentsCreated} participants`, 'success')
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Auto-assign failed'
      toast(message, 'error')
    }
  }

  return (
    <div className="w-72 flex-shrink-0 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Unassigned</h3>
          <p className="text-xs text-slate-500">{participants.length} participants</p>
        </div>
        <button
          type="button"
          onClick={handleAutoAssign}
          disabled={autoAssign.isPending || participants.length === 0 || groups.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 transition-colors cursor-pointer"
        >
          <Wand2 className="w-3 h-3" />
          {autoAssign.isPending ? 'Assigning...' : 'Auto-Assign'}
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search participants..."
          className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        />
      </div>

      {/* Grade filter */}
      {grades.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-3 h-3 text-slate-400 flex-shrink-0" />
          <button
            type="button"
            onClick={() => setGradeFilter('')}
            className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              !gradeFilter ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All
          </button>
          {grades.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGradeFilter(gradeFilter === g ? '' : g)}
              className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                gradeFilter === g
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Gr. {g}
            </button>
          ))}
        </div>
      )}

      {/* Participant list */}
      <div className="flex-1 space-y-2 overflow-y-auto max-h-[calc(100vh-24rem)] pr-1">
        {isLoading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm font-medium text-slate-600">
              {participants.length === 0
                ? 'All participants are assigned!'
                : 'No matches found'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {participants.length === 0
                ? 'Use Remove buttons to move people back here.'
                : 'Try adjusting your search or filter.'}
            </p>
          </div>
        ) : (
          filtered.map((p) => (
            <ParticipantCard
              key={p.registrationId}
              participant={p}
              draggable
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Main Board ──────────────────────────────────────────────────────────────────

export default function GroupDragBoard({ eventProjectId, groupType }: GroupDragBoardProps) {
  const { toast } = useToast()

  // State
  const [showAddForm, setShowAddForm] = useState(false)
  const [activeDragData, setActiveDragData] = useState<GroupParticipant | null>(null)

  // Queries
  const { data: groups = [], isLoading: groupsLoading } = useGroups(eventProjectId, groupType)
  // For the unassigned pool we use the first group's assignments query (which returns unassigned pool too)
  // Actually we need a combined view. We use the first group's endpoint for the unassigned pool.
  // The assignment endpoint returns { assignments, unassigned, capacity } for a specific group.
  // For the board we need all assignments across all groups + the unassigned pool.
  // We fetch all groups and their assignments, then build a combined view.

  // Build per-group assignment data from individual group queries
  // We use a combined fetch pattern: one query per group.
  const groupAssignmentQueries = useGroupsWithAssignments(eventProjectId, groups)

  // Build combined state
  const allAssigned = useMemo(() => {
    const assigned = new Set<string>()
    for (const gd of groupAssignmentQueries) {
      gd.assignments.forEach((a) => assigned.add(a.registrationId))
    }
    return assigned
  }, [groupAssignmentQueries])

  const unassignedPool = useMemo(() => {
    // Take the unassigned pool from the first group query (server computes it per type)
    return groupAssignmentQueries[0]?.unassigned ?? []
  }, [groupAssignmentQueries])

  const isLoadingAssignments = groupAssignmentQueries.some((gd) => gd.isLoading)

  // Mutations
  const assignToGroup = useAssignToGroup(eventProjectId)
  const removeFromGroup = useRemoveFromGroup(eventProjectId)
  const createGroup = useCreateGroup(eventProjectId)
  const updateGroup = useUpdateGroup(eventProjectId)
  const deleteGroup = useDeleteGroup(eventProjectId)

  // DnD sensors
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragData(null)
    const { active, over } = event

    if (!over) return

    const dragData = active.data.current as { registrationId: string; participant: GroupParticipant } | undefined
    if (!dragData) return

    const overId = String(over.id)
    if (!overId.startsWith('group-')) return

    const groupId = overId.replace('group-', '')

    // Check if already assigned to this group
    const groupData = groupAssignmentQueries.find((gd) => gd.groupId === groupId)
    if (groupData?.assignments.some((a) => a.registrationId === dragData.registrationId)) {
      return // Already in this group
    }

    try {
      await assignToGroup.mutateAsync({
        groupId,
        registrationId: dragData.registrationId,
      })
      toast(`${dragData.participant.firstName} added to group`, 'success')
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Failed to assign participant'
      toast(message, 'error')
    }
  }

  async function handleRemove(groupId: string, registrationId: string) {
    try {
      await removeFromGroup.mutateAsync({ groupId, registrationId })
    } catch {
      toast('Failed to remove participant', 'error')
    }
  }

  if (groupsLoading) return <BoardSkeleton />

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e) => {
        const data = e.active.data.current as { participant: GroupParticipant } | undefined
        if (data?.participant) setActiveDragData(data.participant)
      }}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6">
        {/* Left: Unassigned Pool */}
        <UnassignedPool
          participants={unassignedPool}
          isLoading={isLoadingAssignments && groups.length > 0}
          eventProjectId={eventProjectId}
          groupType={groupType}
          groups={groups}
        />

        {/* Right: Group cards */}
        <div className="flex-1">
          {/* Groups header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {groups.length} Group{groups.length !== 1 ? 's' : ''}
              </h3>
              <p className="text-xs text-slate-500">
                {allAssigned.size} assigned
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Group
            </button>
          </div>

          {showAddForm && (
            <div className="mb-4">
              <AddGroupInlineForm
                groupType={groupType}
                onAdd={async (data) => {
                  try {
                    await createGroup.mutateAsync(data)
                    setShowAddForm(false)
                    toast('Group created', 'success')
                  } catch {
                    toast('Failed to create group', 'error')
                  }
                }}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          )}

          {groups.length === 0 && !showAddForm ? (
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="flex flex-col items-center justify-center py-16 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200"
            >
              <p className="text-sm font-semibold text-slate-700 mb-1">
                No groups created yet
              </p>
              <p className="text-sm text-slate-500 mb-4">
                Add a group to start organizing participants.
              </p>
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add First Group
              </button>
            </motion.div>
          ) : (
            <motion.div
              variants={staggerContainer()}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {groups.map((group) => {
                const gd = groupAssignmentQueries.find((q) => q.groupId === group.id)
                return (
                  <motion.div key={group.id} variants={fadeInUp}>
                    <GroupCard
                      group={group}
                      participants={gd?.assignments ?? []}
                      onRemoveParticipant={(regId) => handleRemove(group.id, regId)}
                      onUpdate={(data) => updateGroup.mutate(data)}
                      onDelete={(groupId) => deleteGroup.mutate(groupId)}
                    />
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay dropAnimation={null}>
        {activeDragData ? (
          <ParticipantCard participant={activeDragData} isOverlay draggable={false} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// ─── Per-group assignments hook helper ──────────────────────────────────────────

/**
 * Fetches assignments for each group individually.
 * Returns stable array of { groupId, assignments, unassigned, isLoading }.
 */
function useGroupsWithAssignments(
  eventProjectId: string,
  groups: EventGroup[]
): Array<{
  groupId: string
  assignments: GroupParticipant[]
  unassigned: GroupParticipant[]
  isLoading: boolean
}> {
  // We need to call useGroupAssignments per group but hooks can't be inside loops.
  // We work around this by fetching all groups with a static max of 20 slots.
  // Groups beyond 20 are not fetched (acceptable for real-world use cases).
  const g0 = useSingleGroupAssignments(eventProjectId, groups[0]?.id)
  const g1 = useSingleGroupAssignments(eventProjectId, groups[1]?.id)
  const g2 = useSingleGroupAssignments(eventProjectId, groups[2]?.id)
  const g3 = useSingleGroupAssignments(eventProjectId, groups[3]?.id)
  const g4 = useSingleGroupAssignments(eventProjectId, groups[4]?.id)
  const g5 = useSingleGroupAssignments(eventProjectId, groups[5]?.id)
  const g6 = useSingleGroupAssignments(eventProjectId, groups[6]?.id)
  const g7 = useSingleGroupAssignments(eventProjectId, groups[7]?.id)
  const g8 = useSingleGroupAssignments(eventProjectId, groups[8]?.id)
  const g9 = useSingleGroupAssignments(eventProjectId, groups[9]?.id)
  const g10 = useSingleGroupAssignments(eventProjectId, groups[10]?.id)
  const g11 = useSingleGroupAssignments(eventProjectId, groups[11]?.id)
  const g12 = useSingleGroupAssignments(eventProjectId, groups[12]?.id)
  const g13 = useSingleGroupAssignments(eventProjectId, groups[13]?.id)
  const g14 = useSingleGroupAssignments(eventProjectId, groups[14]?.id)
  const g15 = useSingleGroupAssignments(eventProjectId, groups[15]?.id)
  const g16 = useSingleGroupAssignments(eventProjectId, groups[16]?.id)
  const g17 = useSingleGroupAssignments(eventProjectId, groups[17]?.id)
  const g18 = useSingleGroupAssignments(eventProjectId, groups[18]?.id)
  const g19 = useSingleGroupAssignments(eventProjectId, groups[19]?.id)

  const all = [g0, g1, g2, g3, g4, g5, g6, g7, g8, g9, g10, g11, g12, g13, g14, g15, g16, g17, g18, g19]

  return groups
    .slice(0, 20)
    .map((group, i) => ({
      groupId: group.id,
      assignments: all[i]?.data?.assignments ?? [],
      unassigned: all[i]?.data?.unassigned ?? [],
      isLoading: all[i]?.isLoading ?? false,
    }))
}

/**
 * Thin wrapper around useGroupAssignments for use in the static slot pattern.
 */
function useSingleGroupAssignments(eventProjectId: string, groupId: string | undefined) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useGroupAssignments(eventProjectId, groupId)
}
