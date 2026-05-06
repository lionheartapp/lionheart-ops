'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { DoorOpen, Plus, Save, XCircle, Edit2, Camera, Trash2, UserPlus, X, Search } from 'lucide-react'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput } from '@/components/ui/FloatingInput'
import RowActionMenu from '@/components/RowActionMenu'
import ImageUpload from '@/components/settings/ImageUpload'
import { getAuthHeaders } from '@/lib/api-client'
import { type Building, type Room, type RoomAssignmentUser, renderStatusBadge } from './types'

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
    <div ref={containerRef} className="absolute z-50 top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
      <div className="p-2 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members..."
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
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
                <img src={u.avatar} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
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
        <img src={user.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          <div className="ui-glass-table overflow-x-auto">
            <table className="min-w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="text-slate-500 border-b bg-slate-50">
                  <th className="py-2.5 px-3 text-left font-medium">Room</th>
                  <th className="py-2.5 px-3 text-left font-medium">Display name</th>
                  {hasAssignmentSupport && (
                    <th className="py-2.5 px-3 text-left font-medium">Assigned to</th>
                  )}
                  <th className="py-2.5 px-3 text-left font-medium">Floor</th>
                  <th className="py-2.5 px-3 text-left font-medium">Status</th>
                  <th className="py-2.5 pl-3 pr-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => {
                  const assignments = r.assignments || []
                  const assignedUserIds = assignments.map((a) => a.userId)

                  return editingId === r.id ? (
                    <tr key={r.id} className="border-b last:border-b-0 bg-primary-50">
                      <td className="py-2 px-3">
                        <input aria-label="Room number" value={editData.roomNumber} onChange={(e) => setEditData((p) => ({ ...p, roomNumber: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-transparent" disabled={editSaving} autoFocus />
                      </td>
                      <td className="py-2 px-3">
                        <input aria-label="Room display name" value={editData.displayName} onChange={(e) => setEditData((p) => ({ ...p, displayName: e.target.value }))} placeholder="optional" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-transparent" disabled={editSaving} />
                      </td>
                      {hasAssignmentSupport && <td className="py-2 px-3" />}
                      <td className="py-2 px-3">
                        <input aria-label="Room floor" value={editData.floor} onChange={(e) => setEditData((p) => ({ ...p, floor: e.target.value }))} placeholder="optional" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-transparent" disabled={editSaving} />
                      </td>
                      <td className="py-2 px-3">{renderStatusBadge(r.isActive)}</td>
                      <td className="py-2 pl-3 pr-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => saveEdit(r.id)} disabled={editSaving} className="p-2 text-green-600 hover:bg-green-50 rounded-full transition disabled:opacity-40" title="Save" aria-label="Save">
                            <Save className="w-4 h-4" />
                          </button>
                          <button onClick={cancelEdit} disabled={editSaving} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition" title="Cancel" aria-label="Cancel">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <React.Fragment key={r.id}>
                      <tr className="border-b last:border-b-0 hover:bg-slate-50 transition-colors duration-150">
                        <td className="py-2.5 px-3 font-medium text-slate-900">{r.roomNumber}</td>
                        <td className="py-2.5 px-3 text-slate-600">{r.displayName || <span className="text-slate-400">—</span>}</td>
                        {hasAssignmentSupport && (
                          <td className="py-2.5 px-3">
                            <div className="relative flex items-center gap-1.5 flex-wrap">
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
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-full transition cursor-pointer"
                                title="Assign person"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                {assignments.length === 0 && 'Assign'}
                              </button>
                              {assigningRoomId === r.id && (
                                <PersonSearchPicker
                                  onSelect={(user) => handleAssign(r.id, user)}
                                  onCancel={() => setAssigningRoomId(null)}
                                  excludeUserIds={assignedUserIds}
                                />
                              )}
                            </div>
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-slate-600">{r.floor || <span className="text-slate-400">—</span>}</td>
                        <td className="py-2.5 px-3">{renderStatusBadge(r.isActive)}</td>
                        <td className="py-2.5 pl-3 pr-3">
                          <div className="flex justify-end">
                            <RowActionMenu
                              items={[
                                { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: () => startEdit(r) },
                                { label: 'Photos', icon: <Camera className="w-4 h-4" />, onClick: () => setImagesId(imagesId === r.id ? null : r.id) },
                                { label: 'Deactivate', icon: <Trash2 className="w-4 h-4" />, onClick: () => onDeactivateRoom(r.id, r.displayName || r.roomNumber), variant: 'danger' as const },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                      {imagesId === r.id && (
                        <tr className="border-b last:border-b-0 bg-slate-50">
                          <td colSpan={hasAssignmentSupport ? 6 : 5} className="px-4 py-4">
                            <ImageUpload
                              entityType="room"
                              entityId={r.id}
                              images={r.images || []}
                              onImagesChange={(imgs) => onRoomImagesChange(r.id, imgs)}
                              onImageClick={onImageClick}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DetailDrawer>
  )
}
