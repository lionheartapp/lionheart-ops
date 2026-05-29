'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { DoorOpen, Plus, Save, XCircle, Edit2, Camera, Trash2, UserPlus, X, Search } from 'lucide-react'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput } from '@/components/ui/FloatingInput'
import { Input } from '@/components/ui/Input'
import RowActionMenu from '@/components/RowActionMenu'
import ImageUpload from '@/components/settings/ImageUpload'
import { getAuthHeaders } from '@/lib/api-client'
import { type Building, type Room, type RoomAssignmentUser, renderStatusBadge } from './types'
import { OptimizedImage } from '@/components/ui/OptimizedImage'

// ─── Types ──────────────────────────────────────────────────────────────────

type MemberOption = {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
  avatar: string | null
  jobTitle: string | null
}

type RoomsDrawerProps = {
  building: Building | null
  rooms: Room[]
  onClose: () => void
  onAddRoom: (form: { roomNumber: string; displayName: string; floor: string }) => Promise<void>
  onEditRoom: (roomId: string, form: { roomNumber: string; displayName: string; floor: string }) => Promise<void>
  onDeactivateRoom: (id: string, name: string) => void
  onRoomImagesChange: (roomId: string, images: string[]) => void
  onImageClick: (images: string[], index: number) => void
  onAssignPerson?: (roomId: string, userId: string) => Promise<void>
  onUnassignPerson?: (assignmentId: string) => Promise<void>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function userName(u: RoomAssignmentUser | MemberOption): string {
  if (u.firstName || u.lastName) {
    return [u.firstName, u.lastName].filter(Boolean).join(' ')
  }
  return u.email
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-green-100 text-green-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

// ─── Inline Person Picker ───────────────────────────────────────────────────

function PersonSearchPicker({
  onSelect,
  onCancel,
  excludeUserIds,
}: {
  onSelect: (user: MemberOption) => void
  onCancel: () => void
  excludeUserIds: string[]
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MemberOption[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCancel()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onCancel])

  // Search members
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const controller = new AbortController()
    setLoading(true)
    fetch(`/api/settings/users?search=${encodeURIComponent(query.trim())}&limit=8`, {
      headers: getAuthHeaders(),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          const filtered = (data.data?.users || data.data || []).filter(
            (u: MemberOption) => !excludeUserIds.includes(u.id),
          )
          setResults(filtered.slice(0, 6))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [query, excludeUserIds])

  return (
    <div ref={containerRef} className="absolute z-50 top-full left-0 mt-1 w-full max-w-[280px] bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
      <div className="p-2 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members..."
            size="sm"
            className="w-full pl-8 text-sm"
            onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
          />
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {loading && (
          <div className="px-3 py-4 text-center text-xs text-slate-400">Searching...</div>
        )}
        {!loading && query.trim() && results.length === 0 && (
          <div className="px-3 py-4 text-center text-xs text-slate-400">No members found</div>
        )}
        {!loading && !query.trim() && (
          <div className="px-3 py-4 text-center text-xs text-slate-400">Type a name to search</div>
        )}
        {results.map((u) => {
          const name = userName(u)
          return (
            <button
              key={u.id}
              onClick={() => onSelect(u)}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition-colors text-left cursor-pointer"
            >
              {u.avatar ? (
                <OptimizedImage src={u.avatar} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${avatarColor(name)}`}>
                  {getInitials(name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-800 truncate">{name}</div>
                {u.jobTitle && <div className="text-xs text-slate-400 truncate">{u.jobTitle}</div>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Assigned Person Chip ───────────────────────────────────────────────────

function AssignedChip({
  user,
  assignmentId,
  onRemove,
}: {
  user: RoomAssignmentUser
  assignmentId: string
  onRemove: (id: string) => void
}) {
  const name = userName(user)
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-sm group">
      {user.avatar ? (
        <OptimizedImage src={user.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
      ) : (
        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${avatarColor(name)}`}>
          {getInitials(name)}
        </div>
      )}
      <span className="text-slate-700 truncate max-w-[120px]">{name}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(assignmentId) }}
        className="p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition cursor-pointer"
        title="Unassign"
        aria-label={`Unassign ${name}`}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function RoomsDrawer({
  building,
  rooms,
  onClose,
  onAddRoom,
  onEditRoom,
  onDeactivateRoom,
  onRoomImagesChange,
  onImageClick,
  onAssignPerson,
  onUnassignPerson,
}: RoomsDrawerProps) {
  // Add form state
  const [addForm, setAddForm] = useState({ roomNumber: '', displayName: '', floor: '' })
  const [addError, setAddError] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState({ roomNumber: '', displayName: '', floor: '' })
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Image expand state
  const [imagesId, setImagesId] = useState<string | null>(null)

  // Person picker state
  const [assigningRoomId, setAssigningRoomId] = useState<string | null>(null)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError('')
    if (!addForm.roomNumber.trim()) { setAddError('Room number is required'); return }
    setAddSaving(true)
    try {
      await onAddRoom(addForm)
      setAddForm({ roomNumber: '', displayName: '', floor: '' })
      setAddError('')
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add room')
    } finally {
      setAddSaving(false)
    }
  }

  const startEdit = (r: Room) => {
    setEditingId(r.id)
    setEditData({ roomNumber: r.roomNumber, displayName: r.displayName || '', floor: r.floor || '' })
    setEditError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditError('')
  }

  const saveEdit = async (roomId: string) => {
    setEditError('')
    if (!editData.roomNumber.trim()) { setEditError('Room number is required'); return }
    setEditSaving(true)
    try {
      await onEditRoom(roomId, editData)
      setEditingId(null)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save room')
    } finally {
      setEditSaving(false)
    }
  }

  const handleClose = () => {
    if (addSaving || editSaving) return
    setEditingId(null)
    setAssigningRoomId(null)
    setAddForm({ roomNumber: '', displayName: '', floor: '' })
    onClose()
  }

  const handleAssign = useCallback(async (roomId: string, user: MemberOption) => {
    setAssigningRoomId(null)
    if (onAssignPerson) {
      await onAssignPerson(roomId, user.id)
    }
  }, [onAssignPerson])

  const handleUnassign = useCallback(async (assignmentId: string) => {
    if (onUnassignPerson) {
      await onUnassignPerson(assignmentId)
    }
  }, [onUnassignPerson])

  const hasAssignmentSupport = !!onAssignPerson && !!onUnassignPerson

  return (
    <DetailDrawer
      isOpen={building !== null}
      onClose={handleClose}
      title={building ? `${building.name} — Rooms` : 'Rooms'}
      width="lg"
    >
      <div className="p-5 space-y-4">
        {/* Add form */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">Add a room</p>
          {addError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{addError}</div>
          )}
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <FloatingInput id="ct-roomNumber" label="Room # / ID" value={addForm.roomNumber} onChange={(e) => setAddForm((p) => ({ ...p, roomNumber: e.target.value }))} disabled={addSaving} required />
              <FloatingInput id="ct-roomDisplayName" label="Name (optional)" value={addForm.displayName} onChange={(e) => setAddForm((p) => ({ ...p, displayName: e.target.value }))} disabled={addSaving} />
              <FloatingInput id="ct-roomFloor" label="Floor (optional)" value={addForm.floor} onChange={(e) => setAddForm((p) => ({ ...p, floor: e.target.value }))} disabled={addSaving} />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2 min-h-[38px] bg-slate-900 text-white text-sm font-semibold rounded-full hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={addSaving}
              >
                <Plus className="w-4 h-4" />
                {addSaving ? 'Adding...' : 'Add Room'}
              </button>
            </div>
          </form>
        </div>

        {/* Room list */}
        {editError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{editError}</div>
        )}

        {rooms.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <DoorOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No rooms yet — add one above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rooms.map((r) => {
              const assignments = r.assignments || []
              const assignedUserIds = assignments.map((a) => a.userId)

              return editingId === r.id ? (
                <div key={r.id} className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Room # / ID</label>
                      <Input aria-label="Room number" value={editData.roomNumber} onChange={(e) => setEditData((p) => ({ ...p, roomNumber: e.target.value }))} className="w-full text-sm" disabled={editSaving} autoFocus />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
                      <Input aria-label="Room display name" value={editData.displayName} onChange={(e) => setEditData((p) => ({ ...p, displayName: e.target.value }))} placeholder="optional" className="w-full text-sm" disabled={editSaving} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Floor</label>
                      <Input aria-label="Room floor" value={editData.floor} onChange={(e) => setEditData((p) => ({ ...p, floor: e.target.value }))} placeholder="optional" className="w-full text-sm" disabled={editSaving} />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={cancelEdit} disabled={editSaving} className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-full transition cursor-pointer">
                      Cancel
                    </button>
                    <button onClick={() => saveEdit(r.id)} disabled={editSaving} className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-full transition disabled:opacity-40 cursor-pointer">
                      <Save className="w-3.5 h-3.5" />
                      {editSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <div key={r.id} className="rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors duration-150">
                  {/* Room header row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex-shrink-0">
                      <DoorOpen className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{r.roomNumber}</span>
                        {r.displayName && (
                          <span className="text-sm text-slate-500">{r.displayName}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {r.floor && (
                          <span className="text-xs text-slate-400">Floor {r.floor}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {renderStatusBadge(r.isActive)}
                      <RowActionMenu
                        items={[
                          { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: () => startEdit(r) },
                          { label: 'Photos', icon: <Camera className="w-4 h-4" />, onClick: () => setImagesId(imagesId === r.id ? null : r.id) },
                          { label: 'Deactivate', icon: <Trash2 className="w-4 h-4" />, onClick: () => onDeactivateRoom(r.id, r.displayName || r.roomNumber), variant: 'danger' as const },
                        ]}
                      />
                    </div>
                  </div>

                  {/* Assignments section */}
                  {hasAssignmentSupport && (
                    <div className="relative px-4 pb-3 pt-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {assignments.map((a) => (
                          <AssignedChip
                            key={a.id}
                            user={a.user}
                            assignmentId={a.id}
                            onRemove={handleUnassign}
                          />
                        ))}
                        <button
                          onClick={() => setAssigningRoomId(assigningRoomId === r.id ? null : r.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-full transition cursor-pointer"
                          title="Assign person"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          {assignments.length === 0 ? 'Assign person' : 'Add'}
                        </button>
                      </div>
                      {assigningRoomId === r.id && (
                        <PersonSearchPicker
                          onSelect={(user) => handleAssign(r.id, user)}
                          onCancel={() => setAssigningRoomId(null)}
                          excludeUserIds={assignedUserIds}
                        />
                      )}
                    </div>
                  )}

                  {/* Image upload expand */}
                  {imagesId === r.id && (
                    <div className="border-t border-slate-100 px-4 py-4">
                      <ImageUpload
                        entityType="room"
                        entityId={r.id}
                        images={r.images || []}
                        onImagesChange={(imgs) => onRoomImagesChange(r.id, imgs)}
                        onImageClick={onImageClick}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DetailDrawer>
  )
}
