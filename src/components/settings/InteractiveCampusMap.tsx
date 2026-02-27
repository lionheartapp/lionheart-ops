'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { MapPin, Loader2, Plus, Save, Layers, Maximize2, Sparkles, X, Check, TreePine } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LatLng {
  lat: number
  lng: number
}

interface Building {
  id: string
  name: string
  code: string | null
  latitude: number | null
  longitude: number | null
  schoolDivision?: string
  polygonCoordinates?: LatLng[] | null
}

interface OutdoorSpace {
  id: string
  name: string
  areaType: string
  lat: number | null
  lng: number | null
  polygonCoordinates?: LatLng[] | null
}

interface MapConfig {
  center: { lat: number; lng: number }
  address: string | null
  orgName: string
}

interface InteractiveCampusMapProps {
  buildings: Building[]
  outdoorSpaces?: OutdoorSpace[]
  onBuildingPositionChange?: (buildingId: string, lat: number, lng: number) => void
  onAddBuildingAtPosition?: (lat: number, lng: number) => void
  onAddOutdoorSpaceAtPosition?: (lat: number, lng: number) => void
  onBuildingSelected?: (buildingId: string) => void
  onPolygonSaved?: (buildingId: string, coordinates: LatLng[]) => void
  onOutdoorPolygonSaved?: (areaId: string, coordinates: LatLng[]) => void
  onOrgCenterChange?: (lat: number, lng: number) => void
  onOutdoorPositionChange?: (areaId: string, lat: number, lng: number) => void
  editable?: boolean
}

/* ------------------------------------------------------------------ */
/*  Leaflet CDN loader                                                 */
/* ------------------------------------------------------------------ */

let leafletLoaded = false
let leafletPromise: Promise<void> | null = null

function loadLeaflet(): Promise<void> {
  if (leafletLoaded && (window as any).L) return Promise.resolve()
  if (leafletPromise) return leafletPromise

  leafletPromise = new Promise<void>((resolve, reject) => {
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      link.crossOrigin = ''
      document.head.appendChild(link)
    }

    if ((window as any).L) {
      leafletLoaded = true
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.crossOrigin = ''
    script.onload = () => {
      leafletLoaded = true
      resolve()
    }
    script.onerror = reject
    document.head.appendChild(script)
  })

  return leafletPromise
}

/* ------------------------------------------------------------------ */
/*  Division-based color mapping                                       */
/* ------------------------------------------------------------------ */

const DIVISION_COLORS: Record<string, string> = {
  ELEMENTARY: '#7c3aed',   // Purple
  MIDDLE_SCHOOL: '#0891b2', // Cyan
  HIGH_SCHOOL: '#dc2626',   // Red
  GLOBAL: '#2563eb',        // Blue (default)
}

const OUTDOOR_TYPE_COLORS: Record<string, string> = {
  FIELD: '#16a34a',    // Green
  COURT: '#ea580c',    // Orange
  GYM: '#dc2626',      // Red
  COMMON: '#0891b2',   // Cyan
  PARKING: '#6b7280',  // Gray
  OTHER: '#059669',    // Emerald
}

function getBuildingColor(building: Building): string {
  return DIVISION_COLORS[building.schoolDivision || 'GLOBAL'] || DIVISION_COLORS.GLOBAL
}

function getOutdoorColor(space: OutdoorSpace): string {
  return OUTDOOR_TYPE_COLORS[space.areaType] || OUTDOOR_TYPE_COLORS.OTHER
}

/* ------------------------------------------------------------------ */
/*  Custom marker icon builders                                        */
/* ------------------------------------------------------------------ */

