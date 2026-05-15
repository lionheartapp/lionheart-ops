'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, ChevronDown, ChevronRight, DoorOpen, MapPin, Pencil, Plus, X, Check } from 'lucide-react'
import { getAuthHeaders } from '@/lib/api-client'
import InteractiveCampusMap from '@/components/settings/InteractiveCampusMap'
import RoomsDrawer from '@/components/settings/campus/RoomsDrawer'
import PhotoLightbox from '@/components/settings/PhotoLightbox'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
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

const ROOM_ACCENT_COLOR = '#6366f1'

// ─── Component ────────────────────────────────────────────────────────────────

export default function DistrictBuildingDetail({ buildingId }: DistrictBuildingDetailProps) {
  const [building, setBuilding] = useState<BuildingDetail | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [roomsDrawerOpen, setRoomsDrawerOpen] = useState(false)
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', code: '', buildingType: 'GENERAL', address: '' })
  const [saving, setSaving] = useState(false)
  const [roomsCollapsed, setRoomsCollapsed] = useState(false)

  // ── Load building + rooms ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [bRes, rRes] = await Promise.all([
        fetch(`/api/settings/campus/buildings/${buildingId}`, { headers: getAuthHeaders(), credentials: 'include' }),
        fetch(`/api/settings/campus/rooms?buildingId=${buildingId}`, { headers: getAuthHeaders(), credentials: 'include' }),
      ])
      const bData = await bRes.json()
      const rData = await rRes.json()
      if (bData.ok) setBuilding(bData.data)
      if (rData.ok) setRooms(Array.isArray(rData.data) ? rData.data : rData.data?.rooms ?? [])
    } catch {
      // silent — building was already validated by parent
    } finally {
      setLoading(false)
    }
  }, [buildingId])

  useEffect(() => { loadData() }, [loadData])

  // ── Map center from building coords ────────────────────────────────────────
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
      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
        <div style={{ height: 600 }}>
          <InteractiveCampusMap
            buildings={mapBuildings}
            mapCenter={mapCenter}
            editable
            embedded
            fillContainer
            campusName={building.name}
            onBuildingPositionChange={handleBuildingPositionChange}
            onManageRooms={() => setRoomsDrawerOpen(true)}
          />
        </div>
      </div>

      {/* ── Rooms & Spaces card — matches "Buildings & Spaces" pattern ── */}
      <div
        className="bg-white border border-slate-200 rounded-xl overflow-hidden"
        style={{ borderLeftWidth: 4, borderLeftColor: ROOM_ACCENT_COLOR }}
      >
        {/* Card header */}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={!roomsCollapsed}
          onClick={() => setRoomsCollapsed((c) => !c)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setRoomsCollapsed((c) => !c)
            }
          }}
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors duration-200 cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-0"
        >
          <div
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: ROOM_ACCENT_COLOR }}
          >
            <DoorOpen className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">Rooms & Spaces</h3>
              <span className="text-xs text-slate-400">
                {rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}
              </span>
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
                setRoomsDrawerOpen(true)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition-colors duration-200 cursor-pointer"
            >
              Manage
            </button>
            {roomsCollapsed ? (
              <ChevronRight className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </div>
        </div>

        {/* Card body */}
        {!roomsCollapsed && (
          <div className="px-5 pb-5">
            {rooms.length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400">
                No rooms yet. Use the buttons above to add one.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {rooms.map((r) => {
                  const assigned = r.assignments?.[0]
                  const assignedName = assigned
                    ? [assigned.user.firstName, assigned.user.lastName].filter(Boolean).join(' ') || assigned.user.email
                    : null
                  return (
                    <div
                      key={r.id}
                      className="px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-lg text-sm"
                    >
                      <div className="font-medium text-slate-800">{r.roomNumber}</div>
                      {r.displayName && <div className="text-xs text-slate-500 truncate">{r.displayName}</div>}
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
