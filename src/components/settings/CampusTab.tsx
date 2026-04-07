'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Building2, MapPin, DoorOpen, Plus } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import { getAuthHeaders } from '@/lib/api-client'
import InteractiveCampusMap from '@/components/settings/InteractiveCampusMap'
import SchoolsManagement from '@/components/settings/SchoolsManagement'
import PhotoLightbox from '@/components/settings/PhotoLightbox'
import CampusSelector from './campus/CampusSelector'
import BuildingsTable from './campus/BuildingsTable'
import OutdoorSpacesTable from './campus/OutdoorSpacesTable'
import BuildingFormDrawer from './campus/BuildingFormDrawer'
import OutdoorFormDrawer from './campus/OutdoorFormDrawer'
import RoomsDrawer from './campus/RoomsDrawer'
import BuildingInfoDrawer from './campus/BuildingInfoDrawer'
import { AddCampusDrawer, EditCampusDrawer } from './campus/CampusFormDrawers'
import { DeleteCampusDialog, PlaceOnMapDialog, EntityDeleteDialog } from './campus/CampusDialogs'
import type { Building, Area, Room, Campus, SchoolInfo, DeleteConfirm } from './campus/types'

type CampusTabProps = {
  onDirtyChange?: (isDirty: boolean) => void
}

