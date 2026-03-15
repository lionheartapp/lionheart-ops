'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { Users, Edit2, Trash2, Check, X } from 'lucide-react'
import type { EventGroup, GroupParticipant } from '@/lib/hooks/useEventGroups'
import ParticipantCard from './ParticipantCard'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface GroupCardProps {
  group: EventGroup
  participants: GroupParticipant[]
  onRemoveParticipant: (registrationId: string) => void
  onUpdate: (data: { groupId: string; name?: string; capacity?: number; description?: string }) => void
  onDelete: (groupId: string) => void
  isLoading?: boolean
}

// ─── Capacity Bar ────────────────────────────────────────────────────────────────

function CapacityBar({ current, max }: { current: number; max: number | null }) {
  if (!max) {
    return (
      <span className="text-xs text-gray-500">
        {current} participant{current !== 1 ? 's' : ''}
      </span>
    )
  }

  const pct = Math.min(100, Math.round((current / max) * 100))
  const barColor =
    pct > 95 ? 'bg-red-500' : pct > 80 ? 'bg-yellow-400' : 'bg-green-500'
  const textColor = pct > 95 ? 'text-red-600' : pct > 80 ? 'text-yellow-600' : 'text-green-700'

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden min-w-[48px]">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-medium whitespace-nowrap ${textColor}`}>
        {current}/{max}
      </span>
    </div>
  )
}

// ─── Inline Edit Form ────────────────────────────────────────────────────────────

function EditForm({
  group,
  onSave,
  onCancel,
}: {
  group: EventGroup
  onSave: (data: { groupId: string; name?: string; capacity?: number; description?: string }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(group.name)
  const [capacity, setCapacity] = useState(group.capacity?.toString() ?? '')
  const [description, setDescription] = useState(group.description ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      groupId: group.id,
      name: name.trim() || group.name,
      capacity: capacity ? parseInt(capacity, 10) : undefined,
      description: description.trim() || undefined,
    })
    onCancel()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 p-1">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Group name"
        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
        autoFocus
      />
      <input
        type="number"
        value={capacity}
        onChange={(e) => setCapacity(e.target.value)}
        placeholder="Capacity (optional)"
        min={1}
        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer"
        >
          <X className="w-3 h-3" />
          Cancel
        </button>
        <button
          type="submit"
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
        >
          <Check className="w-3 h-3" />
          Save
        </button>
      </div>
    </form>
  )
}

// ─── Main GroupCard Component ────────────────────────────────────────────────────

export default function GroupCard({
  group,
  participants,
  onRemoveParticipant,
  onUpdate,
  onDelete,
}: GroupCardProps) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { setNodeRef, isOver } = useDroppable({
    id: `group-${group.id}`,
    data: { groupId: group.id },
  })

  const leaderName = group.leader
    ? `${group.leader.firstName ?? ''} ${group.leader.lastName ?? ''}`.trim() ||
      group.leader.email
    : null

  return (
    <div
      ref={setNodeRef}
      className={`
        bg-white border rounded-2xl overflow-hidden transition-all duration-150
        ${isOver ? 'border-blue-400 shadow-lg shadow-blue-100 ring-2 ring-blue-200' : 'border-gray-200 shadow-sm'}
        min-h-[200px] flex flex-col
      `}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
        {editing ? (
          <EditForm
            group={group}
            onSave={onUpdate}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900 truncate">{group.name}</h3>
                {leaderName && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">Leader: {leaderName}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                  title="Edit group"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                  title="Delete group"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            <CapacityBar current={participants.length} max={group.capacity} />
          </>
        )}
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex-shrink-0">
          <p className="text-xs text-red-700 font-medium mb-2">
            Delete &quot;{group.name}&quot;? All assignments will be removed.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onDelete(group.id)
                setConfirmDelete(false)
              }}
              className="flex-1 px-2.5 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Participants list */}
      <div className="flex-1 p-3 space-y-2">
        {participants.length === 0 ? (
          <div
            className={`
              flex flex-col items-center justify-center h-full min-h-[120px]
              rounded-xl border-2 border-dashed transition-colors
              ${isOver ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50'}
            `}
          >
            <Users
              className={`w-6 h-6 mb-1.5 ${isOver ? 'text-blue-400' : 'text-gray-300'}`}
            />
            <p className={`text-xs ${isOver ? 'text-blue-500' : 'text-gray-400'}`}>
              {isOver ? 'Drop to assign' : 'Drag participants here'}
            </p>
          </div>
        ) : (
          <>
            {participants.map((p) => (
              <ParticipantCard
                key={p.registrationId}
                participant={p}
                draggable={false}
                onRemove={() => onRemoveParticipant(p.registrationId)}
              />
            ))}
            {/* Drop zone hint at bottom */}
            {isOver && (
              <div className="flex items-center justify-center h-10 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50">
                <p className="text-xs text-blue-500">Drop to add</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
