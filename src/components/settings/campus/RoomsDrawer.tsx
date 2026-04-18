'use client'

import React, { useState } from 'react'
import { DoorOpen, Plus, Save, XCircle, Edit2, Camera, Trash2 } from 'lucide-react'
import DetailDrawer from '@/components/DetailDrawer'
import { FloatingInput } from '@/components/ui/FloatingInput'
import RowActionMenu from '@/components/RowActionMenu'
import ImageUpload from '@/components/settings/ImageUpload'
import { type Building, type Room, renderStatusBadge } from './types'

type RoomsDrawerProps = {
  building: Building | null
  rooms: Room[]
  onClose: () => void
  onAddRoom: (form: { roomNumber: string; displayName: string; floor: string }) => Promise<void>
  onEditRoom: (roomId: string, form: { roomNumber: string; displayName: string; floor: string }) => Promise<void>
  onDeactivateRoom: (id: string, name: string) => void
  onRoomImagesChange: (roomId: string, images: string[]) => void
  onImageClick: (images: string[], index: number) => void
}

export default function RoomsDrawer({
  building,
  rooms,
  onClose,
  onAddRoom,
  onEditRoom,
  onDeactivateRoom,
  onRoomImagesChange,
  onImageClick,
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
    setAddForm({ roomNumber: '', displayName: '', floor: '' })
    onClose()
  }

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
                  <th className="py-2.5 px-3 text-left font-medium">Floor</th>
                  <th className="py-2.5 px-3 text-left font-medium">Status</th>
                  <th className="py-2.5 pl-3 pr-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) =>
                  editingId === r.id ? (
                    <tr key={r.id} className="border-b last:border-b-0 bg-primary-50">
                      <td className="py-2 px-3">
                        <input aria-label="Room number" value={editData.roomNumber} onChange={(e) => setEditData((p) => ({ ...p, roomNumber: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-transparent" disabled={editSaving} autoFocus />
                      </td>
                      <td className="py-2 px-3">
                        <input aria-label="Room display name" value={editData.displayName} onChange={(e) => setEditData((p) => ({ ...p, displayName: e.target.value }))} placeholder="optional" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-transparent" disabled={editSaving} />
                      </td>
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
                          <td colSpan={5} className="px-4 py-4">
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
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DetailDrawer>
  )
}