export default function CampusTab({ onDirtyChange }: CampusTabProps = {}) {
  // ─── Campus state ──────────────────────────────────────────────────────
  const [campuses, setCampuses] = useState<Campus[]>([])
  const [selectedCampusId, setSelectedCampusId] = useState<string | null>(null)
  const [campusesLoading, setCampusesLoading] = useState(true)

  // Add campus
  const [showAddCampusModal, setShowAddCampusModal] = useState(false)
  const [addCampusForm, setAddCampusForm] = useState({ name: '', address: '', campusType: 'CAMPUS' })
  const [addCampusError, setAddCampusError] = useState('')
  const [addCampusSaving, setAddCampusSaving] = useState(false)

  // Edit campus
  const [editCampusDrawerOpen, setEditCampusDrawerOpen] = useState(false)
  const [editingCampus, setEditingCampus] = useState<Campus | null>(null)
  const [editCampusForm, setEditCampusForm] = useState({ name: '', address: '', campusType: 'CAMPUS' })
  const [editCampusError, setEditCampusError] = useState('')
  const [editCampusSaving, setEditCampusSaving] = useState(false)

  // Delete campus
  const [deleteCampusConfirm, setDeleteCampusConfirm] = useState<Campus | null>(null)
  const [deleteCampusLoading, setDeleteCampusLoading] = useState(false)

  // ─── Data ──────────────────────────────────────────────────────────────
  const [buildings, setBuildings] = useState<Building[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [schools, setSchools] = useState<SchoolInfo[]>([])
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number; name: string; address: string | null } | null>(null)
  const [loading, setLoading] = useState(true)

  // ─── Building drawer ───────────────────────────────────────────────────
  const [buildingDrawerOpen, setBuildingDrawerOpen] = useState(false)
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null)
  const [buildingForm, setBuildingForm] = useState({ name: '', code: '', schoolDivision: 'GLOBAL', buildingType: 'GENERAL' })
  const [buildingFormError, setBuildingFormError] = useState('')
  const [buildingFormSaving, setBuildingFormSaving] = useState(false)

  // ─── Outdoor space drawer ──────────────────────────────────────────────
  const [outdoorDrawerOpen, setOutdoorDrawerOpen] = useState(false)
  const [editingOutdoor, setEditingOutdoor] = useState<Area | null>(null)
  const [outdoorForm, setOutdoorForm] = useState({ name: '', areaType: 'FIELD' })
  const [outdoorFormError, setOutdoorFormError] = useState('')
  const [outdoorFormSaving, setOutdoorFormSaving] = useState(false)

  // ─── Rooms drawer ─────────────────────────────────────────────────────
  const [roomsBuilding, setRoomsBuilding] = useState<Building | null>(null)

  // ─── Delete/Deactivate ────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // ─── Map state ─────────────────────────────────────────────────────────
  const [pendingBuildingCoords, setPendingBuildingCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [pendingOutdoorCoords, setPendingOutdoorCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [pendingMarkerData, setPendingMarkerData] = useState<{ lat: number; lng: number; label: string; type: 'building' | 'outdoor' } | null>(null)
  const [lastCreatedBuilding, setLastCreatedBuilding] = useState<Building | null>(null)
  const [placeOnMapBuilding, setPlaceOnMapBuilding] = useState<Building | null>(null)
  const [placingExistingBuilding, setPlacingExistingBuilding] = useState<Building | null>(null)
  const [selectedMapBuildingId, setSelectedMapBuildingId] = useState<string | null>(null)
  const [outdoorMapSpaces, setOutdoorMapSpaces] = useState<any[]>([])

  // ─── Photo lightbox ────────────────────────────────────────────────────
  const [lightboxImages, setLightboxImages] = useState<string[]>([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const openLightbox = (images: string[], index: number) => {
    setLightboxImages(images)
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  // ─── Feedback ──────────────────────────────────────────────────────────
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // ─── Computed ──────────────────────────────────────────────────────────
  const outdoorSpaces = useMemo(() => areas.filter((a) => a.buildingId === null), [areas])
  const buildingRooms = useMemo(
    () => (roomsBuilding ? rooms.filter((r) => r.buildingId === roomsBuilding.id) : []),
    [rooms, roomsBuilding],
  )

  const hasUnsavedChanges = Boolean(
    (buildingDrawerOpen && (buildingForm.name.trim().length > 0 || buildingForm.code.trim().length > 0)) ||
    (outdoorDrawerOpen && outdoorForm.name.trim().length > 0),
  )

  useEffect(() => { onDirtyChange?.(hasUnsavedChanges) }, [hasUnsavedChanges, onDirtyChange])

  useEffect(() => {
    if (!successMessage) return
    const delay = lastCreatedBuilding ? 6000 : 2500
    const t = setTimeout(() => { setSuccessMessage(''); setLastCreatedBuilding(null) }, delay)
    return () => clearTimeout(t)
  }, [successMessage, lastCreatedBuilding])

  useEffect(() => {
    if (!hasUnsavedChanges) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])

  // ─── Data loading ──────────────────────────────────────────────────────
  const loadCampuses = async (andLoadData = false) => {
    setCampusesLoading(true)
    try {
      const res = await fetch('/api/settings/campus/campuses', { headers: getAuthHeaders() })
      if (handleAuthResponse(res)) return
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to load campuses')
      const list = json.data || []
      setCampuses(list)
      if (list.length > 0 && !selectedCampusId) {
        setSelectedCampusId(list[0].id)
        if (andLoadData) loadDataForCampus(list[0].id)
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load campuses') }
    finally { setCampusesLoading(false) }
  }

  const loadDataForCampus = async (campusId: string) => {
    setLoading(true); setError('')
    try {
      const q = campusId ? `?campusId=${campusId}` : ''
      const [campusRes, mapRes, schoolsRes] = await Promise.all([
        fetch(`/api/settings/campus${q}`, { headers: getAuthHeaders() }),
        fetch(`/api/settings/campus/map-data${q}`, { headers: getAuthHeaders() }),
        fetch('/api/settings/schools', { headers: getAuthHeaders() }),
      ])
      if (handleAuthResponse(campusRes)) return
      const campusJson = await campusRes.json()
      if (!campusRes.ok || !campusJson.ok) throw new Error(campusJson?.error?.message || 'Failed to load campus data')
      setBuildings(campusJson.data.buildings || [])
      setAreas(campusJson.data.areas || [])
      setRooms(campusJson.data.rooms || [])
      if (schoolsRes.ok) {
        const sj = await schoolsRes.json()
        if (sj.ok && sj.data) setSchools(sj.data.map((s: any) => ({ name: s.name, color: s.color, gradeLevel: s.gradeLevel })))
      }
      if (mapRes.ok) {
        const mj = await mapRes.json()
        if (mj.ok) {
          if (mj.data?.org) setMapCenter({ lat: mj.data.org.lat || 33.4936, lng: mj.data.org.lng || -117.0892, name: mj.data.org.name || '', address: mj.data.org.address || null })
          if (mj.data?.outdoorSpaces) setOutdoorMapSpaces(mj.data.outdoorSpaces)
        }
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load campus data') }
    finally { setLoading(false) }
  }

  const loadData = () => loadDataForCampus(selectedCampusId || '')

  useEffect(() => { loadCampuses(true) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedCampusId) return
    setBuildings([]); setAreas([]); setRooms([]); setOutdoorMapSpaces([])
    setBuildingDrawerOpen(false); setOutdoorDrawerOpen(false); setRoomsBuilding(null)
    setEditingBuilding(null); setEditingOutdoor(null)
    setSelectedMapBuildingId(null); setPlacingExistingBuilding(null); setPlaceOnMapBuilding(null)
    loadData()
  }, [selectedCampusId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Building CRUD ─────────────────────────────────────────────────────
  const openAddBuilding = () => { setEditingBuilding(null); setBuildingForm({ name: '', code: '', schoolDivision: 'GLOBAL', buildingType: 'GENERAL' }); setBuildingFormError(''); setBuildingDrawerOpen(true) }
  const openEditBuilding = (b: Building) => { setEditingBuilding(b); setBuildingForm({ name: b.name, code: b.code || '', schoolDivision: b.schoolDivision, buildingType: b.buildingType || 'GENERAL' }); setBuildingFormError(''); setBuildingDrawerOpen(true) }
  const closeBuildingDrawer = () => { if (buildingFormSaving) return; setBuildingDrawerOpen(false); setEditingBuilding(null); setPendingMarkerData(null) }

  const saveBuildingForm = async (e: React.FormEvent) => {
    e.preventDefault(); setBuildingFormError('')
    const name = buildingForm.name.trim()
    if (!name) { setBuildingFormError('Building name is required'); return }
    setBuildingFormSaving(true)
    try {
      const url = editingBuilding ? `/api/settings/campus/buildings/${editingBuilding.id}` : '/api/settings/campus/buildings'
      const res = await fetch(url, {
        method: editingBuilding ? 'PATCH' : 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ name, code: buildingForm.code || null, schoolDivision: buildingForm.schoolDivision, buildingType: buildingForm.buildingType, ...(selectedCampusId && !editingBuilding ? { campusId: selectedCampusId } : {}), ...(pendingBuildingCoords && !editingBuilding ? { latitude: pendingBuildingCoords.lat, longitude: pendingBuildingCoords.lng } : {}) }),
      })
      if (handleAuthResponse(res)) return
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to save building')
      setBuildingDrawerOpen(false); setEditingBuilding(null); setPendingBuildingCoords(null); setPendingMarkerData(null)
      if (!editingBuilding) setLastCreatedBuilding(json.data)
      setSuccessMessage(editingBuilding ? 'Building updated' : 'Building added')
      await loadData()
    } catch (e) { setBuildingFormError(e instanceof Error ? e.message : 'Failed to save building') }
    finally { setBuildingFormSaving(false) }
  }

  // ─── Outdoor CRUD ──────────────────────────────────────────────────────
  const openAddOutdoor = () => { setEditingOutdoor(null); setOutdoorForm({ name: '', areaType: 'FIELD' }); setOutdoorFormError(''); setOutdoorDrawerOpen(true) }
  const openEditOutdoor = (a: Area) => { setEditingOutdoor(a); setOutdoorForm({ name: a.name, areaType: a.areaType }); setOutdoorFormError(''); setOutdoorDrawerOpen(true) }
  const closeOutdoorDrawer = () => { if (outdoorFormSaving) return; setOutdoorDrawerOpen(false); setEditingOutdoor(null); setPendingMarkerData(null) }

  const saveOutdoorForm = async (e: React.FormEvent) => {
    e.preventDefault(); setOutdoorFormError('')
    const name = outdoorForm.name.trim()
    if (!name) { setOutdoorFormError('Name is required'); return }
    setOutdoorFormSaving(true)
    try {
      const url = editingOutdoor ? `/api/settings/campus/areas/${editingOutdoor.id}` : '/api/settings/campus/areas'
      const res = await fetch(url, {
        method: editingOutdoor ? 'PATCH' : 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ name, areaType: outdoorForm.areaType, buildingId: null, ...(selectedCampusId && !editingOutdoor ? { campusId: selectedCampusId } : {}), ...(pendingOutdoorCoords && !editingOutdoor ? { latitude: pendingOutdoorCoords.lat, longitude: pendingOutdoorCoords.lng } : {}) }),
      })
      if (handleAuthResponse(res)) return
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to save outdoor space')
      setOutdoorDrawerOpen(false); setEditingOutdoor(null); setPendingOutdoorCoords(null); setPendingMarkerData(null)
      setSuccessMessage(editingOutdoor ? 'Outdoor space updated' : 'Outdoor space added')
      await loadData()
    } catch (e) { setOutdoorFormError(e instanceof Error ? e.message : 'Failed to save outdoor space') }
    finally { setOutdoorFormSaving(false) }
  }

  // ─── Room CRUD (called from RoomsDrawer) ───────────────────────────────
  const handleAddRoom = async (form: { roomNumber: string; displayName: string; floor: string }) => {
    if (!roomsBuilding) return
    const res = await fetch('/api/settings/campus/rooms', {
      method: 'POST', headers: getAuthHeaders(),
      body: JSON.stringify({ buildingId: roomsBuilding.id, roomNumber: form.roomNumber.trim(), displayName: form.displayName.trim() || null, floor: form.floor.trim() || null, areaId: null }),
    })
    if (handleAuthResponse(res)) return
    const json = await res.json()
    if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to add room')
    await loadData()
  }

  const handleEditRoom = async (roomId: string, form: { roomNumber: string; displayName: string; floor: string }) => {
    const res = await fetch(`/api/settings/campus/rooms/${roomId}`, {
      method: 'PATCH', headers: getAuthHeaders(),
      body: JSON.stringify({ roomNumber: form.roomNumber.trim(), displayName: form.displayName.trim() || null, floor: form.floor.trim() || null }),
    })
    if (handleAuthResponse(res)) return
    const json = await res.json()
    if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to save room')
    await loadData()
  }

  // ─── Delete/Deactivate ────────────────────────────────────────────────
  const openDeleteConfirm = (type: 'building' | 'outdoor', id: string, name: string) => {
    const roomCount = type === 'building' ? rooms.filter((r) => r.buildingId === id).length : 0
    setDeleteConfirm({ type, id, name, roomCount, ticketCount: 0, action: 'delete' })
  }

  const openDeactivateConfirm = (type: 'building' | 'outdoor' | 'room', id: string, name: string) => {
    const roomCount = type === 'building' ? rooms.filter((r) => r.buildingId === id).length : 0
    setDeleteConfirm({ type, id, name, roomCount, ticketCount: 0, action: 'deactivate' })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return
    setDeleteLoading(true)
    try {
      const ep = { building: 'buildings', outdoor: 'areas', room: 'rooms' } as const
      const res = await fetch(`/api/settings/campus/${ep[deleteConfirm.type]}/${deleteConfirm.id}?permanent=true`, { method: 'DELETE', headers: getAuthHeaders() })
      if (handleAuthResponse(res)) return
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to delete')
      setDeleteConfirm(null); setSuccessMessage(`${deleteConfirm.name} deleted permanently`); await loadData()
    } catch (e) { setDeleteConfirm(null); setBuildingFormError(e instanceof Error ? e.message : 'Failed to delete') }
    finally { setDeleteLoading(false) }
  }

  const handleDeactivateFromDialog = async () => {
    if (!deleteConfirm) return
    setDeleteLoading(true)
    try {
      const ep = { building: 'buildings', outdoor: 'areas', room: 'rooms' } as const
      const res = await fetch(`/api/settings/campus/${ep[deleteConfirm.type]}/${deleteConfirm.id}`, { method: 'DELETE', headers: getAuthHeaders() })
      if (handleAuthResponse(res)) return
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to deactivate')
      setDeleteConfirm(null); setSuccessMessage(`${deleteConfirm.name} deactivated`); await loadData()
    } catch (e) { setDeleteConfirm(null); setBuildingFormError(e instanceof Error ? e.message : 'Failed to deactivate') }
    finally { setDeleteLoading(false) }
  }

  // ─── Campus CRUD ───────────────────────────────────────────────────────
  const openAddCampusModal = () => { setAddCampusForm({ name: '', address: '', campusType: 'CAMPUS' }); setAddCampusError(''); setShowAddCampusModal(true) }
  const closeAddCampusModal = () => { if (addCampusSaving) return; setShowAddCampusModal(false) }

  const saveAddCampusForm = async (e: React.FormEvent) => {
    e.preventDefault(); setAddCampusError('')
    const name = addCampusForm.name.trim()
    if (!name) { setAddCampusError('Campus name is required'); return }
    setAddCampusSaving(true)
    try {
      const res = await fetch('/api/settings/campus/campuses', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ name, address: addCampusForm.address.trim() || null, campusType: addCampusForm.campusType }) })
      if (handleAuthResponse(res)) return
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to add campus')
      setShowAddCampusModal(false); setSuccessMessage('Campus added')
      await loadCampuses()
      if (json.data?.id) setSelectedCampusId(json.data.id)
    } catch (e) { setAddCampusError(e instanceof Error ? e.message : 'Failed to add campus') }
    finally { setAddCampusSaving(false) }
  }

  const openEditCampus = (campus: Campus) => { setEditingCampus(campus); setEditCampusForm({ name: campus.name, address: campus.address || '', campusType: campus.campusType }); setEditCampusError(''); setEditCampusDrawerOpen(true) }
  const closeEditCampusDrawer = () => { if (editCampusSaving) return; setEditCampusDrawerOpen(false); setEditingCampus(null) }

  const saveEditCampusForm = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editingCampus) return; setEditCampusError('')
    const name = editCampusForm.name.trim()
    if (!name) { setEditCampusError('Campus name is required'); return }
    setEditCampusSaving(true)
    try {
      const res = await fetch(`/api/settings/campus/campuses/${editingCampus.id}`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ name, address: editCampusForm.address.trim() || null, campusType: editCampusForm.campusType }) })
      if (handleAuthResponse(res)) return
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to update campus')
      setEditCampusDrawerOpen(false); setEditingCampus(null); setSuccessMessage('Campus updated'); await loadCampuses()
    } catch (e) { setEditCampusError(e instanceof Error ? e.message : 'Failed to update campus') }
    finally { setEditCampusSaving(false) }
  }

  const confirmDeleteCampus = async () => {
    if (!deleteCampusConfirm) return
    setDeleteCampusLoading(true)
    try {
      const res = await fetch(`/api/settings/campus/campuses/${deleteCampusConfirm.id}?permanent=true`, { method: 'DELETE', headers: getAuthHeaders() })
      if (handleAuthResponse(res)) return
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json?.error?.message || 'Failed to delete campus')
      setDeleteCampusConfirm(null); setSuccessMessage('Campus deleted')
      if (selectedCampusId === deleteCampusConfirm.id) setSelectedCampusId(null)
      await loadCampuses()
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to delete campus'); setDeleteCampusConfirm(null) }
    finally { setDeleteCampusLoading(false) }
  }

  // ─── Map click → open edit building from info drawer ───────────────────
  const openEditFromMap = (b: Building) => {
    setSelectedMapBuildingId(null)
    openEditBuilding(b)
  }

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="ui-glass p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Campus</h3>
              <p className="text-xs text-slate-500">Manage buildings, areas, and rooms</p>
            </div>
          </div>
          <button onClick={openAddCampusModal} className="bg-slate-900 text-white px-5 py-2.5 rounded-full flex items-center gap-2 hover:bg-slate-800 text-sm font-semibold transition">
            <Plus className="w-4 h-4" /> Add Campus
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {successMessage && (
        <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <span>{successMessage}</span>
          {lastCreatedBuilding && (
            <div className="flex items-center gap-2 ml-4">
              {!lastCreatedBuilding.latitude && (
                <button onClick={() => { setSuccessMessage(''); setLastCreatedBuilding(null); setPlaceOnMapBuilding(lastCreatedBuilding) }} className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800 transition-colors">
                  <MapPin className="h-3.5 w-3.5" /> Place on Map
                </button>
              )}
              <button onClick={() => { setRoomsBuilding(lastCreatedBuilding); setSuccessMessage(''); setLastCreatedBuilding(null) }} className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 transition-colors">
                <DoorOpen className="h-3.5 w-3.5" /> Add Rooms
              </button>
            </div>
          )}
        </div>
      )}

      <CampusSelector campuses={campuses} selectedCampusId={selectedCampusId} onSelectCampus={setSelectedCampusId} onEditCampus={openEditCampus} onDeleteCampus={(c) => setDeleteCampusConfirm(c)} />

      <InteractiveCampusMap
        campusId={selectedCampusId || undefined}
        mapCenter={mapCenter}
        buildings={buildings.map((b) => ({ id: b.id, name: b.name, code: b.code, latitude: b.latitude, longitude: b.longitude, schoolDivision: b.schoolDivision, school: b.school, polygonCoordinates: (b as any).polygonCoordinates || null }))}
        outdoorSpaces={outdoorMapSpaces}
        schools={schools}
        editable
        quickPlaceMode={placingExistingBuilding ? 'building' : null}
        onQuickPlaceDone={() => setPlacingExistingBuilding(null)}
        onOrgCenterChange={async (lat, lng) => { try { const res = await fetch('/api/settings/campus/map-data', { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ latitude: lat, longitude: lng }) }); if (res.ok) { setSuccessMessage('School center position updated'); setTimeout(() => setSuccessMessage(''), 3000) } } catch { setError('Failed to save school center position') } }}
        onBuildingPositionChange={async (buildingId, lat, lng) => { try { const res = await fetch(`/api/settings/campus/buildings/${buildingId}`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ latitude: lat, longitude: lng }) }); if (res.ok) { setBuildings((prev) => prev.map((b) => (b.id === buildingId ? { ...b, latitude: lat, longitude: lng } : b))); setSuccessMessage('Building position updated'); setTimeout(() => setSuccessMessage(''), 3000) } } catch { setError('Failed to save building position') } }}
        onAddBuildingAtPosition={async (lat, lng) => {
          if (placingExistingBuilding) {
            const building = placingExistingBuilding; setPlacingExistingBuilding(null)
            try { const res = await fetch(`/api/settings/campus/buildings/${building.id}`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ latitude: lat, longitude: lng }) }); if (res.ok) { setBuildings((prev) => prev.map((b) => (b.id === building.id ? { ...b, latitude: lat, longitude: lng } : b))); setSuccessMessage(`"${building.name}" placed on map`) } } catch { setError('Failed to place building on map') }
            await loadData(); return
          }
          setBuildingForm({ name: '', code: '', schoolDivision: 'GLOBAL', buildingType: 'GENERAL' }); setEditingBuilding(null); setBuildingDrawerOpen(true); setPendingBuildingCoords({ lat, lng }); setPendingMarkerData({ lat, lng, label: '', type: 'building' })
        }}
        onAddOutdoorSpaceAtPosition={(lat, lng) => { setOutdoorForm({ name: '', areaType: 'FIELD' }); setEditingOutdoor(null); setOutdoorDrawerOpen(true); setPendingOutdoorCoords({ lat, lng }); setPendingMarkerData({ lat, lng, label: '', type: 'outdoor' }) }}
        onBuildingSelected={setSelectedMapBuildingId}
        onPolygonSaved={async (buildingId, coordinates) => { try { const res = await fetch(`/api/settings/campus/buildings/${buildingId}`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ polygonCoordinates: coordinates }) }); if (res.ok) { setBuildings((prev) => prev.map((b) => (b.id === buildingId ? { ...b, polygonCoordinates: coordinates } as any : b))); setSuccessMessage('Building outline saved'); setTimeout(() => setSuccessMessage(''), 3000) } } catch { setError('Failed to save building outline') } }}
        onOutdoorPositionChange={async (areaId, lat, lng) => { try { const res = await fetch(`/api/settings/campus/areas/${areaId}`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ latitude: lat, longitude: lng }) }); if (res.ok) { setSuccessMessage('Outdoor space position updated'); setTimeout(() => setSuccessMessage(''), 3000) } } catch { setError('Failed to save outdoor space position') } }}
        onEditBuilding={(id) => { const b = buildings.find((x) => x.id === id); if (b) openEditBuilding(b) }}
        onDeleteBuilding={(id) => { const b = buildings.find((x) => x.id === id); if (b) openDeleteConfirm('building', b.id, b.name) }}
        onManageRooms={(id) => { const b = buildings.find((x) => x.id === id); if (b) setRoomsBuilding(b) }}
        onEditOutdoor={(id) => { const a = outdoorSpaces.find((x) => x.id === id); if (a) openEditOutdoor(a) }}
        onDeleteOutdoor={(id) => { const a = outdoorSpaces.find((x) => x.id === id); if (a) openDeleteConfirm('outdoor', a.id, a.name) }}
        pendingMarker={pendingMarkerData}
      />

      <SchoolsManagement campusId={selectedCampusId || undefined} />

      <BuildingsTable buildings={buildings} rooms={rooms} schools={schools} loading={loading} onAddBuilding={openAddBuilding} onEditBuilding={openEditBuilding} onDeleteBuilding={(id, name) => openDeleteConfirm('building', id, name)} onManageRooms={(b) => setRoomsBuilding(b)} />

      <OutdoorSpacesTable outdoorSpaces={outdoorSpaces} loading={loading} onAddOutdoor={openAddOutdoor} onEditOutdoor={openEditOutdoor} onDeleteOutdoor={(id, name) => openDeleteConfirm('outdoor', id, name)} />

      {/* Drawers */}
      <BuildingFormDrawer isOpen={buildingDrawerOpen} onClose={closeBuildingDrawer} editingBuilding={editingBuilding} form={buildingForm} onFormChange={(u) => setBuildingForm((p) => ({ ...p, ...u }))} error={buildingFormError} saving={buildingFormSaving} onSubmit={saveBuildingForm} onImagesChange={editingBuilding ? (imgs) => { setEditingBuilding({ ...editingBuilding, images: imgs }); setBuildings((prev) => prev.map((b) => b.id === editingBuilding.id ? { ...b, images: imgs } : b)) } : undefined} onImageClick={openLightbox} onNameChangeWithCoords={pendingBuildingCoords ? (name) => setPendingMarkerData((prev) => (prev ? { ...prev, label: name } : null)) : undefined} />

      <OutdoorFormDrawer isOpen={outdoorDrawerOpen} onClose={closeOutdoorDrawer} editingOutdoor={editingOutdoor} form={outdoorForm} onFormChange={(u) => setOutdoorForm((p) => ({ ...p, ...u }))} error={outdoorFormError} saving={outdoorFormSaving} onSubmit={saveOutdoorForm} onImagesChange={editingOutdoor ? (imgs) => { setEditingOutdoor({ ...editingOutdoor, images: imgs }); setAreas((prev) => prev.map((a) => a.id === editingOutdoor.id ? { ...a, images: imgs } : a)) } : undefined} onImageClick={openLightbox} onNameChangeWithCoords={pendingOutdoorCoords ? (name) => setPendingMarkerData((prev) => (prev ? { ...prev, label: name } : null)) : undefined} />

      <RoomsDrawer building={roomsBuilding} rooms={buildingRooms} onClose={() => { setRoomsBuilding(null) }} onAddRoom={handleAddRoom} onEditRoom={handleEditRoom} onDeactivateRoom={(id, name) => openDeactivateConfirm('room', id, name)} onRoomImagesChange={(roomId, imgs) => setRooms((prev) => prev.map((r) => r.id === roomId ? { ...r, images: imgs } : r))} onImageClick={openLightbox} />

      <BuildingInfoDrawer buildingId={selectedMapBuildingId} buildings={buildings} rooms={rooms} onClose={() => setSelectedMapBuildingId(null)} onEditBuilding={openEditFromMap} onImageClick={openLightbox} />

      <AddCampusDrawer isOpen={showAddCampusModal} onClose={closeAddCampusModal} form={addCampusForm} onFormChange={(u) => setAddCampusForm((p) => ({ ...p, ...u }))} error={addCampusError} saving={addCampusSaving} onSubmit={saveAddCampusForm} />

      <EditCampusDrawer isOpen={editCampusDrawerOpen} onClose={closeEditCampusDrawer} campus={editingCampus} form={editCampusForm} onFormChange={(u) => setEditCampusForm((p) => ({ ...p, ...u }))} error={editCampusError} saving={editCampusSaving} onSubmit={saveEditCampusForm} />

      {/* Dialogs */}
      <DeleteCampusDialog campus={deleteCampusConfirm} loading={deleteCampusLoading} onConfirm={confirmDeleteCampus} onCancel={() => setDeleteCampusConfirm(null)} />
      <PlaceOnMapDialog building={placeOnMapBuilding} onSkip={() => setPlaceOnMapBuilding(null)} onPlace={(b) => { setPlaceOnMapBuilding(null); setPlacingExistingBuilding(b); const mapEl = document.querySelector('.leaflet-container'); if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' }) }} />
      <EntityDeleteDialog confirm={deleteConfirm} loading={deleteLoading} onDelete={handleDeleteConfirm} onDeactivate={handleDeactivateFromDialog} onCancel={() => setDeleteConfirm(null)} />

      <PhotoLightbox images={lightboxImages} initialIndex={lightboxIndex} isOpen={lightboxOpen} onClose={() => setLightboxOpen(false)} />
    </div>
  )
}
