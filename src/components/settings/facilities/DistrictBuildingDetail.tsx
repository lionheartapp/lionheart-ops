'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, ChevronDown, ChevronRight, DoorOpen, Edit2, MapPin, Pencil, Plus, Trash2, TreePine, X, Check } from 'lucide-react'
import { getAuthHeaders } from '@/lib/api-client'
import InteractiveCampusMap from '@/components/settings/InteractiveCampusMap'
import RoomsDrawer from '@/components/settings/campus/RoomsDrawer'
import PhotoLightbox from '@/components/settings/PhotoLightbox'
import DetailDrawer from '@/components/DetailDrawer'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import RowActionMenu from '@/components/RowActionMenu'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { Room } from '@/components/settings/campus/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type BuildingDetail = {
  id: string
  name: string
  code: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  buildingType: string
  isActive: boolean
  images?: string[]
  polygonCoordinates?: { lat: number; lng: number }[] | null
}

type BuildingSpace = {
  id: string
  name: string
  spaceType: string
  isActive: boolean
}

type DistrictBuildingDetailProps = {
  buildingId: string
}

const BUILDING_TYPE_LABELS: Record<string, string> = {
  GENERAL: 'General',
  ACADEMIC: 'Academic',
  ADMINISTRATION: 'Administration',
  ATHLETICS: 'Athletics',
  ARTS_CULTURE: 'Arts & Culture',
  RESIDENTIAL: 'Residential',
  MAINTENANCE: 'Maintenance',
  DINING: 'Dining',
  LIBRARY: 'Library',
  RECREATION: 'Recreation',
  PARKING: 'Parking',
  OTHER: 'Other',
}

const SPACE_TYPE_LABELS: Record<string, string> = {
  FIELD: 'Athletic Field',
  COURT: 'Court',
  GYM: 'Gymnasium',
  COMMON: 'Gathering Area',
  PARKING: 'Parking',
  PLAYGROUND: 'Playground',
  POOL: 'Pool',
  GARDEN: 'Garden',
  OTHER: 'Other',
}

const SPACE_TYPE_OPTIONS = Object.entries(SPACE_TYPE_LABELS).map(([value, label]) => ({ value, label }))

const ACCENT_COLOR = '#6366f1'

// ─── Component ────────────────────────────────────────────────────────────────

