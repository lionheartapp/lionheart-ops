'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Building2, MapPin, DoorOpen, Edit2, Trash2, Plus, Save, XCircle, Camera } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import DetailDrawer from '@/components/DetailDrawer'
import RowActionMenu from '@/components/RowActionMenu'
import ConfirmDialog from '@/components/ConfirmDialog'
import InteractiveCampusMap from '@/components/settings/InteractiveCampusMap'
import ImageUpload from '@/components/settings/ImageUpload'
import PhotoLightbox from '@/components/settings/PhotoLightbox'
import AddressAutocomplete from '@/components/AddressAutocomplete'

type Building = {
  id: string
  name: string
  code: string | null
  latitude: number | null
  longitude: number | null
  schoolDivision: 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL' | 'GLOBAL'
  buildingType: 'GENERAL' | 'ARTS_CULTURE' | 'ATHLETICS' | 'ADMINISTRATION' | 'SUPPORT_SERVICES'
  images: string[] | null
  sortOrder: number
  isActive: boolean
}

type Area = {
  id: string
  name: string
  areaType: 'FIELD' | 'COURT' | 'GYM' | 'COMMON' | 'PARKING' | 'OTHER'
  buildingId: string | null
  images: string[] | null
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
  images: string[] | null
  sortOrder: number
  isActive: boolean
  building?: { id: string; name: string; code: string | null } | null
  area?: { id: string; name: string; areaType: string } | null
}

type CampusTabProps = {
  onDirtyChange?: (isDirty: boolean) => void
}

type Campus = {
  id: string
  name: string
  campusType: 'HEADQUARTERS' | 'CAMPUS' | 'SATELLITE'
  address: string | null
}

const DIVISION_LABELS: Record<string, string> = {
  GLOBAL: 'Global',
  ELEMENTARY: 'Elementary',
  MIDDLE_SCHOOL: 'Middle School',
  HIGH_SCHOOL: 'High School',
}

const DIVISION_ORDER = ['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL', 'GLOBAL'] as const
const DIVISION_COLORS: Record<string, string> = {
  ELEMENTARY: '#7c3aed',
  MIDDLE_SCHOOL: '#0891b2',
  HIGH_SCHOOL: '#dc2626',
  GLOBAL: '#2563eb',
}
const DIVISION_BG_CLASSES: Record<string, string> = {
  ELEMENTARY: 'bg-purple-50',
  MIDDLE_SCHOOL: 'bg-cyan-50',
  HIGH_SCHOOL: 'bg-red-50',
  GLOBAL: 'bg-blue-50',
}

