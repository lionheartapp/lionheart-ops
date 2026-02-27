'use client'

import { useEffect, useMemo, useState } from 'react'
import { Building2, MapPin, DoorOpen, Edit2, Trash2, Plus, Save, XCircle } from 'lucide-react'
import DetailDrawer from '@/components/DetailDrawer'
import RowActionMenu from '@/components/RowActionMenu'
import CampusMap from '@/components/settings/CampusMap'

type Building = {
  id: string
  name: string
  code: string | null
  schoolDivision: 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL' | 'GLOBAL'
  sortOrder: number
  isActive: boolean
}

type Area = {
  id: string
  name: string
  areaType: 'FIELD' | 'COURT' | 'GYM' | 'COMMON' | 'PARKING' | 'OTHER'
  buildingId: string | null
  sortOrder: number
  isActive: boolean
  building?: { id: string; name: string; code: string | null } | null
}

type Room = {
  id: string
  buildingId: string
  areaId: string | null
  roomNumber: string
  displayName: string | null
  floor: string | null
  sortOrder: number
  isActive: boolean
  building?: { id: string; name: string; code: string | null } | null
  area?: { id: string; name: string; areaType: string } | null
}

type CampusTabProps = {
  onDirtyChange?: (isDirty: boolean) => void
}

const DIVISION_LABELS: Record<string, string> = {
  GLOBAL: 'Global',
  ELEMENTARY: 'Elementary',
  MIDDLE_SCHOOL: 'Middle School',
  HIGH_SCHOOL: 'High School',
}

const OUTDOOR_TYPE_LABELS: Record<string, string> = {
  FIELD: 'Athletic Field',
  COURT: 'Court',
  GYM: 'Gymnasium',
  COMMON: 'Gathering Area',
  PARKING: 'Parking',
  OTHER: 'Other',
}