/** Circular icon for buildings — matches school center style but in building color */
function createBuildingCircleIcon(L: any, label: string, color = '#2563eb') {
  return L.divIcon({
    className: 'campus-building-marker',
    html: `
      <div style="
        display: flex; align-items: center; gap: 6px;
        transform: translate(-50%, -50%);
      ">
        <div style="
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 50%;
          background: ${color}; border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          flex-shrink: 0;
        ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
            <path d="M9 22V12h6v10"/>
            <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01"/>
          </svg>
        </div>
        <div style="
          background: ${color}; color: white;
          padding: 2px 8px; border-radius: 10px;
          font-size: 11px; font-weight: 700;
          white-space: nowrap; box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.5);
        ">${label}</div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

/** Circular icon for outdoor spaces */
function createOutdoorIcon(L: any, label: string, color = '#16a34a') {
  return L.divIcon({
    className: 'campus-outdoor-marker',
    html: `
      <div style="
        display: flex; align-items: center; gap: 6px;
        transform: translate(-50%, -50%);
      ">
        <div style="
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 50%;
          background: ${color}; border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          flex-shrink: 0;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 14v6m-3-3h6M6 3v12"/>
            <path d="M6 3c0 0 3 2 6 2s6-2 6-2"/>
            <path d="M6 8c0 0 3 2 6 2s6-2 6-2"/>
          </svg>
        </div>
        <div style="
          background: ${color}; color: white;
          padding: 2px 7px; border-radius: 10px;
          font-size: 10px; font-weight: 700;
          white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.5);
        ">${label}</div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

function createOrgIcon(L: any) {
  return L.divIcon({
    className: 'campus-org-marker',
    html: `
      <div style="
        display: flex; align-items: center; justify-content: center;
        width: 40px; height: 40px; border-radius: 50%;
        background: #dc2626; border: 3px solid white;
        box-shadow: 0 2px 10px rgba(0,0,0,0.35);
        transform: translate(-50%, -50%);
        cursor: grab;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

/* ------------------------------------------------------------------ */
/*  Polygon label icon                                                 */
/* ------------------------------------------------------------------ */

function createPolygonLabel(L: any, name: string, color: string) {
  return L.divIcon({
    className: 'campus-polygon-label',
    html: `
      <div style="
        background: ${color}; color: white;
        padding: 2px 8px; border-radius: 4px;
        font-size: 11px; font-weight: 700;
        white-space: nowrap;
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.5);
        transform: translate(-50%, -50%);
        pointer-events: none;
      ">
        ${name}
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function InteractiveCampusMap({
  buildings,
  outdoorSpaces = [],
  onBuildingPositionChange,
  onAddBuildingAtPosition,
  onAddOutdoorSpaceAtPosition,
  onBuildingSelected,
  onPolygonSaved,
  onOutdoorPolygonSaved,
  onOrgCenterChange,
  onOutdoorPositionChange,
  editable = true,
}: InteractiveCampusMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const polygonsRef = useRef<Map<string, any>>(new Map())
  const labelsRef = useRef<Map<string, any>>(new Map())
  const orgMarkerRef = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [mapConfig, setMapConfig] = useState<MapConfig | null>(null)
  const [placingMode, setPlacingMode] = useState<'building' | 'outdoor' | null>(null)
  const [activeLayer, setActiveLayer] = useState<'satellite' | 'street'>('satellite')
  const [pendingMoves, setPendingMoves] = useState<Map<string, { lat: number; lng: number }>>(new Map())
  const tileLayersRef = useRef<{ satellite: any; street: any }>({ satellite: null, street: null })

  // AI detection state
  const [detectingId, setDetectingId] = useState<string | null>(null)
  const [editingPolygon, setEditingPolygon] = useState<{ buildingId: string; coordinates: LatLng[] } | null>(null)
  const editingPolygonLayerRef = useRef<any>(null)
  const editingVertexMarkersRef = useRef<any[]>([])

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  const orgId = typeof window !== 'undefined' ? localStorage.getItem('org-id') : null

  const getAuthHeaders = () => ({
    Authorization: token ? `Bearer ${token}` : '',
    'X-Organization-ID': orgId || '',
    'Content-Type': 'application/json',
  })

  // Fetch org location + outdoor spaces from map-data
  useEffect(() => {
    if (!token) return
    fetch('/api/settings/campus/map-data', {
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
  }, [token])

  // Initialize map
  useEffect(() => {
    if (!mapConfig || !mapContainerRef.current) return

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
        maxZoom: 20,       // Max satellite detail
        maxBounds: campusBounds,
        maxBoundsViscosity: 0.8, // Gentle elastic bounce when hitting edge
        zoomControl: false,
      })

      L.control.zoom({ position: 'topright' }).addTo(map)

      const satellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles &copy; Esri', maxZoom: 20 }
      )

      const street = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }
      )

      const labels = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 20, opacity: 0.7 }
      )

      satellite.addTo(map)
      labels.addTo(map)
      tileLayersRef.current = { satellite, street }
      mapInstanceRef.current = map

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

      // Render buildings
      buildings.forEach((b) => {
        if (b.latitude && b.longitude) {
          const color = getBuildingColor(b)
          if (b.polygonCoordinates && b.polygonCoordinates.length >= 3) {
            addBuildingPolygon(L, map, b, color)
          } else {
            addBuildingMarker(L, map, b, color)
          }
        }
      })

      // Render outdoor spaces
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

      setLoading(false)
    })

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
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

  const addBuildingPolygon = useCallback((L: any, map: any, building: Building, color: string) => {
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

  const addBuildingMarker = useCallback((L: any, map: any, building: Building, color: string) => {
    if (!building.latitude || !building.longitude) return

    const marker = L.marker([building.latitude, building.longitude], {
      icon: createBuildingCircleIcon(L, building.code || building.name, color),
      draggable: editable,
      zIndexOffset: 100,
    }).addTo(map)

    // Build popup with detect outline button
    const popupContent = document.createElement('div')
    popupContent.style.minWidth = '160px'
    popupContent.innerHTML = `
      <strong style="font-size: 14px;">${building.name}</strong>
      ${building.code ? `<br/><span style="color: #6b7280; font-size: 12px;">Code: ${building.code}</span>` : ''}
      ${editable ? '<br/><span style="color: #2563eb; font-size: 11px; margin-top: 4px; display: block;">Drag to reposition</span>' : ''}
    `

    if (editable) {
      const detectBtn = document.createElement('button')
      detectBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.636 5.636l1.414 1.414m9.9 9.9l1.414 1.414M5.636 18.364l1.414-1.414m9.9-9.9l1.414-1.414"/></svg> Detect Outline`
      detectBtn.style.cssText = 'display:flex;align-items:center;gap:4px;background:#7c3aed;color:white;border:none;padding:5px 10px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;margin-top:6px;width:100%;justify-content:center;'
      detectBtn.onmouseover = () => { detectBtn.style.background = '#6d28d9' }
      detectBtn.onmouseout = () => { detectBtn.style.background = '#7c3aed' }
      detectBtn.onclick = (e) => {
        e.stopPropagation()
        marker.closePopup()
        handleDetectOutline(building.id)
      }
      popupContent.appendChild(detectBtn)
    }

    marker.bindPopup(popupContent)

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
  }, [editable])

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
      icon: createOutdoorIcon(L, space.name, color),
      draggable: editable,
      zIndexOffset: 50,
    }).addTo(map)

    marker.bindPopup(
      `<strong style="font-size:14px;">${space.name}</strong>` +
      `<br/><span style="color:#6b7280;font-size:12px;">${space.areaType.replace('_', ' ')}</span>` +
      (editable ? '<br/><span style="color:#16a34a;font-size:11px;">Drag to reposition</span>' : '')
    )

    if (editable) {
      marker.on('dragend', (e: any) => {
        const latlng = e.target.getLatLng()
        if (onOutdoorPositionChange) {
          onOutdoorPositionChange(space.id, latlng.lat, latlng.lng)
        }
      })
    }

    markersRef.current.set(`outdoor-${space.id}`, marker)
  }, [editable, onOutdoorPositionChange])

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
    map.fitBounds(polygon.getBounds(), { padding: [60, 60], maxZoom: 19 })
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
        addBuildingPolygon(L, map, { ...building, polygonCoordinates: editingPolygon.coordinates }, getBuildingColor(building))
      }
    }

    setEditingPolygon(null)
  }

  const handleCancelPolygon = () => {
    clearEditingPolygon()
    setEditingPolygon(null)
  }

  /* ── Placing mode clicks ─────────────────────────────────────────── */

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !placingMode) return

    const handleClick = (e: any) => {
      if (placingMode === 'building' && onAddBuildingAtPosition) {
        onAddBuildingAtPosition(e.latlng.lat, e.latlng.lng)
      } else if (placingMode === 'outdoor' && onAddOutdoorSpaceAtPosition) {
        onAddOutdoorSpaceAtPosition(e.latlng.lat, e.latlng.lng)
      }
      setPlacingMode(null)
    }

    map.on('click', handleClick)
    map.getContainer().style.cursor = 'crosshair'

    return () => {
      map.off('click', handleClick)
      map.getContainer().style.cursor = ''
    }
  }, [placingMode, onAddBuildingAtPosition, onAddOutdoorSpaceAtPosition])

  // Update markers when buildings change
  useEffect(() => {
    const L = (window as any).L
    const map = mapInstanceRef.current
    if (!L || !map) return

    buildings.forEach((b) => {
      if (b.latitude && b.longitude && !markersRef.current.has(b.id) && !polygonsRef.current.has(b.id)) {
        const color = getBuildingColor(b)
        if (b.polygonCoordinates && b.polygonCoordinates.length >= 3) {
          addBuildingPolygon(L, map, b, color)
        } else {
          addBuildingMarker(L, map, b, color)
        }
      }
    })
  }, [buildings, addBuildingMarker, addBuildingPolygon])

  // Update outdoor space markers when they change
  useEffect(() => {
    const L = (window as any).L
    const map = mapInstanceRef.current
    if (!L || !map) return

    outdoorSpaces.forEach((space) => {
      const key = `outdoor-${space.id}`
      if (space.lat && space.lng && !markersRef.current.has(key) && !polygonsRef.current.has(key)) {
        const color = getOutdoorColor(space)
        if (space.polygonCoordinates && space.polygonCoordinates.length >= 3) {
          addOutdoorPolygon(L, map, space, color)
        } else {
          addOutdoorMarker(L, map, space, color)
        }
      }
    })
  }, [outdoorSpaces, addOutdoorMarker, addOutdoorPolygon])

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
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
        <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">
          Add a school address in <span className="font-medium">School Information</span> to see your campus on the map.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">Campus Map</span>
          {mapConfig?.address && (
            <span className="text-xs text-gray-500 ml-2 hidden sm:inline">{mapConfig.address}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Editing polygon controls */}
          {editingPolygon && (
            <>
              <button
                onClick={handleSavePolygon}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                Save Outline
              </button>
              <button
                onClick={handleCancelPolygon}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </>
          )}

          {/* Detecting indicator */}
          {detectingId && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-100 text-purple-800 rounded-lg border border-purple-200">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              AI detecting outline...
            </div>
          )}

          {!editingPolygon && !detectingId && (
            <>
              {editable && pendingMoves.size > 0 && (
                <button
                  onClick={handleSavePositions}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save {pendingMoves.size} change{pendingMoves.size > 1 ? 's' : ''}
                </button>
              )}

              {editable && onAddBuildingAtPosition && (
                <button
                  onClick={() => setPlacingMode(placingMode === 'building' ? null : 'building')}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    placingMode === 'building'
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {placingMode === 'building' ? 'Click map...' : 'Place Building'}
                </button>
              )}

              {editable && onAddOutdoorSpaceAtPosition && (
                <button
                  onClick={() => setPlacingMode(placingMode === 'outdoor' ? null : 'outdoor')}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    placingMode === 'outdoor'
                      ? 'bg-green-100 text-green-800 border border-green-300'
                      : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <TreePine className="w-3.5 h-3.5" />
                  {placingMode === 'outdoor' ? 'Click map...' : 'Place Outdoor'}
                </button>
              )}

              <button
                onClick={toggleLayer}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Layers className="w-3.5 h-3.5" />
                {activeLayer === 'satellite' ? 'Street' : 'Satellite'}
              </button>

              <button
                onClick={fitAllMarkers}
                className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium bg-white text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title="Fit all buildings"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Map container */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-100">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        )}
        <div
          ref={mapContainerRef}
          style={{ height: 500, width: '100%', position: 'relative', zIndex: 0 }}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-600 border-2 border-white shadow-sm" />
          School Center
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow-sm" />
          Building
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-600 border-2 border-white shadow-sm" />
          Outdoor
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-600/30 border border-blue-600" />
          Outline
        </div>
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-purple-500" />
          AI Detect
        </div>

        {/* Division color legend */}
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-gray-400">|</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: DIVISION_COLORS.GLOBAL }} />
            <span>Global</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: DIVISION_COLORS.ELEMENTARY }} />
            <span>Elem</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: DIVISION_COLORS.MIDDLE_SCHOOL }} />
            <span>Middle</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: DIVISION_COLORS.HIGH_SCHOOL }} />
            <span>High</span>
          </div>
        </div>
      </div>

      {/* Status bar */}
      {(editingPolygon || placingMode) && (
        <div className="px-4 py-2 border-t border-gray-200 bg-amber-50 text-xs text-amber-700 font-medium">
          {editingPolygon && 'Drag vertices to adjust the outline, then save'}
          {placingMode === 'building' && 'Click anywhere on the map to place a new building'}
          {placingMode === 'outdoor' && 'Click anywhere on the map to place a new outdoor space'}
        </div>
      )}
    </div>
  )
}
