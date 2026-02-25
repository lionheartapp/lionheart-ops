'use client'

import { useEffect, useMemo, useState } from 'react'
import { Building2, MapPin, DoorOpen, Edit2, Save, XCircle, Trash2 } from 'lucide-react'

type CampusSubview = 'buildings' | 'areas' | 'rooms'

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
  building?: {
    id: string
    name: string
    code: string | null
  } | null
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
  building?: {
    id: string
    name: string
    code: string | null
  } | null
  area?: {
    id: string
    name: string
    areaType: string
  } | null
}

type CampusTabProps = {
  onDirtyChange?: (isDirty: boolean) => void
}

export default function CampusTab({ onDirtyChange }: CampusTabProps = {}) {
  const [activeView, setActiveView] = useState<CampusSubview>('buildings')
  const [showInactive, setShowInactive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isDeactivating, setIsDeactivating] = useState(false)
  const [confirmDeactivate, setConfirmDeactivate] = useState<{
    type: CampusSubview
    id: string
    label: string
  } | null>(null)

  const [buildings, setBuildings] = useState<Building[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [rooms, setRooms] = useState<Room[]>([])

  const [editingBuildingId, setEditingBuildingId] = useState<string | null>(null)
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null)
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)

  const [buildingForm, setBuildingForm] = useState({
    name: '',
    code: '',
    schoolDivision: 'GLOBAL',
  })

  const [areaForm, setAreaForm] = useState({
    name: '',
    areaType: 'OTHER',
    buildingId: '',
  })

  const [roomForm, setRoomForm] = useState({
    buildingId: '',
    areaId: '',
    roomNumber: '',
    displayName: '',
    floor: '',
  })

  const hasBuildingCreateDraft =
    buildingForm.name.trim().length > 0 ||
    buildingForm.code.trim().length > 0 ||
    buildingForm.schoolDivision !== 'GLOBAL'
  const hasAreaCreateDraft =
    areaForm.name.trim().length > 0 ||
    areaForm.areaType !== 'OTHER' ||
    areaForm.buildingId !== ''
  const hasRoomCreateDraft =
    roomForm.buildingId !== '' ||
    roomForm.areaId !== '' ||
    roomForm.roomNumber.trim().length > 0 ||
    roomForm.displayName.trim().length > 0 ||
    roomForm.floor.trim().length > 0
  const hasInlineEditDraft = Boolean(editingBuildingId || editingAreaId || editingRoomId)
  const hasUnsavedChanges = hasBuildingCreateDraft || hasAreaCreateDraft || hasRoomCreateDraft || hasInlineEditDraft

  useEffect(() => {
    onDirtyChange?.(hasUnsavedChanges)
  }, [hasUnsavedChanges, onDirtyChange])

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
    const orgId = typeof window !== 'undefined' ? localStorage.getItem('org-id') : null

    return {
      Authorization: token ? `Bearer ${token}` : '',
      'X-Organization-ID': orgId || '',
      'Content-Type': 'application/json',
    }
  }

  const activeBuildings = useMemo(() => buildings.filter((building) => building.isActive), [buildings])

  useEffect(() => {
    if (!successMessage) return
    const timeout = setTimeout(() => setSuccessMessage(''), 2500)
    return () => clearTimeout(timeout)
  }, [successMessage])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges])

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const query = showInactive ? '?includeInactive=true' : ''
      const [buildingsRes, areasRes, roomsRes] = await Promise.all([
        fetch(`/api/settings/campus/buildings${query}`, { headers: getAuthHeaders() }),
        fetch(`/api/settings/campus/areas${query}`, { headers: getAuthHeaders() }),
        fetch(`/api/settings/campus/rooms${query}`, { headers: getAuthHeaders() }),
      ])

      const [buildingsJson, areasJson, roomsJson] = await Promise.all([
        buildingsRes.json(),
        areasRes.json(),
        roomsRes.json(),
      ])

      if (!buildingsRes.ok || !areasRes.ok || !roomsRes.ok) {
        throw new Error(
          buildingsJson?.error?.message || areasJson?.error?.message || roomsJson?.error?.message || 'Failed to load campus data'
        )
      }

      setBuildings(buildingsJson.data || [])
      setAreas(areasJson.data || [])
      setRooms(roomsJson.data || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load campus data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [showInactive])

  const createBuilding = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    try {
      const res = await fetch('/api/settings/campus/buildings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: buildingForm.name,
          code: buildingForm.code || null,
          schoolDivision: buildingForm.schoolDivision,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message || 'Failed to create building')
      }

      setBuildingForm({ name: '', code: '', schoolDivision: 'GLOBAL' })
      setSuccessMessage('Building created')
      await loadData()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create building')
    }
  }

  const createArea = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    try {
      const res = await fetch('/api/settings/campus/areas', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: areaForm.name,
          areaType: areaForm.areaType,
          buildingId: areaForm.buildingId || null,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message || 'Failed to create area')
      }

      setAreaForm({ name: '', areaType: 'OTHER', buildingId: '' })
      setSuccessMessage('Area created')
      await loadData()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create area')
    }
  }

  const createRoom = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    try {
      const res = await fetch('/api/settings/campus/rooms', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          buildingId: roomForm.buildingId,
          areaId: roomForm.areaId || null,
          roomNumber: roomForm.roomNumber,
          displayName: roomForm.displayName || null,
          floor: roomForm.floor || null,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message || 'Failed to create room')
      }

      setRoomForm({ buildingId: '', areaId: '', roomNumber: '', displayName: '', floor: '' })
      setSuccessMessage('Room created')
      await loadData()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create room')
    }
  }

  const saveBuilding = async (building: Building) => {
    try {
      const res = await fetch(`/api/settings/campus/buildings/${building.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: building.name,
          code: building.code,
          schoolDivision: building.schoolDivision,
          isActive: building.isActive,
        }),
      })
        setSuccessMessage('Building updated')
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message || 'Failed to save building')
      }
      setEditingBuildingId(null)
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save building')
    }
  }

  const saveArea = async (area: Area) => {
    try {
      const res = await fetch(`/api/settings/campus/areas/${area.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: area.name,
          areaType: area.areaType,
          buildingId: area.buildingId,
          isActive: area.isActive,
        }),
      })
        setSuccessMessage('Area updated')
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message || 'Failed to save area')
      }
      setEditingAreaId(null)
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save area')
    }
  }

  const saveRoom = async (room: Room) => {
    try {
      const res = await fetch(`/api/settings/campus/rooms/${room.id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          buildingId: room.buildingId,
          areaId: room.areaId,
          roomNumber: room.roomNumber,
          displayName: room.displayName,
          floor: room.floor,
          isActive: room.isActive,
        }),
      })
        setSuccessMessage('Room updated')
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message || 'Failed to save room')
      }
      setEditingRoomId(null)
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save room')
    }
  }

  const deactivateEntity = async (type: CampusSubview, id: string) => {
    const endpoint = type === 'buildings' ? 'buildings' : type === 'areas' ? 'areas' : 'rooms'
    try {
      setIsDeactivating(true)
      const res = await fetch(`/api/settings/campus/${endpoint}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        throw new Error(json?.error?.message || `Failed to deactivate ${type.slice(0, -1)}`)
      }
      setSuccessMessage(`${type.slice(0, -1).charAt(0).toUpperCase()}${type.slice(0, -1).slice(1)} deactivated`)
      await loadData()
    } catch (deactivateError) {
      setError(deactivateError instanceof Error ? deactivateError.message : 'Failed to deactivate item')
    } finally {
      setIsDeactivating(false)
    }
  }

  const requestDeactivate = (type: CampusSubview, id: string, label: string) => {
    setConfirmDeactivate({ type, id, label })
  }

  const confirmDeactivateAction = async () => {
    if (!confirmDeactivate) return
    const { type, id } = confirmDeactivate
    setConfirmDeactivate(null)
    await deactivateEntity(type, id)
  }

  const renderDataSkeleton = () => (
    <div className="space-y-6 animate-pulse py-2">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pb-4 border-b border-gray-200">
        <div className="h-10 bg-gray-200 rounded" />
        <div className="h-10 bg-gray-200 rounded" />
        <div className="h-10 bg-gray-200 rounded" />
        <div className="h-10 bg-gray-200 rounded" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center py-3 border-b border-gray-200">
            <div className="h-10 bg-gray-200 rounded" />
            <div className="h-10 bg-gray-200 rounded" />
            <div className="h-10 bg-gray-200 rounded" />
            <div className="h-6 w-16 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="flex justify-end gap-2">
              <div className="h-8 w-8 bg-gray-200 rounded" />
              <div className="h-8 w-8 bg-gray-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Campus</h2>
          <p className="text-sm text-gray-600 mt-1">Manage buildings, areas, and rooms</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(event) => setShowInactive(event.target.checked)}
            className="rounded border-gray-300"
          />
          Show inactive
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveView('buildings')}
            className={`pb-3 text-sm font-medium border-b-2 ${activeView === 'buildings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <span className="inline-flex items-center gap-2"><Building2 className="w-4 h-4" /> Buildings</span>
          </button>
          <button
            onClick={() => setActiveView('areas')}
            className={`pb-3 text-sm font-medium border-b-2 ${activeView === 'areas' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <span className="inline-flex items-center gap-2"><MapPin className="w-4 h-4" /> Areas</span>
          </button>
          <button
            onClick={() => setActiveView('rooms')}
            className={`pb-3 text-sm font-medium border-b-2 ${activeView === 'rooms' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <span className="inline-flex items-center gap-2"><DoorOpen className="w-4 h-4" /> Rooms</span>
          </button>
        </nav>
      </div>

      {loading ? (
        renderDataSkeleton()
      ) : activeView === 'buildings' && (
        <div className="space-y-4">
          <form onSubmit={createBuilding} className="grid grid-cols-1 md:grid-cols-4 gap-3 pb-4 border-b border-gray-200">
            <input className="ui-input" placeholder="Building name" value={buildingForm.name} onChange={(event) => setBuildingForm((prev) => ({ ...prev, name: event.target.value }))} required />
            <input className="ui-input" placeholder="Code (optional)" value={buildingForm.code} onChange={(event) => setBuildingForm((prev) => ({ ...prev, code: event.target.value }))} />
            <select className="ui-select" value={buildingForm.schoolDivision} onChange={(event) => setBuildingForm((prev) => ({ ...prev, schoolDivision: event.target.value }))}>
              <option value="GLOBAL">Global</option>
              <option value="ELEMENTARY">Elementary</option>
              <option value="MIDDLE_SCHOOL">Middle School</option>
              <option value="HIGH_SCHOOL">High School</option>
            </select>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Building</button>
          </form>

          <div>
            {buildings.map((building) => (
              <div key={building.id} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center py-3 border-b border-gray-200">
                <input className="ui-input" disabled={editingBuildingId !== building.id} value={building.name} onChange={(event) => setBuildings((prev) => prev.map((entry) => entry.id === building.id ? { ...entry, name: event.target.value } : entry))} />
                <input className="ui-input" disabled={editingBuildingId !== building.id} value={building.code || ''} onChange={(event) => setBuildings((prev) => prev.map((entry) => entry.id === building.id ? { ...entry, code: event.target.value || null } : entry))} />
                <select className="ui-select" disabled={editingBuildingId !== building.id} value={building.schoolDivision} onChange={(event) => setBuildings((prev) => prev.map((entry) => entry.id === building.id ? { ...entry, schoolDivision: event.target.value as Building['schoolDivision'] } : entry))}>
                  <option value="GLOBAL">Global</option>
                  <option value="ELEMENTARY">Elementary</option>
                  <option value="MIDDLE_SCHOOL">Middle School</option>
                  <option value="HIGH_SCHOOL">High School</option>
                </select>
                <span className={`text-xs font-medium px-2 py-1 rounded w-fit ${building.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                  {building.isActive ? 'Active' : 'Inactive'}
                </span>
                <div className="flex items-center gap-2 md:col-span-2 justify-end">
                  {editingBuildingId === building.id ? (
                    <>
                      <button onClick={() => saveBuilding(building)} className="p-2 text-green-700 hover:bg-green-50 rounded" title="Save"><Save className="w-4 h-4" /></button>
                      <button onClick={() => { setEditingBuildingId(null); loadData() }} className="p-2 text-gray-600 hover:bg-blue-50 rounded" title="Cancel"><XCircle className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <button onClick={() => setEditingBuildingId(building.id)} className="p-2 text-gray-700 hover:bg-blue-50 rounded" title="Edit"><Edit2 className="w-4 h-4" /></button>
                  )}
                  <button onClick={() => requestDeactivate('buildings', building.id, building.name)} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Deactivate"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && activeView === 'areas' && (
        <div className="space-y-4">
          <form onSubmit={createArea} className="grid grid-cols-1 md:grid-cols-4 gap-3 pb-4 border-b border-gray-200">
            <input className="ui-input" placeholder="Area name" value={areaForm.name} onChange={(event) => setAreaForm((prev) => ({ ...prev, name: event.target.value }))} required />
            <select className="ui-select" value={areaForm.areaType} onChange={(event) => setAreaForm((prev) => ({ ...prev, areaType: event.target.value }))}>
              <option value="OTHER">Other</option>
              <option value="FIELD">Field</option>
              <option value="COURT">Court</option>
              <option value="GYM">Gym</option>
              <option value="COMMON">Common</option>
              <option value="PARKING">Parking</option>
            </select>
            <select className="ui-select" value={areaForm.buildingId} onChange={(event) => setAreaForm((prev) => ({ ...prev, buildingId: event.target.value }))}>
              <option value="">No building</option>
              {activeBuildings.map((building) => (
                <option key={building.id} value={building.id}>{building.name}</option>
              ))}
            </select>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Area</button>
          </form>

          <div>
            {areas.map((area) => (
              <div key={area.id} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center py-3 border-b border-gray-200">
                <input className="ui-input" disabled={editingAreaId !== area.id} value={area.name} onChange={(event) => setAreas((prev) => prev.map((entry) => entry.id === area.id ? { ...entry, name: event.target.value } : entry))} />
                <select className="ui-select" disabled={editingAreaId !== area.id} value={area.areaType} onChange={(event) => setAreas((prev) => prev.map((entry) => entry.id === area.id ? { ...entry, areaType: event.target.value as Area['areaType'] } : entry))}>
                  <option value="OTHER">Other</option>
                  <option value="FIELD">Field</option>
                  <option value="COURT">Court</option>
                  <option value="GYM">Gym</option>
                  <option value="COMMON">Common</option>
                  <option value="PARKING">Parking</option>
                </select>
                <select className="ui-select" disabled={editingAreaId !== area.id} value={area.buildingId || ''} onChange={(event) => setAreas((prev) => prev.map((entry) => entry.id === area.id ? { ...entry, buildingId: event.target.value || null } : entry))}>
                  <option value="">No building</option>
                  {activeBuildings.map((building) => (
                    <option key={building.id} value={building.id}>{building.name}</option>
                  ))}
                </select>
                <span className={`text-xs font-medium px-2 py-1 rounded w-fit ${area.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                  {area.isActive ? 'Active' : 'Inactive'}
                </span>
                <div className="text-xs text-gray-500 md:col-span-1">{area.building?.name || 'No building'}</div>
                <div className="flex items-center gap-2 justify-end">
                  {editingAreaId === area.id ? (
                    <>
                      <button onClick={() => saveArea(area)} className="p-2 text-green-700 hover:bg-green-50 rounded" title="Save"><Save className="w-4 h-4" /></button>
                      <button onClick={() => { setEditingAreaId(null); loadData() }} className="p-2 text-gray-600 hover:bg-blue-50 rounded" title="Cancel"><XCircle className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <button onClick={() => setEditingAreaId(area.id)} className="p-2 text-gray-700 hover:bg-blue-50 rounded" title="Edit"><Edit2 className="w-4 h-4" /></button>
                  )}
                  <button onClick={() => requestDeactivate('areas', area.id, area.name)} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Deactivate"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && activeView === 'rooms' && (
        <div className="space-y-4">
          <form onSubmit={createRoom} className="grid grid-cols-1 md:grid-cols-6 gap-3 pb-4 border-b border-gray-200">
            <select className="ui-select" value={roomForm.buildingId} onChange={(event) => setRoomForm((prev) => ({ ...prev, buildingId: event.target.value }))} required>
              <option value="">Select building</option>
              {activeBuildings.map((building) => (
                <option key={building.id} value={building.id}>{building.name}</option>
              ))}
            </select>
            <select className="ui-select" value={roomForm.areaId} onChange={(event) => setRoomForm((prev) => ({ ...prev, areaId: event.target.value }))}>
              <option value="">No area</option>
              {areas.filter((area) => area.isActive && (!roomForm.buildingId || area.buildingId === roomForm.buildingId || area.buildingId === null)).map((area) => (
                <option key={area.id} value={area.id}>{area.name}</option>
              ))}
            </select>
            <input className="ui-input" placeholder="Room number" value={roomForm.roomNumber} onChange={(event) => setRoomForm((prev) => ({ ...prev, roomNumber: event.target.value }))} required />
            <input className="ui-input" placeholder="Display name (optional)" value={roomForm.displayName} onChange={(event) => setRoomForm((prev) => ({ ...prev, displayName: event.target.value }))} />
            <input className="ui-input" placeholder="Floor (optional)" value={roomForm.floor} onChange={(event) => setRoomForm((prev) => ({ ...prev, floor: event.target.value }))} />
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Room</button>
          </form>

          <div>
            {rooms.map((room) => (
              <div key={room.id} className="grid grid-cols-1 md:grid-cols-8 gap-2 items-center py-3 border-b border-gray-200">
                <select className="ui-select" disabled={editingRoomId !== room.id} value={room.buildingId} onChange={(event) => setRooms((prev) => prev.map((entry) => entry.id === room.id ? { ...entry, buildingId: event.target.value } : entry))}>
                  {activeBuildings.map((building) => (
                    <option key={building.id} value={building.id}>{building.name}</option>
                  ))}
                </select>
                <select className="ui-select" disabled={editingRoomId !== room.id} value={room.areaId || ''} onChange={(event) => setRooms((prev) => prev.map((entry) => entry.id === room.id ? { ...entry, areaId: event.target.value || null } : entry))}>
                  <option value="">No area</option>
                  {areas.filter((area) => area.isActive && (!room.buildingId || area.buildingId === room.buildingId || area.buildingId === null)).map((area) => (
                    <option key={area.id} value={area.id}>{area.name}</option>
                  ))}
                </select>
                <input className="ui-input" disabled={editingRoomId !== room.id} value={room.roomNumber} onChange={(event) => setRooms((prev) => prev.map((entry) => entry.id === room.id ? { ...entry, roomNumber: event.target.value } : entry))} />
                <input className="ui-input" disabled={editingRoomId !== room.id} value={room.displayName || ''} onChange={(event) => setRooms((prev) => prev.map((entry) => entry.id === room.id ? { ...entry, displayName: event.target.value || null } : entry))} />
                <input className="ui-input" disabled={editingRoomId !== room.id} value={room.floor || ''} onChange={(event) => setRooms((prev) => prev.map((entry) => entry.id === room.id ? { ...entry, floor: event.target.value || null } : entry))} />
                <span className={`text-xs font-medium px-2 py-1 rounded w-fit ${room.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                  {room.isActive ? 'Active' : 'Inactive'}
                </span>
                <div className="text-xs text-gray-500">{room.building?.name || 'Unknown building'}</div>
                <div className="flex items-center gap-2 justify-end">
                  {editingRoomId === room.id ? (
                    <>
                      <button onClick={() => saveRoom(room)} className="p-2 text-green-700 hover:bg-green-50 rounded" title="Save"><Save className="w-4 h-4" /></button>
                      <button onClick={() => { setEditingRoomId(null); loadData() }} className="p-2 text-gray-600 hover:bg-blue-50 rounded" title="Cancel"><XCircle className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <button onClick={() => setEditingRoomId(room.id)} className="p-2 text-gray-700 hover:bg-blue-50 rounded" title="Edit"><Edit2 className="w-4 h-4" /></button>
                  )}
                  <button onClick={() => requestDeactivate('rooms', room.id, room.displayName || room.roomNumber)} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Deactivate"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white border border-gray-200 p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900">Confirm deactivation</h3>
            <p className="text-sm text-gray-600 mt-2">
              Deactivate <span className="font-medium text-gray-900">{confirmDeactivate.label}</span>? This hides it from active selections but keeps existing references.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmDeactivate(null)}
                disabled={isDeactivating}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-blue-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeactivateAction}
                disabled={isDeactivating}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeactivating ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