export default function CampusTab({ onDirtyChange }: CampusTabProps = {}) {
  // ─── Data ────────────────────────────────────────────────────────────────
  const [buildings, setBuildings] = useState<Building[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)

  // ─── Building drawer (add / edit) ────────────────────────────────────────
  const [buildingDrawerOpen, setBuildingDrawerOpen] = useState(false)
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null)
  const [buildingForm, setBuildingForm] = useState({ name: '', code: '', schoolDivision: 'GLOBAL' })
  const [buildingFormError, setBuildingFormError] = useState('')
  const [buildingFormSaving, setBuildingFormSaving] = useState(false)

  // ─── Outdoor space drawer (add / edit) ───────────────────────────────────
  const [outdoorDrawerOpen, setOutdoorDrawerOpen] = useState(false)
  const [editingOutdoor, setEditingOutdoor] = useState<Area | null>(null)
  const [outdoorForm, setOutdoorForm] = useState({ name: '', areaType: 'FIELD' })
  const [outdoorFormError, setOutdoorFormError] = useState('')
  const [outdoorFormSaving, setOutdoorFormSaving] = useState(false)

  // ─── Rooms drawer (per-building) — inline add + inline edit ──────────────
  const [roomsBuilding, setRoomsBuilding] = useState<Building | null>(null)
  // inline add form
  const [addRoomForm, setAddRoomForm] = useState({ roomNumber: '', displayName: '', floor: '' })
  const [addRoomError, setAddRoomError] = useState('')
  const [addRoomSaving, setAddRoomSaving] = useState(false)
  // inline row edit
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [editRoomData, setEditRoomData] = useState({ roomNumber: '', displayName: '', floor: '' })
  const [editRoomError, setEditRoomError] = useState('')
  const [editRoomSaving, setEditRoomSaving] = useState(false)

  // ─── Deactivate confirm ───────────────────────────────────────────────────
  const [confirmDeactivate, setConfirmDeactivate] = useState<{
    endpoint: string
    id: string
    label: string
  } | null>(null)
  const [isDeactivating, setIsDeactivating] = useState(false)

  // ─── Feedback ────────────────────────────────────────────────────────────
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // ─── Computed ────────────────────────────────────────────────────────────
  const outdoorSpaces = useMemo(() => areas.filter((a) => a.buildingId === null), [areas])
  const buildingRooms = useMemo(
    () => (roomsBuilding ? rooms.filter((r) => r.buildingId === roomsBuilding.id) : []),
    [rooms, roomsBuilding],
  )

  const hasUnsavedChanges = Boolean(
    (buildingDrawerOpen && (buildingForm.name.trim().length > 0 || buildingForm.code.trim().length > 0)) ||
      (outdoorDrawerOpen && outdoorForm.name.trim().length > 0) ||
      addRoomForm.roomNumber.trim().length > 0 ||
      editingRoomId !== null,
  )

  useEffect(() => {
    onDirtyChange?.(hasUnsavedChanges)
  }, [hasUnsavedChanges, onDirtyChange])

  useEffect(() => {
    if (!successMessage) return
    const t = setTimeout(() => setSuccessMessage(''), 2500)
    return () => clearTimeout(t)
  }, [successMessage])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  // ─── Auth helpers ─────────────────────────────────────────────────────────
  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
    const orgId = typeof window !== 'undefined' ? localStorage.getItem('org-id') : null
    return {
      Authorization: token ? `Bearer ${token}` : '',
      'X-Organization-ID': orgId || '',
      'Content-Type': 'application/json',
    }
  }

  // ─── Data loading ─────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/settings/campus', { headers: getAuthHeaders() })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to load campus data')
      setBuildings(json.data.buildings || [])
      setAreas(json.data.areas || [])
      setRooms(json.data.rooms || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campus data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Building CRUD ────────────────────────────────────────────────────────
  const openAddBuilding = () => {
    setEditingBuilding(null)
    setBuildingForm({ name: '', code: '', schoolDivision: 'GLOBAL' })
    setBuildingFormError('')
    setBuildingDrawerOpen(true)
  }

  const openEditBuilding = (b: Building) => {
    setEditingBuilding(b)
    setBuildingForm({ name: b.name, code: b.code || '', schoolDivision: b.schoolDivision })
    setBuildingFormError('')
    setBuildingDrawerOpen(true)
  }

  const closeBuildingDrawer = () => {
    if (buildingFormSaving) return
    setBuildingDrawerOpen(false)
    setEditingBuilding(null)
  }

  const saveBuildingForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setBuildingFormError('')
    const name = buildingForm.name.trim()
    if (!name) { setBuildingFormError('Building name is required'); return }

    setBuildingFormSaving(true)
    try {
      const url = editingBuilding
        ? `/api/settings/campus/buildings/${editingBuilding.id}`
        : '/api/settings/campus/buildings'
      const res = await fetch(url, {
        method: editingBuilding ? 'PATCH' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, code: buildingForm.code || null, schoolDivision: buildingForm.schoolDivision }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to save building')
      setBuildingDrawerOpen(false)
      setEditingBuilding(null)
      setSuccessMessage(editingBuilding ? 'Building updated' : 'Building added')
      await loadData()
    } catch (e) {
      setBuildingFormError(e instanceof Error ? e.message : 'Failed to save building')
    } finally {
      setBuildingFormSaving(false)
    }
  }

  // ─── Outdoor Space CRUD ───────────────────────────────────────────────────
  const openAddOutdoor = () => {
    setEditingOutdoor(null)
    setOutdoorForm({ name: '', areaType: 'FIELD' })
    setOutdoorFormError('')
    setOutdoorDrawerOpen(true)
  }

  const openEditOutdoor = (a: Area) => {
    setEditingOutdoor(a)
    setOutdoorForm({ name: a.name, areaType: a.areaType })
    setOutdoorFormError('')
    setOutdoorDrawerOpen(true)
  }

  const closeOutdoorDrawer = () => {
    if (outdoorFormSaving) return
    setOutdoorDrawerOpen(false)
    setEditingOutdoor(null)
  }

  const saveOutdoorForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setOutdoorFormError('')
    const name = outdoorForm.name.trim()
    if (!name) { setOutdoorFormError('Name is required'); return }

    setOutdoorFormSaving(true)
    try {
      const url = editingOutdoor
        ? `/api/settings/campus/areas/${editingOutdoor.id}`
        : '/api/settings/campus/areas'
      const res = await fetch(url, {
        method: editingOutdoor ? 'PATCH' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name, areaType: outdoorForm.areaType, buildingId: null }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to save outdoor space')
      setOutdoorDrawerOpen(false)
      setEditingOutdoor(null)
      setSuccessMessage(editingOutdoor ? 'Outdoor space updated' : 'Outdoor space added')
      await loadData()
    } catch (e) {
      setOutdoorFormError(e instanceof Error ? e.message : 'Failed to save outdoor space')
    } finally {
      setOutdoorFormSaving(false)
    }
  }

  // ─── Rooms (per-building, inline) ────────────────────────────────────────
  const openRoomsDrawer = (b: Building) => {
    setRoomsBuilding(b)
    setAddRoomForm({ roomNumber: '', displayName: '', floor: '' })
    setAddRoomError('')
    setEditingRoomId(null)
  }

  const closeRoomsDrawer = () => {
    if (addRoomSaving || editRoomSaving) return
    setRoomsBuilding(null)
    setEditingRoomId(null)
    setAddRoomForm({ roomNumber: '', displayName: '', floor: '' })
  }

  const addRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddRoomError('')
    const roomNumber = addRoomForm.roomNumber.trim()
    if (!roomNumber) { setAddRoomError('Room number is required'); return }
    if (!roomsBuilding) return

    setAddRoomSaving(true)
    try {
      const res = await fetch('/api/settings/campus/rooms', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          buildingId: roomsBuilding.id,
          roomNumber,
          displayName: addRoomForm.displayName.trim() || null,
          floor: addRoomForm.floor.trim() || null,
          areaId: null,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to add room')
      setAddRoomForm({ roomNumber: '', displayName: '', floor: '' })
      setAddRoomError('')
      await loadData()
    } catch (e) {
      setAddRoomError(e instanceof Error ? e.message : 'Failed to add room')
    } finally {
      setAddRoomSaving(false)
    }
  }

  const startEditRoom = (r: Room) => {
    setEditingRoomId(r.id)
    setEditRoomData({ roomNumber: r.roomNumber, displayName: r.displayName || '', floor: r.floor || '' })
    setEditRoomError('')
  }

  const cancelEditRoom = () => {
    setEditingRoomId(null)
    setEditRoomError('')
  }

  const saveEditRoom = async (roomId: string) => {
    setEditRoomError('')
    const roomNumber = editRoomData.roomNumber.trim()
    if (!roomNumber) { setEditRoomError('Room number is required'); return }

    setEditRoomSaving(true)
    try {
      const res = await fetch(`/api/settings/campus/rooms/${roomId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          roomNumber,
          displayName: editRoomData.displayName.trim() || null,
          floor: editRoomData.floor.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to save room')
      setEditingRoomId(null)
      await loadData()
    } catch (e) {
      setEditRoomError(e instanceof Error ? e.message : 'Failed to save room')
    } finally {
      setEditRoomSaving(false)
    }
  }

  // ─── Deactivate ───────────────────────────────────────────────────────────
  const requestDeactivate = (endpoint: string, id: string, label: string) => {
    setConfirmDeactivate({ endpoint, id, label })
  }

  const confirmDeactivateAction = async () => {
    if (!confirmDeactivate) return
    setIsDeactivating(true)
    try {
      const res = await fetch(`/api/settings/campus/${confirmDeactivate.endpoint}/${confirmDeactivate.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to deactivate')
      setSuccessMessage('Deactivated successfully')
      setConfirmDeactivate(null)
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to deactivate')
      setConfirmDeactivate(null)
    } finally {
      setIsDeactivating(false)
    }
  }

  // ─── Render helpers ───────────────────────────────────────────────────────
  const renderStatusBadge = (isActive: boolean) => (
    <span className={`text-xs font-medium px-2 py-1 rounded-full ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )

  const renderSkeleton = () => (
    <div className="bg-white rounded-xl border border-gray-200 animate-pulse p-4 space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2">
          <div className="h-4 w-40 bg-gray-200 rounded" />
          <div className="h-4 w-24 bg-gray-200 rounded" />
          <div className="h-4 w-16 bg-gray-200 rounded" />
          <div className="h-4 w-12 bg-gray-200 rounded flex-1" />
        </div>
      ))}
    </div>
  )

  const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400'
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">

      {/* Page header */}
      <div>
        <h2 className="flex items-center gap-3 text-2xl font-semibold text-gray-900">
          <Building2 className="w-6 h-6 text-blue-600" />
          Campus
        </h2>
        <p className="text-sm text-gray-600 mt-1">Manage buildings, outdoor spaces, and rooms</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{successMessage}</div>
      )}

      {/* ── Campus Map ────────────────────────────────────────────────────── */}
      <CampusMap />

      {/* ── Buildings ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Buildings</h3>
            <p className="text-sm text-gray-500 mt-0.5">Physical structures on campus</p>
          </div>
          <button
            onClick={openAddBuilding}
            className="flex items-center gap-2 px-4 py-2 min-h-[36px] text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Building
          </button>
        </div>

        {loading ? renderSkeleton() : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            {buildings.length === 0 ? (
              <div className="text-center py-14 text-gray-400">
                <Building2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="text-sm mb-2">No buildings yet.</p>
                <button onClick={openAddBuilding} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Add your first building
                </button>
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b bg-gray-50">
                    <th className="py-3 px-4 text-left font-medium">Building</th>
                    <th className="py-3 px-4 text-left font-medium">Division</th>
                    <th className="py-3 px-4 text-left font-medium">Rooms</th>
                    <th className="py-3 px-4 text-left font-medium">Status</th>
                    <th className="py-3 pl-4 pr-10 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {buildings.map((b) => {
                    const roomCount = rooms.filter((r) => r.buildingId === b.id).length
                    return (
                      <tr key={b.id} className="border-b last:border-b-0 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900">{b.name}</div>
                          {b.code && <div className="text-xs text-gray-400 mt-0.5">{b.code}</div>}
                        </td>
                        <td className="py-3 px-4 text-gray-600">{DIVISION_LABELS[b.schoolDivision] || b.schoolDivision}</td>
                        <td className="py-3 px-4 text-gray-500">{roomCount}</td>
                        <td className="py-3 px-4">{renderStatusBadge(b.isActive)}</td>
                        <td className="py-3 pl-4 pr-10">
                          <div className="flex justify-end">
                            <RowActionMenu
                              items={[
                                {
                                  label: 'Manage Rooms',
                                  icon: <DoorOpen className="w-4 h-4" />,
                                  onClick: () => openRoomsDrawer(b),
                                },
                                {
                                  label: 'Edit',
                                  icon: <Edit2 className="w-4 h-4" />,
                                  onClick: () => openEditBuilding(b),
                                },
                                {
                                  label: 'Deactivate',
                                  icon: <Trash2 className="w-4 h-4" />,
                                  onClick: () => requestDeactivate('buildings', b.id, b.name),
                                  variant: 'danger',
                                },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── Outdoor Spaces ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Outdoor Spaces</h3>
            <p className="text-sm text-gray-500 mt-0.5">Fields, courts, gathering areas, and other outdoor locations</p>
          </div>
          <button
            onClick={openAddOutdoor}
            className="flex items-center gap-2 px-4 py-2 min-h-[36px] text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add Outdoor Space
          </button>
        </div>

        {loading ? renderSkeleton() : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            {outdoorSpaces.length === 0 ? (
              <div className="text-center py-14 text-gray-400">
                <MapPin className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="text-sm mb-2">No outdoor spaces yet.</p>
                <button onClick={openAddOutdoor} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  Add your first outdoor space
                </button>
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b bg-gray-50">
                    <th className="py-3 px-4 text-left font-medium">Space</th>
                    <th className="py-3 px-4 text-left font-medium">Type</th>
                    <th className="py-3 px-4 text-left font-medium">Status</th>
                    <th className="py-3 pl-4 pr-10 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {outdoorSpaces.map((a) => (
                    <tr key={a.id} className="border-b last:border-b-0 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">{a.name}</td>
                      <td className="py-3 px-4 text-gray-600">{OUTDOOR_TYPE_LABELS[a.areaType] || a.areaType}</td>
                      <td className="py-3 px-4">{renderStatusBadge(a.isActive)}</td>
                      <td className="py-3 pl-4 pr-10">
                        <div className="flex justify-end">
                          <RowActionMenu
                            items={[
                              {
                                label: 'Edit',
                                icon: <Edit2 className="w-4 h-4" />,
                                onClick: () => openEditOutdoor(a),
                              },
                              {
                                label: 'Deactivate',
                                icon: <Trash2 className="w-4 h-4" />,
                                onClick: () => requestDeactivate('areas', a.id, a.name),
                                variant: 'danger',
                              },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── Building Drawer ───────────────────────────────────────────────── */}
      <DetailDrawer
        isOpen={buildingDrawerOpen}
        onClose={closeBuildingDrawer}
        title={editingBuilding ? `Edit ${editingBuilding.name}` : 'Add Building'}
        width="lg"
      >
        <form onSubmit={saveBuildingForm} className="p-8 space-y-6">
          {buildingFormError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{buildingFormError}</div>
          )}
          <section className="space-y-4">
            <div className="border-b border-gray-200 pb-3">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Building Details</h3>
            </div>
            <div>
              <label className={labelClass}>Building name</label>
              <input
                value={buildingForm.name}
                onChange={(e) => setBuildingForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Main Building, Science Hall, Gymnasium"
                className={inputClass}
                disabled={buildingFormSaving}
                autoFocus
                required
              />
            </div>
            <div>
              <label className={labelClass}>Short code <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                value={buildingForm.code}
                onChange={(e) => setBuildingForm((p) => ({ ...p, code: e.target.value }))}
                placeholder="e.g. SH, GYM, ADMIN"
                className={inputClass}
                disabled={buildingFormSaving}
              />
            </div>
            <div>
              <label className={labelClass}>School division</label>
              <select
                value={buildingForm.schoolDivision}
                onChange={(e) => setBuildingForm((p) => ({ ...p, schoolDivision: e.target.value }))}
                className={inputClass}
                disabled={buildingFormSaving}
              >
                <option value="GLOBAL">Global (all divisions)</option>
                <option value="ELEMENTARY">Elementary</option>
                <option value="MIDDLE_SCHOOL">Middle School</option>
                <option value="HIGH_SCHOOL">High School</option>
              </select>
            </div>
          </section>
          <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-4">
            <button type="button" onClick={closeBuildingDrawer} className="px-4 py-2 min-h-[40px] border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition" disabled={buildingFormSaving}>Cancel</button>
            <button type="submit" className="px-4 py-2 min-h-[40px] bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed" disabled={buildingFormSaving}>
              {buildingFormSaving ? 'Saving...' : editingBuilding ? 'Save Changes' : 'Add Building'}
            </button>
          </div>
        </form>
      </DetailDrawer>

      {/* ── Outdoor Space Drawer ──────────────────────────────────────────── */}
      <DetailDrawer
        isOpen={outdoorDrawerOpen}
        onClose={closeOutdoorDrawer}
        title={editingOutdoor ? `Edit ${editingOutdoor.name}` : 'Add Outdoor Space'}
        width="lg"
      >
        <form onSubmit={saveOutdoorForm} className="p-8 space-y-6">
          {outdoorFormError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{outdoorFormError}</div>
          )}
          <section className="space-y-4">
            <div className="border-b border-gray-200 pb-3">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Space Details</h3>
              <p className="mt-1 text-sm text-gray-500">Name it the way your staff and students already know it.</p>
            </div>
            <div>
              <label className={labelClass}>Name</label>
              <input
                value={outdoorForm.name}
                onChange={(e) => setOutdoorForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Football Field, The Hub, Softball Diamond"
                className={inputClass}
                disabled={outdoorFormSaving}
                autoFocus
                required
              />
            </div>
            <div>
              <label className={labelClass}>Type</label>
              <select
                value={outdoorForm.areaType}
                onChange={(e) => setOutdoorForm((p) => ({ ...p, areaType: e.target.value }))}
                className={inputClass}
                disabled={outdoorFormSaving}
              >
                <option value="FIELD">Athletic Field</option>
                <option value="COURT">Court</option>
                <option value="GYM">Gymnasium</option>
                <option value="COMMON">Gathering Area</option>
                <option value="PARKING">Parking</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </section>
          <div className="flex items-center justify-end gap-2 border-t border-gray-200 pt-4">
            <button type="button" onClick={closeOutdoorDrawer} className="px-4 py-2 min-h-[40px] border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition" disabled={outdoorFormSaving}>Cancel</button>
            <button type="submit" className="px-4 py-2 min-h-[40px] bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed" disabled={outdoorFormSaving}>
              {outdoorFormSaving ? 'Saving...' : editingOutdoor ? 'Save Changes' : 'Add Space'}
            </button>
          </div>
        </form>
      </DetailDrawer>

      {/* ── Rooms Drawer (per building) ───────────────────────────────────── */}
      <DetailDrawer
        isOpen={roomsBuilding !== null}
        onClose={closeRoomsDrawer}
        title={roomsBuilding ? `${roomsBuilding.name} — Rooms` : 'Rooms'}
        width="lg"
      >
        <div className="p-8 space-y-6">

          {/* Inline add form — always visible */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-4">
            <p className="text-sm font-semibold text-gray-700">Add a room</p>
            {addRoomError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{addRoomError}</div>
            )}
            <form onSubmit={addRoom} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600">Room # / ID</label>
                  <input
                    value={addRoomForm.roomNumber}
                    onChange={(e) => setAddRoomForm((p) => ({ ...p, roomNumber: e.target.value }))}
                    placeholder="e.g. 101, Lab A"
                    className={inputClass}
                    disabled={addRoomSaving}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600">Name <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    value={addRoomForm.displayName}
                    onChange={(e) => setAddRoomForm((p) => ({ ...p, displayName: e.target.value }))}
                    placeholder="e.g. Chemistry Lab"
                    className={inputClass}
                    disabled={addRoomSaving}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-gray-600">Floor <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    value={addRoomForm.floor}
                    onChange={(e) => setAddRoomForm((p) => ({ ...p, floor: e.target.value }))}
                    placeholder="e.g. 1, Ground"
                    className={inputClass}
                    disabled={addRoomSaving}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2 min-h-[38px] bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={addRoomSaving}
                >
                  <Plus className="w-4 h-4" />
                  {addRoomSaving ? 'Adding...' : 'Add Room'}
                </button>
              </div>
            </form>
          </div>

          {/* Existing rooms list */}
          {editRoomError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{editRoomError}</div>
          )}

          {buildingRooms.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <DoorOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No rooms yet — add one above.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b bg-gray-50">
                    <th className="py-3 px-4 text-left font-medium">Room</th>
                    <th className="py-3 px-4 text-left font-medium">Display name</th>
                    <th className="py-3 px-4 text-left font-medium">Floor</th>
                    <th className="py-3 px-4 text-left font-medium">Status</th>
                    <th className="py-3 pl-4 pr-10 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {buildingRooms.map((r) => (
                    editingRoomId === r.id ? (
                      /* ── Inline edit row ── */
                      <tr key={r.id} className="border-b last:border-b-0 bg-blue-50">
                        <td className="py-2 px-4">
                          <input
                            value={editRoomData.roomNumber}
                            onChange={(e) => setEditRoomData((p) => ({ ...p, roomNumber: e.target.value }))}
                            className="w-full rounded-lg border border-blue-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={editRoomSaving}
                            autoFocus
                          />
                        </td>
                        <td className="py-2 px-4">
                          <input
                            value={editRoomData.displayName}
                            onChange={(e) => setEditRoomData((p) => ({ ...p, displayName: e.target.value }))}
                            placeholder="optional"
                            className="w-full rounded-lg border border-blue-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={editRoomSaving}
                          />
                        </td>
                        <td className="py-2 px-4">
                          <input
                            value={editRoomData.floor}
                            onChange={(e) => setEditRoomData((p) => ({ ...p, floor: e.target.value }))}
                            placeholder="optional"
                            className="w-full rounded-lg border border-blue-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={editRoomSaving}
                          />
                        </td>
                        <td className="py-2 px-4">{renderStatusBadge(r.isActive)}</td>
                        <td className="py-2 pl-4 pr-10">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => saveEditRoom(r.id)}
                              disabled={editRoomSaving}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-full transition disabled:opacity-40"
                              title="Save"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEditRoom}
                              disabled={editRoomSaving}
                              className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition"
                              title="Cancel"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      /* ── Normal row ── */
                      <tr key={r.id} className="border-b last:border-b-0 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">{r.roomNumber}</td>
                        <td className="py-3 px-4 text-gray-600">{r.displayName || <span className="text-gray-300">—</span>}</td>
                        <td className="py-3 px-4 text-gray-600">{r.floor || <span className="text-gray-300">—</span>}</td>
                        <td className="py-3 px-4">{renderStatusBadge(r.isActive)}</td>
                        <td className="py-3 pl-4 pr-10">
                          <div className="flex justify-end">
                            <RowActionMenu
                              items={[
                                {
                                  label: 'Edit',
                                  icon: <Edit2 className="w-4 h-4" />,
                                  onClick: () => startEditRoom(r),
                                },
                                {
                                  label: 'Deactivate',
                                  icon: <Trash2 className="w-4 h-4" />,
                                  onClick: () => requestDeactivate('rooms', r.id, r.displayName || r.roomNumber),
                                  variant: 'danger',
                                },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DetailDrawer>

      {/* ── Deactivate Confirm ────────────────────────────────────────────── */}
      {confirmDeactivate && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-lg bg-white border border-gray-200 p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">Confirm deactivation</h3>
            <p className="text-sm text-gray-600 mt-2">
              Deactivate <span className="font-medium text-gray-900">{confirmDeactivate.label}</span>? This hides it from active selections but keeps existing references intact.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setConfirmDeactivate(null)} disabled={isDeactivating} className="px-4 py-2 min-h-[40px] rounded-lg border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50">Cancel</button>
              <button onClick={confirmDeactivateAction} disabled={isDeactivating} className="px-4 py-2 min-h-[40px] rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition disabled:opacity-50">
                {isDeactivating ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