export default function DistrictBuildingDetail({ buildingId }: DistrictBuildingDetailProps) {
  const [building, setBuilding] = useState<BuildingDetail | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [spaces, setSpaces] = useState<BuildingSpace[]>([])
  const [loading, setLoading] = useState(true)
  const [roomsDrawerOpen, setRoomsDrawerOpen] = useState(false)
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', code: '', buildingType: 'GENERAL', address: '' })
  const [saving, setSaving] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Space drawer
  const [spaceDrawerOpen, setSpaceDrawerOpen] = useState(false)
  const [spaceForm, setSpaceForm] = useState({ name: '', spaceType: 'OTHER' })
  const [spaceSaving, setSpaceSaving] = useState(false)
  const [spaceError, setSpaceError] = useState('')

  // Inline room edit
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [editRoomForm, setEditRoomForm] = useState({ roomNumber: '', displayName: '', floor: '' })
  const [editRoomSaving, setEditRoomSaving] = useState(false)

  // Room delete confirm
  const [deleteRoomTarget, setDeleteRoomTarget] = useState<Room | null>(null)
  const [deleteRoomLoading, setDeleteRoomLoading] = useState(false)

  // ── Load building + rooms + spaces ────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [bRes, rRes, sRes] = await Promise.all([
        fetch(`/api/settings/campus/buildings/${buildingId}`, { headers: getAuthHeaders(), credentials: 'include' }),
        fetch(`/api/settings/campus/rooms?buildingId=${buildingId}`, { headers: getAuthHeaders(), credentials: 'include' }),
        fetch(`/api/settings/campus/spaces?buildingId=${buildingId}`, { headers: getAuthHeaders(), credentials: 'include' }),
      ])
      const bData = await bRes.json()
      const rData = await rRes.json()
      const sData = await sRes.json()
      if (bData.ok) setBuilding(bData.data)
      if (rData.ok) setRooms(Array.isArray(rData.data) ? rData.data : rData.data?.rooms ?? [])
      if (sData.ok) setSpaces(Array.isArray(sData.data) ? sData.data : [])
    } catch {
      // silent — building was already validated by parent
    } finally {
      setLoading(false)
    }
  }, [buildingId])

  useEffect(() => { loadData() }, [loadData])

  // ── Map center from building coords (server auto-geocodes if address exists) ──
  const mapCenter = building?.latitude && building?.longitude
    ? { lat: building.latitude, lng: building.longitude, name: building.name, address: building.address }
    : null

  // ── Map building data ──────────────────────────────────────────────────────
  const mapBuildings = building?.latitude && building?.longitude
    ? [{ id: building.id, name: building.name, code: building.code, latitude: building.latitude, longitude: building.longitude, polygonCoordinates: building.polygonCoordinates }]
    : []

  // ── Room management handlers ───────────────────────────────────────────────
  const handleAddRoom = async (form: { roomNumber: string; displayName: string; floor: string }) => {
    const res = await fetch('/api/settings/campus/rooms', {
      method: 'POST',
      headers: { ...(getAuthHeaders()), 'Content-Type': 'application/json' }, credentials: 'include' as const,
      body: JSON.stringify({ buildingId, roomNumber: form.roomNumber, displayName: form.displayName || null, floor: form.floor || null }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error?.message || 'Failed to add room')
    await loadData()
  }

  const handleEditRoom = async (roomId: string, form: { roomNumber: string; displayName: string; floor: string }) => {
    const res = await fetch(`/api/settings/campus/rooms/${roomId}`, {
      method: 'PATCH',
      headers: { ...(getAuthHeaders()), 'Content-Type': 'application/json' }, credentials: 'include' as const,
      body: JSON.stringify({ roomNumber: form.roomNumber, displayName: form.displayName || null, floor: form.floor || null }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error?.message || 'Failed to update room')
    await loadData()
  }

  const handleDeactivateRoom = async (id: string) => {
    await fetch(`/api/settings/campus/rooms/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(), credentials: 'include' as const,
    })
    await loadData()
  }

  const handleRoomImagesChange = async (roomId: string, images: string[]) => {
    await fetch(`/api/settings/campus/rooms/${roomId}`, {
      method: 'PATCH',
      headers: { ...(getAuthHeaders()), 'Content-Type': 'application/json' }, credentials: 'include' as const,
      body: JSON.stringify({ images }),
    })
    await loadData()
  }

  const handleBuildingPositionChange = async (id: string, lat: number, lng: number) => {
    await fetch(`/api/settings/campus/buildings/${id}`, {
      method: 'PATCH',
      headers: { ...(getAuthHeaders()), 'Content-Type': 'application/json' }, credentials: 'include' as const,
      body: JSON.stringify({ latitude: lat, longitude: lng }),
    })
    await loadData()
  }

  // ── Room assignment handlers ───────────────────────────────────────────────
  const handleAssignPerson = async (roomId: string, userId: string) => {
    const res = await fetch('/api/settings/campus/room-assignments', {
      method: 'POST',
      headers: { ...(getAuthHeaders()), 'Content-Type': 'application/json' }, credentials: 'include' as const,
      body: JSON.stringify({ roomId, userId }),
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error?.message || 'Failed to assign person')
    await loadData()
  }

  const handleUnassignPerson = async (assignmentId: string) => {
    await fetch(`/api/settings/campus/room-assignments/${assignmentId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(), credentials: 'include' as const,
    })
    await loadData()
  }

  // ── Space handlers ─────────────────────────────────────────────────────────
  const handleAddSpace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!spaceForm.name.trim()) return
    setSpaceSaving(true)
    setSpaceError('')
    try {
      const res = await fetch('/api/settings/campus/spaces', {
        method: 'POST',
        headers: { ...(getAuthHeaders()), 'Content-Type': 'application/json' }, credentials: 'include' as const,
        body: JSON.stringify({ name: spaceForm.name.trim(), spaceType: spaceForm.spaceType, buildingId }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to create space')
      setSpaceDrawerOpen(false)
      setSpaceForm({ name: '', spaceType: 'OTHER' })
      await loadData()
    } catch (err) {
      setSpaceError(err instanceof Error ? err.message : 'Failed to create space')
    } finally {
      setSpaceSaving(false)
    }
  }

  const handleDeleteSpace = async (spaceId: string) => {
    await fetch(`/api/settings/campus/spaces/${spaceId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(), credentials: 'include' as const,
    })
    await loadData()
  }

  // ── Inline room edit handler ────────────────────────────────────────────────
  const openEditRoom = (r: Room) => {
    setEditingRoom(r)
    setEditRoomForm({ roomNumber: r.roomNumber, displayName: r.displayName || '', floor: r.floor || '' })
  }

  const saveInlineRoomEdit = async () => {
    if (!editingRoom || !editRoomForm.roomNumber.trim()) return
    setEditRoomSaving(true)
    try {
      await handleEditRoom(editingRoom.id, editRoomForm)
      setEditingRoom(null)
    } catch { /* parent handles */ }
    finally { setEditRoomSaving(false) }
  }

  const confirmDeleteRoom = async () => {
    if (!deleteRoomTarget) return
    setDeleteRoomLoading(true)
    try {
      await handleDeactivateRoom(deleteRoomTarget.id)
      setDeleteRoomTarget(null)
    } finally {
      setDeleteRoomLoading(false)
    }
  }

  // ── Building edit handlers ──────────────────────────────────────────────────
  const startEditing = () => {
    if (!building) return
    setEditForm({
      name: building.name,
      code: building.code || '',
      buildingType: building.buildingType,
      address: building.address || '',
    })
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
  }

  const saveBuilding = async () => {
    if (!building || !editForm.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/settings/campus/buildings/${building.id}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }, credentials: 'include' as const,
        body: JSON.stringify({
          name: editForm.name.trim(),
          code: editForm.code.trim() || null,
          buildingType: editForm.buildingType,
          address: editForm.address.trim() || null,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setEditing(false)
        await loadData()
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalItems = rooms.length + spaces.length
  const subtitle = [
    rooms.length > 0 ? `${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'}` : null,
    spaces.length > 0 ? `${spaces.length} ${spaces.length === 1 ? 'space' : 'spaces'}` : null,
  ].filter(Boolean).join(' · ') || '0 rooms'

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-slate-200 rounded mb-2" />
          <div className="h-4 w-64 bg-slate-100 rounded" />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl h-[600px] animate-pulse" />
        <div className="bg-white border border-slate-200 rounded-xl h-[120px] animate-pulse" />
      </div>
    )
  }

  if (!building) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <div className="text-sm text-slate-500">Building not found</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Building header ── */}
      {editing ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Edit Building</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={cancelEditing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors duration-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
              <button
                onClick={saveBuilding}
                disabled={saving || !editForm.name.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-full transition-colors duration-200 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Building name" size="sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Short Code</label>
              <Input value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} placeholder="e.g. ADMIN" size="sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
              <Select value={editForm.buildingType} onChange={(val) => setEditForm({ ...editForm, buildingType: val })} options={Object.entries(BUILDING_TYPE_LABELS).map(([value, label]) => ({ value, label }))} size="sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} placeholder="Street address" size="sm" />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-semibold text-slate-900">{building.name}</h2>
              <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium">
                {BUILDING_TYPE_LABELS[building.buildingType] || building.buildingType}
              </span>
              {building.code && (
                <span className="text-xs text-slate-400 font-mono">({building.code})</span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
              {building.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {building.address}
                </span>
              )}
              <span>{rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}</span>
              {spaces.length > 0 && <span>{spaces.length} {spaces.length === 1 ? 'space' : 'spaces'}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={startEditing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-full hover:border-slate-300 hover:bg-slate-50 transition-colors duration-200 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          </div>
        </div>
      )}

      {/* ── Map — full-bleed like campus detail ── */}
      {mapCenter ? (
        <InteractiveCampusMap
          buildings={mapBuildings}
          mapCenter={mapCenter}
          editable
          embedded
          campusName={building.name}
          onBuildingPositionChange={handleBuildingPositionChange}
          onManageRooms={() => setRoomsDrawerOpen(true)}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">
            Add an address to this building to see it on the map.
          </p>
        </div>
      )}

      {/* ── Rooms & Spaces card — matches "Buildings & Spaces" pattern ── */}
      <div
        className="bg-white border border-slate-200 rounded-xl overflow-hidden"
        style={{ borderLeftWidth: 4, borderLeftColor: ACCENT_COLOR }}
      >
        {/* Card header */}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((c) => !c)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setCollapsed((c) => !c)
            }
          }}
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors duration-200 cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-0"
        >
          <div
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: ACCENT_COLOR }}
          >
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">Rooms & Spaces</h3>
              <span className="text-xs text-slate-400">{subtitle}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setRoomsDrawerOpen(true)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white text-slate-700 border border-slate-200 rounded-full hover:bg-slate-50 transition-colors duration-200 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Room
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setSpaceDrawerOpen(true)
                setSpaceError('')
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white text-slate-700 border border-slate-200 rounded-full hover:bg-slate-50 transition-colors duration-200 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Space
            </button>
            {collapsed ? (
              <ChevronRight className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </div>
        </div>

        {/* Card body */}
        {!collapsed && (
          <div className="px-5 pb-5">
            {totalItems === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400">
                No rooms or spaces yet. Use the buttons above to add one.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Rooms grid */}
                {rooms.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <DoorOpen className="w-3.5 h-3.5 text-slate-400" />
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Rooms
                      </h4>
                      <span className="text-xs text-slate-400">{rooms.length}</span>
                      <button
                        onClick={() => setRoomsDrawerOpen(true)}
                        className="ml-auto text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors duration-200 cursor-pointer"
                      >
                        Manage
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {rooms.map((r) => {
                        const assigned = r.assignments?.[0]
                        const assignedName = assigned
                          ? [assigned.user.firstName, assigned.user.lastName].filter(Boolean).join(' ') || assigned.user.email
                          : null
                        const isEditing = editingRoom?.id === r.id

                        if (isEditing) {
                          return (
                            <div key={r.id} className="col-span-2 sm:col-span-3 md:col-span-4 px-4 py-3 bg-indigo-50/50 border border-indigo-200 rounded-lg space-y-3">
                              <div className="grid grid-cols-3 gap-3">
                                <Input value={editRoomForm.roomNumber} onChange={(e) => setEditRoomForm({ ...editRoomForm, roomNumber: e.target.value })} placeholder="Room #" size="sm" disabled={editRoomSaving} autoFocus />
                                <Input value={editRoomForm.displayName} onChange={(e) => setEditRoomForm({ ...editRoomForm, displayName: e.target.value })} placeholder="Name (optional)" size="sm" disabled={editRoomSaving} />
                                <Input value={editRoomForm.floor} onChange={(e) => setEditRoomForm({ ...editRoomForm, floor: e.target.value })} placeholder="Floor (optional)" size="sm" disabled={editRoomSaving} />
                              </div>
                              <div className="flex justify-end gap-2">
                                <button onClick={() => setEditingRoom(null)} disabled={editRoomSaving} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-full transition cursor-pointer">Cancel</button>
                                <button onClick={saveInlineRoomEdit} disabled={editRoomSaving || !editRoomForm.roomNumber.trim()} className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-full transition disabled:opacity-40 cursor-pointer">
                                  {editRoomSaving ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            </div>
                          )
                        }

                        return (
                          <div
                            key={r.id}
                            className="px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-lg text-sm group relative"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0">
                                <div className="font-medium text-slate-800">{r.roomNumber}</div>
                                {r.displayName && <div className="text-xs text-slate-500 truncate">{r.displayName}</div>}
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                <RowActionMenu
                                  items={[
                                    { label: 'Edit', icon: <Edit2 className="w-4 h-4" />, onClick: () => openEditRoom(r) },
                                    { label: 'Delete', icon: <Trash2 className="w-4 h-4" />, onClick: () => setDeleteRoomTarget(r), variant: 'danger' as const },
                                  ]}
                                />
                              </div>
                            </div>
                            {assigned && (
                              <div className="flex items-center gap-1.5 mt-1.5">
                                {assigned.user.avatar ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={assigned.user.avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
                                ) : (
                                  <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[8px] font-bold">
                                    {assignedName?.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className="text-xs text-slate-500 truncate">{assignedName}</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Spaces list */}
                {spaces.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <TreePine className="w-3.5 h-3.5 text-slate-400" />
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Spaces
                      </h4>
                      <span className="text-xs text-slate-400">{spaces.length}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {spaces.map((s) => (
                        <div
                          key={s.id}
                          className="px-3 py-2.5 bg-emerald-50 border border-emerald-100 rounded-lg text-sm group"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="font-medium text-slate-800 truncate">{s.name}</div>
                            <button
                              onClick={() => handleDeleteSpace(s.id)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 transition-all duration-200 cursor-pointer flex-shrink-0"
                              title="Remove space"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="text-xs text-slate-500">{SPACE_TYPE_LABELS[s.spaceType] || s.spaceType}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rooms Drawer */}
      <RoomsDrawer
        building={roomsDrawerOpen ? (building as any) : null}
        rooms={rooms}
        onClose={() => setRoomsDrawerOpen(false)}
        onAddRoom={handleAddRoom}
        onEditRoom={handleEditRoom}
        onDeactivateRoom={(id) => handleDeactivateRoom(id)}
        onRoomImagesChange={handleRoomImagesChange}
        onImageClick={(images, index) => setLightbox({ images, index })}
        onAssignPerson={handleAssignPerson}
        onUnassignPerson={handleUnassignPerson}
      />

      {/* Add Space Drawer */}
      <DetailDrawer
        isOpen={spaceDrawerOpen}
        onClose={() => { if (!spaceSaving) setSpaceDrawerOpen(false) }}
        title="Add Space"
        width="lg"
        footer={
          <div className="space-y-3">
            <button
              type="submit"
              form="add-building-space-form"
              className="w-full py-3.5 text-sm font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              disabled={spaceSaving || !spaceForm.name.trim()}
            >
              {spaceSaving ? 'Creating...' : 'Create Space'}
            </button>
            <button
              type="button"
              onClick={() => setSpaceDrawerOpen(false)}
              className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors duration-200 py-1 cursor-pointer"
              disabled={spaceSaving}
            >
              Cancel
            </button>
          </div>
        }
      >
        <form id="add-building-space-form" onSubmit={handleAddSpace} className="space-y-5">
          {spaceError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{spaceError}</div>
          )}
          <p className="text-sm text-slate-500">Add a space within this building such as a gym, courtyard, or gathering area.</p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Space name</label>
            <Input
              value={spaceForm.name}
              onChange={(e) => setSpaceForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Main Gymnasium"
              disabled={spaceSaving}
              autoFocus
              size="sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Space type</label>
            <Select
              value={spaceForm.spaceType}
              onChange={(v) => setSpaceForm((p) => ({ ...p, spaceType: v }))}
              options={SPACE_TYPE_OPTIONS}
              disabled={spaceSaving}
              size="sm"
            />
          </div>
        </form>
      </DetailDrawer>

      {/* Delete Room Confirm */}
      <ConfirmDialog
        isOpen={!!deleteRoomTarget}
        onClose={() => setDeleteRoomTarget(null)}
        onConfirm={confirmDeleteRoom}
        title="Delete Room"
        message={`Are you sure you want to delete "${deleteRoomTarget?.displayName || deleteRoomTarget?.roomNumber}"?`}
        confirmText="Delete"
        isLoading={deleteRoomLoading}
        loadingText="Deleting…"
        variant="danger"
      />

      {/* Photo Lightbox */}
      {lightbox && (
        <PhotoLightbox
          isOpen
          images={lightbox.images}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