const BUILDING_TYPE_LABELS: Record<string, string> = {
  GENERAL: 'General',
  ARTS_CULTURE: 'Arts & Culture',
  ATHLETICS: 'Athletics',
  ADMINISTRATION: 'Administration',
  SUPPORT_SERVICES: 'Support Services',
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
  // ─── Campus Selection ────────────────────────────────────────────────────
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(null)
  const [campusesLoading, setCampusesLoading] = useState(true)
  const [showAddCampusModal, setShowAddCampusModal] = useState(false)
  const [addCampusForm, setAddCampusForm] = useState({ name: '', address: '', campusType: 'CAMPUS' })
  const [addCampusError, setAddCampusError] = useState('')
  const [addCampusSaving, setAddCampusSaving] = useState(false)

  // ─── Data ────────────────────────────────────────────────────────────────
  const [buildings, setBuildings] = useState<Building[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)

  // ─── Building drawer (add / edit) ────────────────────────────────────────
  const [buildingDrawerOpen, setBuildingDrawerOpen] = useState(false)
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null)
  const [buildingForm, setBuildingForm] = useState({ name: '', code: '', schoolDivision: 'GLOBAL', buildingType: 'GENERAL' })
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
  const [roomImagesId, setRoomImagesId] = useState<string | null>(null) // show image upload for this room

  // ─── Delete/Deactivate confirm ────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'building' | 'outdoor' | 'room'
    id: string
    name: string
    roomCount: number
    ticketCount: number
    action: 'delete' | 'deactivate'
  } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // ─── Map building placement ──────────────────────────────────────────────
  const [pendingBuildingCoords, setPendingBuildingCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [pendingOutdoorCoords, setPendingOutdoorCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [pendingMarkerData, setPendingMarkerData] = useState<{
    lat: number; lng: number; label: string; type: 'building' | 'outdoor'
  } | null>(null)
  const [lastCreatedBuilding, setLastCreatedBuilding] = useState<Building | null>(null)
  const [placeOnMapBuilding, setPlaceOnMapBuilding] = useState<Building | null>(null)
  const [placingExistingBuilding, setPlacingExistingBuilding] = useState<Building | null>(null)
  const [selectedMapBuildingId, setSelectedMapBuildingId] = useState<string | null>(null)
  const [outdoorMapSpaces, setOutdoorMapSpaces] = useState<any[]>([])

  // ─── Photo lightbox ─────────────────────────────────────────────────────
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const openLightbox = (images: string[], index: number) => {
    setLightboxImages(images)
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  // ─── Feedback ────────────────────────────────────────────────────────────
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // ─── Computed ────────────────────────────────────────────────────────────
  const outdoorSpaces = useMemo(() => areas.filter((a) => a.buildingId === null), [areas])
  const buildingRooms = useMemo(
    () => (roomsBuilding ? rooms.filter((r) => r.buildingId === roomsBuilding.id) : []),
    [rooms, roomsBuilding],
  )
  const groupedBuildings = useMemo(() => {
    return DIVISION_ORDER
      .map(div => ({ division: div, buildings: buildings.filter(b => b.schoolDivision === div) }))
      .filter(g => g.buildings.length > 0)
  }, [buildings])

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
    const delay = lastCreatedBuilding ? 6000 : 2500
    const t = setTimeout(() => {
      setSuccessMessage('')
      setLastCreatedBuilding(null)
    }, delay)
    return () => clearTimeout(t)
  }, [successMessage, lastCreatedBuilding])

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

  // ─── Load campuses on mount ───────────────────────────────────────────────
  const loadCampuses = async () => {
    setCampusesLoading(true)
    try {
      const res = await fetch('/api/settings/campus/campuses', { headers: getAuthHeaders() })
      if (handleAuthResponse(res)) return
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to load campuses')
      const campusList = json.data || []
      setCampuses(campusList)
      // Set selectedCampusId to first campus (HQ) if available
      if (campusList.length > 0 && !selectedCampusId) {
        setSelectedCampusId(campusList[0].id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campuses')
    } finally {
      setCampusesLoading(false)
    }
  }

  // ─── Data loading ─────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const campusQuery = selectedCampusId ? `?campusId=${selectedCampusId}` : ''
      const [campusRes, mapRes] = await Promise.all([
        fetch(`/api/settings/campus${campusQuery}`, { headers: getAuthHeaders() }),
        fetch(`/api/settings/campus/map-data${campusQuery}`, { headers: getAuthHeaders() }),
      ])
      if (handleAuthResponse(campusRes)) return
      const campusJson = await campusRes.json()
      if (!campusRes.ok || !campusJson.ok) throw new Error(campusJson?.error?.message || 'Failed to load campus data')
      setBuildings(campusJson.data.buildings || [])
      setAreas(campusJson.data.areas || [])
      setRooms(campusJson.data.rooms || [])

      // Load outdoor space map positions
      if (mapRes.ok) {
        const mapJson = await mapRes.json()
        if (mapJson.ok && mapJson.data?.outdoorSpaces) {
          setOutdoorMapSpaces(mapJson.data.outdoorSpaces)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load campus data')
    } finally {
      setLoading(false)
    }
  }

  // Load campuses on mount
  useEffect(() => {
    loadCampuses()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load data when selectedCampusId changes
  useEffect(() => {
    if (selectedCampusId) {
      loadData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampusId])

  // ─── Building CRUD ────────────────────────────────────────────────────────
  const openAddBuilding = () => {
    setEditingBuilding(null)
    setBuildingForm({ name: '', code: '', schoolDivision: 'GLOBAL', buildingType: 'GENERAL' })
    setBuildingFormError('')
    setBuildingDrawerOpen(true)
  }

  const openEditBuilding = (b: Building) => {
    setEditingBuilding(b)
    setBuildingForm({ name: b.name, code: b.code || '', schoolDivision: b.schoolDivision, buildingType: b.buildingType || 'GENERAL' })
    setBuildingFormError('')
    setBuildingDrawerOpen(true)
  }

  const closeBuildingDrawer = () => {
    if (buildingFormSaving) return
    setBuildingDrawerOpen(false)
    setEditingBuilding(null)
    setPendingMarkerData(null)
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
        body: JSON.stringify({
          name,
          code: buildingForm.code || null,
          schoolDivision: buildingForm.schoolDivision,
          buildingType: buildingForm.buildingType,
          ...(selectedCampusId && !editingBuilding ? { campusId: selectedCampusId } : {}),
          ...(pendingBuildingCoords && !editingBuilding ? { latitude: pendingBuildingCoords.lat, longitude: pendingBuildingCoords.lng } : {}),
        }),
      })
      if (handleAuthResponse(res)) return
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to save building')
      setBuildingDrawerOpen(false)
      setEditingBuilding(null)
      setPendingBuildingCoords(null)
      setPendingMarkerData(null)
      if (!editingBuilding) {
        setLastCreatedBuilding(json.data)
      }
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
    setPendingMarkerData(null)
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
        body: JSON.stringify({
          name,
          areaType: outdoorForm.areaType,
          buildingId: null,
          ...(selectedCampusId && !editingOutdoor ? { campusId: selectedCampusId } : {}),
          ...(pendingOutdoorCoords && !editingOutdoor ? { latitude: pendingOutdoorCoords.lat, longitude: pendingOutdoorCoords.lng } : {}),
        }),
      })
      if (handleAuthResponse(res)) return
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to save outdoor space')
      setOutdoorDrawerOpen(false)
      setEditingOutdoor(null)
      setPendingOutdoorCoords(null)
      setPendingMarkerData(null)
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
      if (handleAuthResponse(res)) return
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
      if (handleAuthResponse(res)) return
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

  // ─── Delete/Deactivate ───────────────────────────────────────────────────
  const openDeleteConfirm = async (type: 'building' | 'outdoor', id: string, name: string) => {
    let roomCount = 0
    let ticketCount = 0
    if (type === 'building') {
      roomCount = rooms.filter(r => r.buildingId === id).length
    }
    setDeleteConfirm({ type, id, name, roomCount, ticketCount, action: 'delete' })
  }

  const openDeactivateConfirm = (type: 'building' | 'outdoor' | 'room', id: string, name: string) => {
    const roomCount = type === 'building' ? rooms.filter(r => r.buildingId === id).length : 0
    setDeleteConfirm({ type, id, name, roomCount, ticketCount: 0, action: 'deactivate' })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return
    setDeleteLoading(true)
    try {
      const endpointMap = { building: 'buildings', outdoor: 'areas', room: 'rooms' } as const
      const endpoint = endpointMap[deleteConfirm.type]
      const res = await fetch(`/api/settings/campus/${endpoint}/${deleteConfirm.id}?permanent=true`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (handleAuthResponse(res)) return
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to delete')
      setDeleteConfirm(null)
      setSuccessMessage(`${deleteConfirm.name} deleted permanently`)
      await loadData()
    } catch (e) {
      setDeleteConfirm(null)
      setBuildingFormError(e instanceof Error ? e.message : 'Failed to delete')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleDeactivateFromDialog = async () => {
    if (!deleteConfirm) return
    setDeleteLoading(true)
    try {
      const endpointMap = { building: 'buildings', outdoor: 'areas', room: 'rooms' } as const
      const endpoint = endpointMap[deleteConfirm.type]
      const res = await fetch(`/api/settings/campus/${endpoint}/${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
      if (handleAuthResponse(res)) return
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to deactivate')
      setDeleteConfirm(null)
      setSuccessMessage(`${deleteConfirm.name} deactivated`)
      await loadData()
    } catch (e) {
      setDeleteConfirm(null)
      setBuildingFormError(e instanceof Error ? e.message : 'Failed to deactivate')
    } finally {
      setDeleteLoading(false)
    }
  }

  // ─── Campus Management ────────────────────────────────────────────────────
  const openAddCampusModal = () => {
    setAddCampusForm({ name: '', address: '', campusType: 'CAMPUS' })
    setAddCampusError('')
    setShowAddCampusModal(true)
  }

  const closeAddCampusModal = () => {
    if (addCampusSaving) return
    setShowAddCampusModal(false)
    setAddCampusForm({ name: '', address: '', campusType: 'CAMPUS' })
    setAddCampusError('')
  }

  const saveAddCampusForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddCampusError('')
    const name = addCampusForm.name.trim()
    if (!name) { setAddCampusError('Campus name is required'); return }

    setAddCampusSaving(true)
    try {
      const res = await fetch('/api/settings/campus/campuses', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name,
          address: addCampusForm.address.trim() || null,
          campusType: addCampusForm.campusType,
        }),
      })
      if (handleAuthResponse(res)) return
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to add campus')
      setShowAddCampusModal(false)
      setAddCampusForm({ name: '', address: '', campusType: 'CAMPUS' })
      setSuccessMessage('Campus added')
      await loadCampuses()
      // Select the newly created campus
      if (json.data?.id) {
        setSelectedCampusId(json.data.id)
      }
    } catch (e) {
      setAddCampusError(e instanceof Error ? e.message : 'Failed to add campus')
    } finally {
      setAddCampusSaving(false)
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-semibold text-gray-900">
            <Building2 className="w-6 h-6 text-blue-600" />
            Campus
          </h2>
          <p className="text-sm text-gray-600 mt-1">Manage buildings, outdoor spaces, and rooms</p>
        </div>
        <button
          onClick={openAddCampusModal}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" /> Add Campus
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {successMessage && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <span>{successMessage}</span>
          {lastCreatedBuilding && (
            <div className="flex items-center gap-2 ml-4">
              {!lastCreatedBuilding.latitude && (
                <button
                  onClick={() => {
                    setSuccessMessage('')
                    setLastCreatedBuilding(null)
                    setPlaceOnMapBuilding(lastCreatedBuilding)
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Place on Map
                </button>
              )}
              <button
                onClick={() => {
                  openRoomsDrawer(lastCreatedBuilding)
                  setSuccessMessage('')
                  setLastCreatedBuilding(null)
                }}
                className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 transition-colors"
              >
                <DoorOpen className="h-3.5 w-3.5" />
                Add Rooms
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Campus Selector Tabs ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-gray-200 overflow-x-auto">
        {campuses.length > 1 && campuses.map((campus) => (
          <button
            key={campus.id}
            onClick={() => setSelectedCampusId(campus.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              selectedCampusId === campus.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {campus.name}
          </button>
        ))}
      </div>

      {/* ── Campus Map ────────────────────────────────────────────────────── */}
      <InteractiveCampusMap
        buildings={buildings.map((b) => ({
          id: b.id,
          name: b.name,
          code: b.code,
          latitude: b.latitude,
          longitude: b.longitude,
          schoolDivision: b.schoolDivision,
          polygonCoordinates: (b as any).polygonCoordinates || null,
        }))}
        outdoorSpaces={outdoorMapSpaces}
        editable
        quickPlaceMode={placingExistingBuilding ? 'building' : null}
        onQuickPlaceDone={() => setPlacingExistingBuilding(null)}
        onOrgCenterChange={async (lat, lng) => {
          try {
            const res = await fetch('/api/settings/campus/map-data', {
              method: 'PATCH',
              headers: getAuthHeaders(),
              body: JSON.stringify({ latitude: lat, longitude: lng }),
            })
            if (res.ok) {
              setSuccessMessage('School center position updated')
              setTimeout(() => setSuccessMessage(''), 3000)
            }
          } catch {
            setError('Failed to save school center position')
          }
        }}
        onBuildingPositionChange={async (buildingId, lat, lng) => {
          try {
            const res = await fetch(`/api/settings/campus/buildings/${buildingId}`, {
              method: 'PATCH',
              headers: getAuthHeaders(),
              body: JSON.stringify({ latitude: lat, longitude: lng }),
            })
            if (res.ok) {
              setBuildings((prev) =>
                prev.map((b) => (b.id === buildingId ? { ...b, latitude: lat, longitude: lng } : b))
              )
              setSuccessMessage('Building position updated')
              setTimeout(() => setSuccessMessage(''), 3000)
            }
          } catch {
            setError('Failed to save building position')
          }
        }}
        onAddBuildingAtPosition={async (lat, lng) => {
          // If placing an existing building, just PATCH its coordinates
          if (placingExistingBuilding) {
            const building = placingExistingBuilding
            setPlacingExistingBuilding(null)
            try {
              const res = await fetch(`/api/settings/campus/buildings/${building.id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ latitude: lat, longitude: lng }),
              })
              if (res.ok) {
                setBuildings((prev) =>
                  prev.map((b) => (b.id === building.id ? { ...b, latitude: lat, longitude: lng } : b))
                )
                setSuccessMessage(`"${building.name}" placed on map`)
              }
            } catch {
              setError('Failed to place building on map')
            }
            await loadData()
            return
          }
          setBuildingForm({ name: '', code: '', schoolDivision: 'GLOBAL', buildingType: 'GENERAL' })
          setEditingBuilding(null)
          setBuildingDrawerOpen(true)
          setPendingBuildingCoords({ lat, lng })
          setPendingMarkerData({ lat, lng, label: '', type: 'building' })
        }}
        onAddOutdoorSpaceAtPosition={(lat, lng) => {
          setOutdoorForm({ name: '', areaType: 'FIELD' })
          setEditingOutdoor(null)
          setOutdoorDrawerOpen(true)
          setPendingOutdoorCoords({ lat, lng })
          setPendingMarkerData({ lat, lng, label: '', type: 'outdoor' })
        }}
        onBuildingSelected={(buildingId) => {
          setSelectedMapBuildingId(buildingId)
        }}
        onPolygonSaved={async (buildingId, coordinates) => {
          try {
            const res = await fetch(`/api/settings/campus/buildings/${buildingId}`, {
              method: 'PATCH',
              headers: getAuthHeaders(),
              body: JSON.stringify({ polygonCoordinates: coordinates }),
            })
            if (res.ok) {
              setBuildings((prev) =>
                prev.map((b) => (b.id === buildingId ? { ...b, polygonCoordinates: coordinates } as any : b))
              )
              setSuccessMessage('Building outline saved')
              setTimeout(() => setSuccessMessage(''), 3000)
            }
          } catch {
            setError('Failed to save building outline')
          }
        }}
        onOutdoorPositionChange={async (areaId, lat, lng) => {
          try {
            const res = await fetch(`/api/settings/campus/areas/${areaId}`, {
              method: 'PATCH',
              headers: getAuthHeaders(),
              body: JSON.stringify({ latitude: lat, longitude: lng }),
            })
            if (res.ok) {
              setSuccessMessage('Outdoor space position updated')
              setTimeout(() => setSuccessMessage(''), 3000)
            }
          } catch {
            setError('Failed to save outdoor space position')
          }
        }}
        onEditBuilding={(buildingId) => {
          const b = buildings.find((x) => x.id === buildingId)
          if (b) openEditBuilding(b)
        }}
        onDeleteBuilding={(buildingId) => {
          const b = buildings.find((x) => x.id === buildingId)
          if (b) openDeleteConfirm('building', b.id, b.name)
        }}
        onManageRooms={(buildingId) => {
          const b = buildings.find((x) => x.id === buildingId)
          if (b) openRoomsDrawer(b)
        }}
        onEditOutdoor={(outdoorId) => {
          const a = outdoorSpaces.find((x) => x.id === outdoorId)
          if (a) openEditOutdoor(a)
        }}
        onDeleteOutdoor={(outdoorId) => {
          const a = outdoorSpaces.find((x) => x.id === outdoorId)
          if (a) openDeleteConfirm('outdoor', a.id, a.name)
        }}
        pendingMarker={pendingMarkerData}
      />

      {/* ── Buildings ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Buildings</h3>
            <p className="text-sm text-gray-500 mt-0.5">Physical structures on campus</p>
          </div>
          <button
            onClick={openAddBuilding}
            className="flex items-center gap-2 px-4 py-2 min-h-[36px] text-sm font-medium bg-white text-blue-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
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
                    <th className="py-3 px-4 text-left font-medium">Type</th>
                    <th className="py-3 px-4 text-left font-medium">Rooms</th>
                    <th className="py-3 px-4 text-left font-medium">Status</th>
                    <th className="py-3 pl-4 pr-10 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedBuildings.map((group) => (
                    <React.Fragment key={group.division}>
                      {/* Division header row */}
                      <tr className={DIVISION_BG_CLASSES[group.division] || 'bg-gray-50'}>
                        <td colSpan={5} className="py-2 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ background: DIVISION_COLORS[group.division] }}
                            />
                            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                              {DIVISION_LABELS[group.division] || group.division}
                            </span>
                            <span className="text-xs text-gray-400">({group.buildings.length})</span>
                          </div>
                        </td>
                      </tr>
                      {/* Building rows */}
                      {group.buildings.map((b) => {
                        const roomCount = rooms.filter((r) => r.buildingId === b.id).length
                        return (
                          <tr key={b.id} className="border-b last:border-b-0 hover:bg-gray-50">
                            <td className="py-3 px-4">
                              <div className="font-medium text-gray-900">{b.name}</div>
                              {b.code && <div className="text-xs text-gray-400 mt-0.5">{b.code}</div>}
                            </td>
                            <td className="py-3 px-4 text-gray-500 text-xs">{BUILDING_TYPE_LABELS[b.buildingType] || 'General'}</td>
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
                                      label: 'Delete',
                                      icon: <Trash2 className="w-4 h-4" />,
                                      onClick: () => openDeleteConfirm('building', b.id, b.name),
                                      variant: 'danger',
                                    },
                                  ]}
                                />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </React.Fragment>
                  ))}
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
            className="flex items-center gap-2 px-4 py-2 min-h-[36px] text-sm font-medium bg-white text-blue-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
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
                                label: 'Delete',
                                icon: <Trash2 className="w-4 h-4" />,
                                onClick: () => openDeleteConfirm('outdoor', a.id, a.name),
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
                onChange={(e) => {
                  setBuildingForm((p) => ({ ...p, name: e.target.value }))
                  if (pendingBuildingCoords) {
                    setPendingMarkerData((prev) => (prev ? { ...prev, label: e.target.value } : null))
                  }
                }}
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
            <div>
              <label className={labelClass}>Building type</label>
              <select
                value={buildingForm.buildingType}
                onChange={(e) => setBuildingForm((p) => ({ ...p, buildingType: e.target.value }))}
                className={inputClass}
                disabled={buildingFormSaving}
              >
                <option value="GENERAL">General</option>
                <option value="ARTS_CULTURE">Arts &amp; Culture</option>
                <option value="ATHLETICS">Athletics</option>
                <option value="ADMINISTRATION">Administration</option>
                <option value="SUPPORT_SERVICES">Support Services</option>
              </select>
            </div>
          </section>

          {/* Photos section — only for existing buildings */}
          {editingBuilding && (
            <section className="border-t border-gray-200 pt-4">
              <ImageUpload
                entityType="building"
                entityId={editingBuilding.id}
                images={editingBuilding.images || []}
                onImagesChange={(imgs) => {
                  setEditingBuilding({ ...editingBuilding, images: imgs })
                  // Also update the buildings list so the drawer shows updated images
                  setBuildings((prev) => prev.map((b) => b.id === editingBuilding.id ? { ...b, images: imgs } : b))
                }}
                disabled={buildingFormSaving}
                onImageClick={openLightbox}
              />
            </section>
          )}

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
                onChange={(e) => {
                  setOutdoorForm((p) => ({ ...p, name: e.target.value }))
                  if (pendingOutdoorCoords) {
                    setPendingMarkerData((prev) => (prev ? { ...prev, label: e.target.value } : null))
                  }
                }}
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

          {/* Photos section — only for existing outdoor spaces */}
          {editingOutdoor && (
            <section className="border-t border-gray-200 pt-4">
              <ImageUpload
                entityType="area"
                entityId={editingOutdoor.id}
                images={editingOutdoor.images || []}
                onImagesChange={(imgs) => {
                  setEditingOutdoor({ ...editingOutdoor, images: imgs })
                  setAreas((prev) => prev.map((a) => a.id === editingOutdoor.id ? { ...a, images: imgs } : a))
                }}
                disabled={outdoorFormSaving}
                onImageClick={openLightbox}
              />
            </section>
          )}

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
                      <React.Fragment key={r.id}>
                      <tr className="border-b last:border-b-0 hover:bg-gray-50">
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
                                  label: 'Photos',
                                  icon: <Camera className="w-4 h-4" />,
                                  onClick: () => setRoomImagesId(roomImagesId === r.id ? null : r.id),
                                },
                                {
                                  label: 'Deactivate',
                                  icon: <Trash2 className="w-4 h-4" />,
                                  onClick: () => openDeactivateConfirm('room', r.id, r.displayName || r.roomNumber),
                                  variant: 'danger',
                                },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                      {roomImagesId === r.id && (
                        <tr className="border-b last:border-b-0 bg-gray-50">
                          <td colSpan={5} className="px-4 py-4">
                            <ImageUpload
                              entityType="room"
                              entityId={r.id}
                              images={r.images || []}
                              onImagesChange={(imgs) => {
                                setRooms((prev) => prev.map((room) => room.id === r.id ? { ...room, images: imgs } : room))
                              }}
                              onImageClick={openLightbox}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DetailDrawer>

      {/* ── Building Info Side Panel (from map click) ───────────────────── */}
      <DetailDrawer
        isOpen={!!selectedMapBuildingId}
        onClose={() => setSelectedMapBuildingId(null)}
        title={buildings.find((b) => b.id === selectedMapBuildingId)?.name || 'Building'}
      >
        {selectedMapBuildingId && (() => {
          const building = buildings.find((b) => b.id === selectedMapBuildingId)
          const buildingRooms = rooms.filter((r) => r.buildingId === selectedMapBuildingId)
          if (!building) return null
          return (
            <div className="space-y-6">
              <div className="space-y-2">
                {building.code && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">Code:</span>
                    <span className="font-medium text-gray-900">{building.code}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Division:</span>
                  <span className="font-medium text-gray-900">{DIVISION_LABELS[building.schoolDivision] || building.schoolDivision}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Status:</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${building.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {building.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Photos */}
              {building.images && building.images.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Photos</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {building.images.map((url: string, idx: number) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => openLightbox(building.images!, idx)}
                        className="aspect-[4/3] rounded-lg overflow-hidden bg-gray-100 border border-gray-200 hover:ring-2 hover:ring-blue-400 transition cursor-pointer"
                        style={{ minHeight: 'auto' }}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">
                  Rooms ({buildingRooms.length})
                </h4>
                {buildingRooms.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No rooms added to this building yet.</p>
                ) : (
                  <div className="space-y-2">
                    {buildingRooms.map((room) => (
                      <div key={room.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                        <div>
                          <span className="text-sm font-medium text-gray-900">
                            {room.displayName || `Room ${room.roomNumber}`}
                          </span>
                          {room.displayName && (
                            <span className="text-xs text-gray-500 ml-2">#{room.roomNumber}</span>
                          )}
                        </div>
                        {room.floor && (
                          <span className="text-xs text-gray-500">Floor {room.floor}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setSelectedMapBuildingId(null)
                  setEditingBuilding(building)
                  setBuildingForm({
                    name: building.name,
                    code: building.code || '',
                    schoolDivision: building.schoolDivision,
                    buildingType: building.buildingType || 'GENERAL',
                  })
                  setBuildingDrawerOpen(true)
                }}
                className="w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
              >
                Edit Building
              </button>
            </div>
          )
        })()}
      </DetailDrawer>

      {/* ── Add Campus Modal ──────────────────────────────────────────────── */}
      {showAddCampusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Add Campus</h3>
            </div>
            <form onSubmit={saveAddCampusForm} className="p-6 space-y-4">
              {addCampusError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{addCampusError}</div>
              )}
              <div>
                <label className={labelClass}>Campus name</label>
                <input
                  value={addCampusForm.name}
                  onChange={(e) => setAddCampusForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Main Campus, North Campus"
                  className={inputClass}
                  disabled={addCampusSaving}
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Address <span className="text-gray-400 font-normal">(optional)</span></label>
                <AddressAutocomplete
                  value={addCampusForm.address}
                  onChange={(val) => setAddCampusForm((p) => ({ ...p, address: val }))}
                  placeholder="e.g. 123 Main St, City, State"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Campus type</label>
                <select
                  value={addCampusForm.campusType}
                  onChange={(e) => setAddCampusForm((p) => ({ ...p, campusType: e.target.value }))}
                  className={inputClass}
                  disabled={addCampusSaving}
                >
                  <option value="HEADQUARTERS">Headquarters</option>
                  <option value="CAMPUS">Campus</option>
                  <option value="SATELLITE">Satellite</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeAddCampusModal}
                  className="px-4 py-2 min-h-[40px] border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
                  disabled={addCampusSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 min-h-[40px] bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={addCampusSaving}
                >
                  {addCampusSaving ? 'Adding...' : 'Add Campus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete/Deactivate Confirm ────────────────────────────────────── */}
      {/* ── Place on Map Prompt ──────────────────────────────────────────── */}
      {placeOnMapBuilding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Place on Map?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Would you like to place <span className="font-medium text-gray-700">{placeOnMapBuilding.name}</span> on the campus map? You can click a spot on the map to set its location.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setPlaceOnMapBuilding(null)}
                className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
              >
                Skip for Now
              </button>
              <button
                onClick={() => {
                  const building = placeOnMapBuilding
                  setPlaceOnMapBuilding(null)
                  setPlacingExistingBuilding(building)
                  // Scroll map into view
                  const mapEl = document.querySelector('.leaflet-container')
                  if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
              >
                Place on Map
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <ConfirmDialog
          isOpen={!!deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          onConfirm={deleteConfirm.action === 'delete' ? handleDeleteConfirm : handleDeactivateFromDialog}
          title={deleteConfirm.action === 'delete'
            ? `Delete "${deleteConfirm.name}"?`
            : `Deactivate "${deleteConfirm.name}"?`}
          message={deleteConfirm.action === 'delete'
            ? 'This action is permanent and cannot be undone.'
            : 'This hides it from active selections but keeps existing references intact.'}
          confirmText={deleteConfirm.action === 'delete' ? 'Delete permanently' : 'Deactivate'}
          cancelText="Cancel"
          variant="danger"
          isLoading={deleteLoading}
          loadingText={deleteConfirm.action === 'delete' ? 'Deleting...' : 'Deactivating...'}
          requireText={deleteConfirm.action === 'delete' ? deleteConfirm.name : undefined}
          extraAction={deleteConfirm.action === 'delete' ? {
            label: 'Deactivate instead',
            onClick: handleDeactivateFromDialog,
          } : undefined}
        >
          {deleteConfirm.type === 'building' && deleteConfirm.roomCount > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This building has <strong>{deleteConfirm.roomCount} room{deleteConfirm.roomCount !== 1 ? 's' : ''}</strong>.
              {deleteConfirm.action === 'delete' && ' Deleting will permanently remove all associated rooms.'}
            </div>
          )}
        </ConfirmDialog>
      )}

      {/* Photo lightbox */}
      <PhotoLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  )
}
