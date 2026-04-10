'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { MapPin, Loader2, Building2, TreePine } from 'lucide-react'

import type { LatLng, MapBuilding, OutdoorSpace, MapConfig, InteractiveCampusMapProps } from './campus/map-types'
import { loadLeaflet } from './campus/leaflet-loader'
import {
  getBuildingColor,
  getOutdoorColor,
  createBuildingCircleIcon,
  createOutdoorIcon,
  createOrgIcon,
  createPolygonLabel,
} from './campus/map-icons'
import MapToolbar from './campus/MapToolbar'
import MapLegend from './campus/MapLegend'

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function InteractiveCampusMap({
  buildings,
  outdoorSpaces = [],
  schools = [],
  mapCenter: mapCenterProp = null,
  campusId,
  onBuildingPositionChange,
  onAddBuildingAtPosition,
  onAddOutdoorSpaceAtPosition,
  onBuildingSelected,
  onEditBuilding,
  onDeleteBuilding,
  onManageRooms,
  onEditOutdoor,
  onDeleteOutdoor,
  onPolygonSaved,
  onOutdoorPolygonSaved,
  onOrgCenterChange,
  onOutdoorPositionChange,
  editable = true,
  pendingMarker = null,
  quickPlaceMode = null,
  onQuickPlaceDone,
}: InteractiveCampusMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const polygonsRef = useRef<Map<string, any>>(new Map())
  const labelsRef = useRef<Map<string, any>>(new Map())
  const orgMarkerRef = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [mapReady, setMapReady] = useState(0) // increments each time map finishes init
  const [mapConfig, setMapConfig] = useState<MapConfig | null>(null)
  const [placingMode, setPlacingMode] = useState<'unified' | null>(null)
  const [activeLayer, setActiveLayer] = useState<'satellite' | 'street'>('satellite')
  const [pendingMoves, setPendingMoves] = useState<Map<string, { lat: number; lng: number }>>(new Map())
  const [clickPopover, setClickPopover] = useState<{
    position: { x: number; y: number }
    coordinates: { lat: number; lng: number }
  } | null>(null)
  const tileLayersRef = useRef<{ satellite: any; street: any }>({ satellite: null, street: null })
  const pendingMarkerRef = useRef<any>(null)

  // Build a division→color lookup from schools (so buildings without a direct school link still get the right color)
  const schoolColorByDivision = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of schools) {
      if (s.gradeLevel) map[s.gradeLevel] = s.color
    }
    return map
  }, [schools])

  // AI detection state
  const [detectingId, setDetectingId] = useState<string | null>(null)
  const [editingPolygon, setEditingPolygon] = useState<{ buildingId: string; coordinates: LatLng[] } | null>(null)
  const editingPolygonLayerRef = useRef<any>(null)
  const editingVertexMarkersRef = useRef<any[]>([])

  // Manual drawing mode state
  const [drawingMode, setDrawingMode] = useState<{ buildingId: string; points: LatLng[] } | null>(null)
  const drawingMarkersRef = useRef<any[]>([])
  const drawingPolylineRef = useRef<any>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  const orgId = typeof window !== 'undefined' ? localStorage.getItem('org-id') : null

  const getAuthHeaders = () => ({
    Authorization: token ? `Bearer ${token}` : '',
    'X-Organization-ID': orgId || '',
    'Content-Type': 'application/json',
  })

  // Use parent-provided map center if available, otherwise fetch independently
  useEffect(() => {
    if (mapCenterProp) {
      setMapConfig({
        center: { lat: mapCenterProp.lat, lng: mapCenterProp.lng },
        address: mapCenterProp.address,
        orgName: mapCenterProp.name,
      })
      return
    }
    if (!token) return
    const url = campusId
      ? `/api/settings/campus/map-data?campusId=${campusId}`
      : '/api/settings/campus/map-data'
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.data?.org) {
          setMapConfig({
            center: { lat: data.data.org.lat || 33.4936, lng: data.data.org.lng || -117.0892 },
            address: data.data.org.address,
            orgName: data.data.org.name,
          })
        }
      })
      .catch(() => {})
  }, [mapCenterProp, token, campusId])

  // Initialize map
  useEffect(() => {
    if (!mapConfig || !mapContainerRef.current) return

    // Reset loading on every map init (including campus switches)
    setLoading(true)

    let cancelled = false

    loadLeaflet().then(() => {
      if (cancelled || !mapContainerRef.current) return
      const L = (window as any).L

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
      }

      // Create a bounding box around the campus center (~0.5 mile radius)
      // This prevents users from panning away from campus
      const CAMPUS_RADIUS = 0.006 // ~0.4 miles in degrees (generous for most campuses)
      const campusBounds = L.latLngBounds(
        [mapConfig.center.lat - CAMPUS_RADIUS, mapConfig.center.lng - CAMPUS_RADIUS],
        [mapConfig.center.lat + CAMPUS_RADIUS, mapConfig.center.lng + CAMPUS_RADIUS]
      )

      const map = L.map(mapContainerRef.current, {
        center: [mapConfig.center.lat, mapConfig.center.lng],
        zoom: 17,
        minZoom: 15,       // Can't zoom out further than neighborhood level
        maxZoom: 18,       // Esri satellite has no data beyond ~18 in most areas
        maxBounds: campusBounds,
        maxBoundsViscosity: 0.8, // Gentle elastic bounce when hitting edge
        zoomControl: false,
        attributionControl: false,
      })

      const satellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 18 }
      )

      const street = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 18 }
      )

      const labels = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 18, opacity: 0.7 }
      )

      satellite.addTo(map)
      labels.addTo(map)

      tileLayersRef.current = { satellite, street }
      mapInstanceRef.current = map

      // Fix container size so tiles load at the correct dimensions.
      // Without this, Leaflet may see a 0x0 or partially-laid-out
      // container and request the wrong tiles (grey map).
      // A single rAF isn't enough when the container starts hidden
      // (e.g. inside a CSS `hidden` tab), so we also use a
      // ResizeObserver to catch when the container actually gains size.
      requestAnimationFrame(() => {
        if (!cancelled && map) map.invalidateSize()
      })

      const container = mapContainerRef.current
      if (container) {
        const ro = new ResizeObserver(() => {
          if (!cancelled && map && container.clientWidth > 0) {
            map.invalidateSize()
          }
        })
        ro.observe(container)
        // Store for cleanup
        ;(map as any)._resizeObserver = ro
      }

      // Org center marker — DRAGGABLE
      const orgMarker = L.marker([mapConfig.center.lat, mapConfig.center.lng], {
        icon: createOrgIcon(L),
        draggable: editable,
        zIndexOffset: 500,
      }).addTo(map)

      orgMarker.bindPopup(
        `<strong>${mapConfig.orgName}</strong><br/>${mapConfig.address || ''}` +
        (editable ? '<br/><span style="color:#dc2626;font-size:11px;">Drag to reposition center</span>' : '')
      )

      if (editable) {
        orgMarker.on('dragend', (e: any) => {
          const latlng = e.target.getLatLng()
          if (onOrgCenterChange) {
            onOrgCenterChange(latlng.lat, latlng.lng)
          }
        })
      }
      orgMarkerRef.current = orgMarker

      // Wait for satellite tiles to load, then signal map is ready.
      // Don't set loading=false here — the building sync effect will
      // do that after placing markers, so the spinner covers the full
      // init cycle (tiles + markers) with zero flashes.
      let revealed = false
      const reveal = () => {
        if (cancelled || revealed) return
        revealed = true
        map.invalidateSize()
        setMapReady(n => n + 1)
      }

      // If tiles are already cached, the 'load' event may have fired
      // before we attached the listener. Check if tiles are loaded.
      if (satellite.isLoading && !satellite.isLoading()) {
        reveal()
      } else {
        satellite.once('load', reveal)
      }

      // Fallback: reveal after 1.5s even if tiles are slow
      setTimeout(reveal, 1500)
    })

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        const ro = (mapInstanceRef.current as any)._resizeObserver as ResizeObserver | undefined
        if (ro) ro.disconnect()
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
      markersRef.current.clear()
      polygonsRef.current.clear()
      labelsRef.current.clear()
      orgMarkerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapConfig])

  /* ── Add building as polygon overlay ─────────────────────────────── */

  const addBuildingPolygon = useCallback((L: any, map: any, building: MapBuilding, color: string) => {
    if (!building.polygonCoordinates || building.polygonCoordinates.length < 3) return

    const coords = building.polygonCoordinates.map((p: LatLng) => [p.lat, p.lng])

    const polygon = L.polygon(coords, {
      color: color,
      weight: 2,
      opacity: 0.9,
      fillColor: color,
      fillOpacity: 0.25,
      className: 'campus-building-polygon',
    }).addTo(map)

    polygon.bindTooltip(building.name, {
      sticky: true,
      className: 'campus-tooltip',
      direction: 'top',
      offset: [0, -10],
    })

    polygon.on('click', () => {
      if (onBuildingSelected) onBuildingSelected(building.id)
    })

    polygonsRef.current.set(building.id, polygon)

    const center = polygon.getBounds().getCenter()
    const label = L.marker(center, {
      icon: createPolygonLabel(L, building.code || building.name, color),
      interactive: false,
    }).addTo(map)
    labelsRef.current.set(building.id, label)
  }, [onBuildingSelected])

  /* ── Add building as marker (no polygon yet) ─────────────────────── */

  const addBuildingMarker = useCallback((L: any, map: any, building: MapBuilding, color: string) => {
    if (!building.latitude || !building.longitude) return

    const marker = L.marker([building.latitude, building.longitude], {
      icon: createBuildingCircleIcon(L, building.code || building.name, color),
      draggable: editable,
      zIndexOffset: 100,
    }).addTo(map)

    // Build popup with action menu
    const popupContent = document.createElement('div')
    popupContent.style.minWidth = '140px'
    popupContent.innerHTML = `
      <strong style="font-size: 13px; line-height: 1.3;">${building.name}</strong>
      ${building.code ? `<br/><span style="color: #6a6864; font-size: 11px;">${building.code}</span>` : ''}
      ${editable ? '<span style="color: #a8a49d; font-size: 10px; margin-top: 1px; display: block;">Drag to reposition</span>' : ''}
    `

    {
      const menuContainer = document.createElement('div')
      menuContainer.style.cssText = 'margin-top:6px;border-top:1px solid #eae8e2;padding-top:2px;display:flex;flex-direction:column;'

      const menuItemStyle = 'display:flex;align-items:center;gap:6px;padding:6px 2px;border:none;background:none;width:100%;text-align:left;font-size:12px;color:#3d3b35;cursor:pointer;border-radius:4px;'
      const menuItemHover = 'background:#f5f4f0;'

      // View Details (always visible)
      if (onBuildingSelected) {
        const viewBtn = document.createElement('button')
        viewBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg> View Details`
        viewBtn.style.cssText = menuItemStyle
        viewBtn.onmouseover = () => { viewBtn.style.cssText = menuItemStyle + menuItemHover }
        viewBtn.onmouseout = () => { viewBtn.style.cssText = menuItemStyle }
        viewBtn.onclick = (e) => { e.stopPropagation(); marker.closePopup(); onBuildingSelected(building.id) }
        menuContainer.appendChild(viewBtn)
      }

      // Edit Building (only in edit mode)
      if (editable && onEditBuilding) {
        const editBtn = document.createElement('button')
        editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg> Edit Building`
        editBtn.style.cssText = menuItemStyle
        editBtn.onmouseover = () => { editBtn.style.cssText = menuItemStyle + menuItemHover }
        editBtn.onmouseout = () => { editBtn.style.cssText = menuItemStyle }
        editBtn.onclick = (e) => { e.stopPropagation(); marker.closePopup(); onEditBuilding(building.id) }
        menuContainer.appendChild(editBtn)
      }

      // Add Rooms (only in edit mode)
      if (editable && onManageRooms) {
        const roomsBtn = document.createElement('button')
        roomsBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12v.01"/><path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z"/></svg> Manage Rooms`
        roomsBtn.style.cssText = menuItemStyle
        roomsBtn.onmouseover = () => { roomsBtn.style.cssText = menuItemStyle + menuItemHover }
        roomsBtn.onmouseout = () => { roomsBtn.style.cssText = menuItemStyle }
        roomsBtn.onclick = (e) => { e.stopPropagation(); marker.closePopup(); onManageRooms(building.id) }
        menuContainer.appendChild(roomsBtn)
      }

      // Delete Building (only in edit mode)
      if (editable && onDeleteBuilding) {
        const deleteBtn = document.createElement('button')
        deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg> Delete`
        deleteBtn.style.cssText = menuItemStyle + 'color:#dc2626;margin-top:2px;border-top:1px solid #eae8e2;padding-top:6px;border-radius:0 0 4px 4px;'
        deleteBtn.onmouseover = () => { deleteBtn.style.cssText = menuItemStyle + 'color:#dc2626;margin-top:2px;border-top:1px solid #eae8e2;padding-top:6px;border-radius:0 0 4px 4px;background:#fef2f2;' }
        deleteBtn.onmouseout = () => { deleteBtn.style.cssText = menuItemStyle + 'color:#dc2626;margin-top:2px;border-top:1px solid #eae8e2;padding-top:6px;border-radius:0 0 4px 4px;' }
        deleteBtn.onclick = (e) => { e.stopPropagation(); marker.closePopup(); onDeleteBuilding(building.id) }
        menuContainer.appendChild(deleteBtn)
      }

      popupContent.appendChild(menuContainer)
    }

    marker.bindPopup(popupContent, { closeButton: false, autoPan: true, autoPanPadding: [20, 20] })

    // Open popup on click (works on both desktop and mobile)
    marker.on('click', () => {
      marker.openPopup()
    })

    if (editable) {
      marker.on('dragend', (e: any) => {
        const latlng = e.target.getLatLng()
        setPendingMoves((prev) => {
          const updated = new Map(prev)
          updated.set(building.id, { lat: latlng.lat, lng: latlng.lng })
          return updated
        })
      })
    }

    markersRef.current.set(building.id, marker)
  }, [editable, onEditBuilding, onDeleteBuilding, onManageRooms])

  /* ── Add outdoor space as polygon ────────────────────────────────── */

  const addOutdoorPolygon = useCallback((L: any, map: any, space: OutdoorSpace, color: string) => {
    if (!space.polygonCoordinates || space.polygonCoordinates.length < 3) return

    const coords = space.polygonCoordinates.map((p: LatLng) => [p.lat, p.lng])

    const polygon = L.polygon(coords, {
      color: color,
      weight: 2,
      opacity: 0.8,
      fillColor: color,
      fillOpacity: 0.15,
      dashArray: '4 3',
    }).addTo(map)

    polygon.bindTooltip(space.name, {
      sticky: true,
      direction: 'top',
      offset: [0, -10],
    })

    polygonsRef.current.set(`outdoor-${space.id}`, polygon)

    const center = polygon.getBounds().getCenter()
    const label = L.marker(center, {
      icon: createPolygonLabel(L, space.name, color),
      interactive: false,
    }).addTo(map)
    labelsRef.current.set(`outdoor-${space.id}`, label)
  }, [])

  /* ── Add outdoor space as marker ─────────────────────────────────── */

  const addOutdoorMarker = useCallback((L: any, map: any, space: OutdoorSpace, color: string) => {
    if (!space.lat || !space.lng) return

    const marker = L.marker([space.lat, space.lng], {
      icon: createOutdoorIcon(L, space.name, space.areaType, color),
      draggable: editable,
      zIndexOffset: 50,
    }).addTo(map)

    // Build outdoor popup with action menu
    const outdoorPopup = document.createElement('div')
    outdoorPopup.style.minWidth = '140px'
    outdoorPopup.innerHTML = `
      <strong style="font-size: 13px; line-height: 1.3;">${space.name}</strong>
      <br/><span style="color: #6a6864; font-size: 11px;">${space.areaType.replace('_', ' ')}</span>
      ${editable ? '<span style="color: #a8a49d; font-size: 10px; margin-top: 1px; display: block;">Drag to reposition</span>' : ''}
    `

    if (editable) {
      const menuContainer = document.createElement('div')
      menuContainer.style.cssText = 'margin-top:6px;border-top:1px solid #eae8e2;padding-top:2px;display:flex;flex-direction:column;'

      const menuItemStyle = 'display:flex;align-items:center;gap:6px;padding:6px 2px;border:none;background:none;width:100%;text-align:left;font-size:12px;color:#3d3b35;cursor:pointer;border-radius:4px;'
      const menuItemHover = 'background:#f5f4f0;'

      if (onEditOutdoor) {
        const editBtn = document.createElement('button')
        editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg> Edit Space`
        editBtn.style.cssText = menuItemStyle
        editBtn.onmouseover = () => { editBtn.style.cssText = menuItemStyle + menuItemHover }
        editBtn.onmouseout = () => { editBtn.style.cssText = menuItemStyle }
        editBtn.onclick = (e) => { e.stopPropagation(); marker.closePopup(); onEditOutdoor(space.id) }
        menuContainer.appendChild(editBtn)
      }

      if (onDeleteOutdoor) {
        const deleteBtn = document.createElement('button')
        deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg> Delete`
        deleteBtn.style.cssText = menuItemStyle + 'color:#dc2626;margin-top:2px;border-top:1px solid #eae8e2;padding-top:6px;border-radius:0 0 4px 4px;'
        deleteBtn.onmouseover = () => { deleteBtn.style.cssText = menuItemStyle + 'color:#dc2626;margin-top:2px;border-top:1px solid #eae8e2;padding-top:6px;border-radius:0 0 4px 4px;background:#fef2f2;' }
        deleteBtn.onmouseout = () => { deleteBtn.style.cssText = menuItemStyle + 'color:#dc2626;margin-top:2px;border-top:1px solid #eae8e2;padding-top:6px;border-radius:0 0 4px 4px;' }
        deleteBtn.onclick = (e) => { e.stopPropagation(); marker.closePopup(); onDeleteOutdoor(space.id) }
        menuContainer.appendChild(deleteBtn)
      }

      outdoorPopup.appendChild(menuContainer)
    }

    marker.bindPopup(outdoorPopup, { closeButton: false, autoPan: true, autoPanPadding: [20, 20] })

    // Open popup on click (works on both desktop and mobile)
    marker.on('click', () => {
      marker.openPopup()
    })

    if (editable) {
      marker.on('dragend', (e: any) => {
        const latlng = e.target.getLatLng()
        if (onOutdoorPositionChange) {
          onOutdoorPositionChange(space.id, latlng.lat, latlng.lng)
        }
      })
    }

    markersRef.current.set(`outdoor-${space.id}`, marker)
  }, [editable, onOutdoorPositionChange, onEditOutdoor, onDeleteOutdoor])

  /* ── Manual polygon drawing ──────────────────────────────────────── */

  const startDrawing = (buildingId: string) => {
    setDrawingMode({ buildingId, points: [] })
    const map = mapInstanceRef.current
    if (map) {
      map.getContainer().style.cursor = 'crosshair'
    }
  }

  const clearDrawingMode = () => {
    const map = mapInstanceRef.current
    if (map) {
      map.getContainer().style.cursor = ''
    }
    drawingMarkersRef.current.forEach((m) => {
      if (map) map.removeLayer(m)
    })
    drawingMarkersRef.current = []
    if (drawingPolylineRef.current && map) {
      map.removeLayer(drawingPolylineRef.current)
    }
    drawingPolylineRef.current = null
    setDrawingMode(null)
  }

  const finishDrawing = () => {
    if (!drawingMode || drawingMode.points.length < 3) return
    showEditablePolygon(drawingMode.points)
    setEditingPolygon({ buildingId: drawingMode.buildingId, coordinates: drawingMode.points })
    clearDrawingMode()
  }

  const undoDrawingPoint = () => {
    if (!drawingMode || drawingMode.points.length === 0) return
    const map = mapInstanceRef.current
    const L = (window as any).L
    if (!L || !map) return

    // Remove last marker
    if (drawingMarkersRef.current.length > 0) {
      const lastMarker = drawingMarkersRef.current.pop()
      map.removeLayer(lastMarker)
    }

    // Update points
    const newPoints = drawingMode.points.slice(0, -1)
    setDrawingMode({ ...drawingMode, points: newPoints })

    // Redraw polyline
    if (drawingPolylineRef.current) {
      map.removeLayer(drawingPolylineRef.current)
      drawingPolylineRef.current = null
    }

    if (newPoints.length >= 2) {
      const polylineCoords = newPoints.map((p) => [p.lat, p.lng])
      const polyline = L.polyline(polylineCoords, {
        color: '#0891b2',
        weight: 2,
        opacity: 0.8,
      }).addTo(map)
      drawingPolylineRef.current = polyline
    }
  }

  /* ── AI outline detection ────────────────────────────────────────── */

  const handleDetectOutline = async (buildingId: string) => {
    setDetectingId(buildingId)
    try {
      const res = await fetch(`/api/settings/campus/buildings/${buildingId}/detect-outline`, {
        method: 'POST',
        headers: getAuthHeaders(),
      })
      const json = await res.json()

      if (json.ok && json.data?.coordinates?.length >= 3) {
        setEditingPolygon({ buildingId, coordinates: json.data.coordinates })
        showEditablePolygon(json.data.coordinates)
      } else {
        alert(json.error?.message || 'Could not detect the building outline. Try repositioning the marker closer to the building center.')
      }
    } catch {
      alert('Failed to detect building outline. Please try again.')
    } finally {
      setDetectingId(null)
    }
  }

  /* ── Show editable polygon with draggable vertices ───────────────── */

  const showEditablePolygon = (coordinates: LatLng[]) => {
    const L = (window as any).L
    const map = mapInstanceRef.current
    if (!L || !map) return

    clearEditingPolygon()

    const coords = coordinates.map((p) => [p.lat, p.lng])

    const polygon = L.polygon(coords, {
      color: '#f59e0b',
      weight: 3,
      opacity: 0.9,
      fillColor: '#f59e0b',
      fillOpacity: 0.2,
      dashArray: '6 4',
    }).addTo(map)

    editingPolygonLayerRef.current = polygon

    const vertexMarkers: any[] = []
    coordinates.forEach((coord) => {
      const vertexIcon = L.divIcon({
        className: 'polygon-vertex',
        html: `<div style="
          width: 12px; height: 12px; border-radius: 50%;
          background: white; border: 3px solid #f59e0b;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          cursor: grab; transform: translate(-6px, -6px);
        "></div>`,
        iconSize: [0, 0],
      })

      const vertexMarker = L.marker([coord.lat, coord.lng], {
        icon: vertexIcon,
        draggable: true,
        zIndexOffset: 1000,
      }).addTo(map)

      vertexMarker.on('drag', () => {
        const newCoords = vertexMarkers.map((vm) => vm.getLatLng())
        polygon.setLatLngs(newCoords)

        setEditingPolygon((prev) => {
          if (!prev) return prev
          const updated = vertexMarkers.map((vm) => {
            const ll = vm.getLatLng()
            return { lat: ll.lat, lng: ll.lng }
          })
          return { ...prev, coordinates: updated }
        })
      })

      vertexMarkers.push(vertexMarker)
    })

    editingVertexMarkersRef.current = vertexMarkers
    map.fitBounds(polygon.getBounds(), { padding: [60, 60], maxZoom: 18 })
  }

  const clearEditingPolygon = () => {
    const map = mapInstanceRef.current
    if (!map) return

    if (editingPolygonLayerRef.current) {
      map.removeLayer(editingPolygonLayerRef.current)
      editingPolygonLayerRef.current = null
    }
    editingVertexMarkersRef.current.forEach((m) => map.removeLayer(m))
    editingVertexMarkersRef.current = []

    // Also clear drawing mode if active
    if (drawingMode) {
      clearDrawingMode()
    }
  }

  const handleSavePolygon = async () => {
    if (!editingPolygon || !onPolygonSaved) return
    onPolygonSaved(editingPolygon.buildingId, editingPolygon.coordinates)
    clearEditingPolygon()

    const L = (window as any).L
    const map = mapInstanceRef.current
    if (L && map) {
      const marker = markersRef.current.get(editingPolygon.buildingId)
      if (marker) {
        map.removeLayer(marker)
        markersRef.current.delete(editingPolygon.buildingId)
      }

      const building = buildings.find((b) => b.id === editingPolygon.buildingId)
      if (building) {
        addBuildingPolygon(L, map, { ...building, polygonCoordinates: editingPolygon.coordinates }, getBuildingColor(building, schoolColorByDivision))
      }
    }

    setEditingPolygon(null)
  }

  const handleCancelPolygon = () => {
    clearEditingPolygon()
    setEditingPolygon(null)
  }

  /* ── Drawing mode clicks ─────────────────────────────────────────── */

  useEffect(() => {
    const map = mapInstanceRef.current
    const L = (window as any).L
    if (!L || !map || !drawingMode) return

    const handleDrawingClick = (e: any) => {
      const newPoint: LatLng = { lat: e.latlng.lat, lng: e.latlng.lng }
      const updatedPoints = [...drawingMode.points, newPoint]
      setDrawingMode({ ...drawingMode, points: updatedPoints })

      // Add vertex marker
      const vertexIcon = L.divIcon({
        className: 'drawing-vertex-marker',
        html: `<div style="
          width: 10px; height: 10px; border-radius: 50%;
          background: white; border: 2px solid #0891b2;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          transform: translate(-5px, -5px);
        "></div>`,
        iconSize: [0, 0],
      })

      const vertexMarker = L.marker([newPoint.lat, newPoint.lng], {
        icon: vertexIcon,
        zIndexOffset: 500,
      }).addTo(map)
      drawingMarkersRef.current.push(vertexMarker)

      // Update or create polyline
      if (drawingPolylineRef.current) {
        map.removeLayer(drawingPolylineRef.current)
      }

      const polylineCoords = updatedPoints.map((p) => [p.lat, p.lng])
      const polyline = L.polyline(polylineCoords, {
        color: '#0891b2',
        weight: 2,
        opacity: 0.8,
      }).addTo(map)
      drawingPolylineRef.current = polyline

      // If 3+ points, add semi-transparent polygon
      if (updatedPoints.length >= 3) {
        // Check if polygon already exists and remove it
        if (editingPolygonLayerRef.current) {
          map.removeLayer(editingPolygonLayerRef.current)
        }

        const polygonCoords = [...polylineCoords, polylineCoords[0]] // Close the polygon
        const polygon = L.polygon(polygonCoords, {
          color: '#0891b2',
          weight: 2,
          opacity: 0.6,
          fillColor: '#0891b2',
          fillOpacity: 0.15,
          dashArray: '4 3',
        }).addTo(map)
        editingPolygonLayerRef.current = polygon
      }
    }

    map.on('click', handleDrawingClick)

    return () => {
      map.off('click', handleDrawingClick)
    }
  }, [drawingMode])

  /* ── Placing mode clicks ─────────────────────────────────────────── */

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !placingMode) return

    const handleClick = (e: any) => {
      const containerPoint = map.latLngToContainerPoint(e.latlng)
      setClickPopover({
        position: { x: containerPoint.x, y: containerPoint.y },
        coordinates: { lat: e.latlng.lat, lng: e.latlng.lng }
      })
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePopover()
      }
    }

    map.on('click', handleClick)
    document.addEventListener('keydown', handleEscape)
    map.getContainer().style.cursor = 'crosshair'

    return () => {
      map.off('click', handleClick)
      document.removeEventListener('keydown', handleEscape)
      map.getContainer().style.cursor = ''
    }
  }, [placingMode])

  /* ── Quick-place mode (external trigger, no popover) ───────────── */

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !quickPlaceMode) return

    const handleClick = (e: any) => {
      if (quickPlaceMode === 'building' && onAddBuildingAtPosition) {
        onAddBuildingAtPosition(e.latlng.lat, e.latlng.lng)
      } else if (quickPlaceMode === 'outdoor' && onAddOutdoorSpaceAtPosition) {
        onAddOutdoorSpaceAtPosition(e.latlng.lat, e.latlng.lng)
      }
      if (onQuickPlaceDone) onQuickPlaceDone()
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onQuickPlaceDone) onQuickPlaceDone()
    }

    map.on('click', handleClick)
    document.addEventListener('keydown', handleEscape)
    map.getContainer().style.cursor = 'crosshair'

    return () => {
      map.off('click', handleClick)
      document.removeEventListener('keydown', handleEscape)
      map.getContainer().style.cursor = ''
    }
  }, [quickPlaceMode, onAddBuildingAtPosition, onAddOutdoorSpaceAtPosition, onQuickPlaceDone])

  const handlePopoverSelectBuilding = () => {
    if (clickPopover && onAddBuildingAtPosition) {
      onAddBuildingAtPosition(clickPopover.coordinates.lat, clickPopover.coordinates.lng)
    }
    setClickPopover(null)
    setPlacingMode(null)
  }

  const handlePopoverSelectOutdoor = () => {
    if (clickPopover && onAddOutdoorSpaceAtPosition) {
      onAddOutdoorSpaceAtPosition(clickPopover.coordinates.lat, clickPopover.coordinates.lng)
    }
    setClickPopover(null)
    setPlacingMode(null)
  }

  const closePopover = () => {
    setClickPopover(null)
    setPlacingMode(null)
  }

  // Re-render all buildings when they change (handles updates like color changes)
  useEffect(() => {
    const L = (window as any).L
    const map = mapInstanceRef.current
    if (!L || !map) return

    // Clear existing building markers and polygons (not outdoor)
    markersRef.current.forEach((marker, key) => {
      if (!key.startsWith('outdoor-')) {
        map.removeLayer(marker)
      }
    })
    for (const key of markersRef.current.keys()) {
      if (!key.startsWith('outdoor-')) markersRef.current.delete(key)
    }

    polygonsRef.current.forEach((polygon, key) => {
      if (!key.startsWith('outdoor-')) {
        map.removeLayer(polygon)
      }
    })
    for (const key of polygonsRef.current.keys()) {
      if (!key.startsWith('outdoor-')) polygonsRef.current.delete(key)
    }

    labelsRef.current.forEach((label, key) => {
      if (!key.startsWith('outdoor-')) {
        map.removeLayer(label)
      }
    })
    for (const key of labelsRef.current.keys()) {
      if (!key.startsWith('outdoor-')) labelsRef.current.delete(key)
    }

    // Re-add all buildings
    buildings.forEach((b) => {
      if (b.latitude && b.longitude) {
        const color = getBuildingColor(b, schoolColorByDivision)
        if (b.polygonCoordinates && b.polygonCoordinates.length >= 3) {
          addBuildingPolygon(L, map, b, color)
        } else {
          addBuildingMarker(L, map, b, color)
        }
      }
    })

    // Buildings are placed — drop the loading spinner
    setLoading(false)
  }, [buildings, addBuildingMarker, addBuildingPolygon, schoolColorByDivision, mapReady])

  // Re-render all outdoor spaces when they change
  useEffect(() => {
    const L = (window as any).L
    const map = mapInstanceRef.current
    if (!L || !map) return

    // Clear existing outdoor markers and polygons
    markersRef.current.forEach((marker, key) => {
      if (key.startsWith('outdoor-')) {
        map.removeLayer(marker)
      }
    })
    for (const key of markersRef.current.keys()) {
      if (key.startsWith('outdoor-')) markersRef.current.delete(key)
    }

    polygonsRef.current.forEach((polygon, key) => {
      if (key.startsWith('outdoor-')) {
        map.removeLayer(polygon)
      }
    })
    for (const key of polygonsRef.current.keys()) {
      if (key.startsWith('outdoor-')) polygonsRef.current.delete(key)
    }

    labelsRef.current.forEach((label, key) => {
      if (key.startsWith('outdoor-')) {
        map.removeLayer(label)
      }
    })
    for (const key of labelsRef.current.keys()) {
      if (key.startsWith('outdoor-')) labelsRef.current.delete(key)
    }

    // Re-add all outdoor spaces
    outdoorSpaces.forEach((space) => {
      if (space.lat && space.lng) {
        const color = getOutdoorColor(space)
        if (space.polygonCoordinates && space.polygonCoordinates.length >= 3) {
          addOutdoorPolygon(L, map, space, color)
        } else {
          addOutdoorMarker(L, map, space, color)
        }
      }
    })
  }, [outdoorSpaces, addOutdoorMarker, addOutdoorPolygon, mapReady])

  // Handle pending marker (marker shown while user fills in form)
  useEffect(() => {
    const L = (window as any).L
    const map = mapInstanceRef.current
    if (!L || !map) return

    // Remove existing pending marker
    if (pendingMarkerRef.current) {
      map.removeLayer(pendingMarkerRef.current)
      pendingMarkerRef.current = null
    }

    if (!pendingMarker) return

    const icon = L.divIcon({
      className: 'pending-placement-marker',
      html: `
        <div style="
          display: flex; align-items: center; justify-content: center;
          transform: translate(-50%, -50%);
          opacity: 0.7;
        ">
          <div style="
            display: flex; align-items: center; justify-content: center;
            width: 30px; height: 30px; border-radius: 50%;
            background: ${pendingMarker.type === 'building' ? '#3b82f6' : '#16a34a'};
            border: 3px dashed white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ">
            ${pendingMarker.type === 'building'
              ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22V12h6v10"/></svg>'
              : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M17 14v6m-3-3h6M6 3v12"/></svg>'
            }
          </div>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    })

    const marker = L.marker([pendingMarker.lat, pendingMarker.lng], {
      icon,
      zIndexOffset: 200,
      interactive: false,
    }).addTo(map)

    pendingMarkerRef.current = marker
  }, [pendingMarker])

  const toggleLayer = () => {
    const map = mapInstanceRef.current
    if (!map) return

    const { satellite, street } = tileLayersRef.current
    if (activeLayer === 'satellite') {
      map.removeLayer(satellite)
      street.addTo(map)
      setActiveLayer('street')
    } else {
      map.removeLayer(street)
      satellite.addTo(map)
      setActiveLayer('satellite')
    }
  }

  const handleSavePositions = async () => {
    if (pendingMoves.size === 0) return
    for (const [buildingId, coords] of pendingMoves.entries()) {
      if (onBuildingPositionChange) {
        onBuildingPositionChange(buildingId, coords.lat, coords.lng)
      }
    }
    setPendingMoves(new Map())
  }

  const fitAllMarkers = () => {
    const map = mapInstanceRef.current
    if (!map) return
    const L = (window as any).L

    const points: [number, number][] = []
    if (mapConfig) {
      points.push([mapConfig.center.lat, mapConfig.center.lng])
    }
    buildings.forEach((b) => {
      if (b.latitude && b.longitude) {
        points.push([b.latitude, b.longitude])
      }
    })
    outdoorSpaces.forEach((s) => {
      if (s.lat && s.lng) {
        points.push([s.lat, s.lng])
      }
    })

    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] })
    }
  }

  // No address yet
  if (!mapConfig && !loading) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
        <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">
          Add a school address in <span className="font-medium">School Information</span> to see your campus on the map.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      {/* Header bar */}
      <MapToolbar
        mapAddress={mapConfig?.address ?? null}
        editable={editable}
        drawingMode={drawingMode}
        onFinishDrawing={finishDrawing}
        onUndoDrawingPoint={undoDrawingPoint}
        onClearDrawingMode={clearDrawingMode}
        editingPolygon={editingPolygon}
        onSavePolygon={handleSavePolygon}
        onCancelPolygon={handleCancelPolygon}
        detectingId={detectingId}
        pendingMovesCount={pendingMoves.size}
        onSavePositions={handleSavePositions}
        placingMode={placingMode}
        onTogglePlacingMode={() => {
          if (placingMode) {
            setPlacingMode(null)
            setClickPopover(null)
          } else {
            setPlacingMode('unified')
          }
        }}
        canPlace={!!(onAddBuildingAtPosition || onAddOutdoorSpaceAtPosition)}
        onFitAllMarkers={fitAllMarkers}
      />

      {/* Map container */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-dropdown flex items-center justify-center bg-slate-100">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        )}
        <div
          ref={mapContainerRef}
          style={{ height: 500, width: '100%', position: 'relative', zIndex: 0 }}
        />

        {/* Custom zoom controls */}
        {!loading && mapInstanceRef.current && (
          <div className="absolute top-3 right-3 z-dropdown flex flex-col gap-0 rounded-lg border border-slate-200 bg-white shadow-md overflow-hidden">
            <button
              type="button"
              onClick={() => mapInstanceRef.current?.zoomIn()}
              className="px-2.5 py-2 min-h-[44px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition border-b border-slate-200"
              aria-label="Zoom in"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => mapInstanceRef.current?.zoomOut()}
              className="px-2.5 py-2 min-h-[44px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
              aria-label="Zoom out"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        )}

        {/* Placement type popover */}
        {clickPopover && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(Math.max(clickPopover.position.x, 10), (mapContainerRef.current?.clientWidth || 300) - 180),
              top: Math.max(clickPopover.position.y - 80, 10),
              zIndex: 1000,
            }}
            className="bg-white rounded-xl shadow-xl border border-slate-200 p-3 min-w-[160px]"
          >
            <p className="text-xs font-semibold text-slate-500 mb-2 text-center">What is this?</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handlePopoverSelectBuilding}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-50 rounded-lg hover:bg-primary-50 hover:text-primary-700 transition-colors"
              >
                <Building2 className="w-4 h-4" />
                Building
              </button>
              <button
                onClick={handlePopoverSelectOutdoor}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-50 rounded-lg hover:bg-green-50 hover:text-green-700 transition-colors"
              >
                <TreePine className="w-4 h-4" />
                Outdoor Space
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <MapLegend
        buildings={buildings}
        outdoorSpaces={outdoorSpaces}
        schools={schools}
      />

      {/* Status bar */}
      {(editingPolygon || placingMode || drawingMode || clickPopover || quickPlaceMode) && (
        <div className="px-4 py-2 border-t border-slate-200 bg-amber-50 text-xs text-amber-700 font-medium">
          {drawingMode && 'Click on the map to place outline points. Place at least 3 points, then click Done.'}
          {editingPolygon && !drawingMode && 'Drag vertices to adjust the outline, then save'}
          {placingMode && !clickPopover && 'Click anywhere on the map to place a building or outdoor space'}
          {clickPopover && 'Select what you placed — Building or Outdoor Space'}
          {quickPlaceMode && 'Click on the map to place the building. Press Escape to cancel.'}
        </div>
      )}
    </div>
  )
}
