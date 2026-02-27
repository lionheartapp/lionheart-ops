'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { MapPin, Loader2, Plus, Save, Layers, Maximize2, Sparkles, X, Check, TreePine, Pencil, RotateCcw, Building2 } from 'lucide-react'

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
  campusId?: string
  onBuildingPositionChange?: (buildingId: string, lat: number, lng: number) => void
  onAddBuildingAtPosition?: (lat: number, lng: number) => void
  onAddOutdoorSpaceAtPosition?: (lat: number, lng: number) => void
  onBuildingSelected?: (buildingId: string) => void
  onEditBuilding?: (buildingId: string) => void
  onDeleteBuilding?: (buildingId: string) => void
  onManageRooms?: (buildingId: string) => void
  onEditOutdoor?: (outdoorId: string) => void
  onDeleteOutdoor?: (outdoorId: string) => void
  onPolygonSaved?: (buildingId: string, coordinates: LatLng[]) => void
  onOutdoorPolygonSaved?: (areaId: string, coordinates: LatLng[]) => void
  onOrgCenterChange?: (lat: number, lng: number) => void
  onOutdoorPositionChange?: (areaId: string, lat: number, lng: number) => void
  editable?: boolean
  pendingMarker?: { lat: number; lng: number; label: string; type: 'building' | 'outdoor' } | null
  quickPlaceMode?: 'building' | 'outdoor' | null
  onQuickPlaceDone?: () => void
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
        display: flex; align-items: center; justify-content: center;
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
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

/** Get SVG icon for outdoor spaces based on name and areaType */
function getOutdoorSvgIcon(name: string, areaType: string): string {
  const nameLower = name.toLowerCase()

  // Check name for keywords first
  if (nameLower.includes('tennis')) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M5 19c2-2 4-3 7-3s5 1 7 3"/></svg>'
  }
  if (nameLower.includes('football')) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c-5 0-9 4-9 9s4 9 9 9 9-4 9-9-4-9-9-9M5 12h14M8 9h.01M8 15h.01M16 9h.01M16 15h.01"/></svg>'
  }
  if (nameLower.includes('baseball') || nameLower.includes('softball')) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M6 12c0 1.5 1 3 2 4M18 12c0 1.5-1 3-2 4M6 12c0-1.5 1-3 2-4M18 12c0-1.5-1-3-2-4"/></svg>'
  }
  if (nameLower.includes('basketball')) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/></svg>'
  }
  if (nameLower.includes('soccer')) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 9v6M15 12h-6M13 10l-2 2M13 14l-2-2"/></svg>'
  }
  if (nameLower.includes('track') || nameLower.includes('running')) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><path d="M4 14c1 1 2 1 3 0m-1 2 2-2m3 7s.75-1.5 2-1.5 2 1.5 2 1.5"/></svg>'
  }
  if (nameLower.includes('pool') || nameLower.includes('swim')) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10c0 0 1-2 4-2s4 2 4 2M12 10c0 0 1-2 4-2s4 2 4 2M4 14c0 0 1-2 4-2s4 2 4 2M12 14c0 0 1-2 4-2s4 2 4 2"/></svg>'
  }
  if (nameLower.includes('parking')) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>'
  }
  if (nameLower.includes('gym') || nameLower.includes('weight')) {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/></svg>'
  }

  // Fallback based on areaType
  switch (areaType) {
    case 'COURT':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="3"/></svg>'
    case 'GYM':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/></svg>'
    case 'COMMON':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 1-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
    case 'PARKING':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>'
    case 'FIELD':
    case 'OTHER':
    default:
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c1.1 0 2 .9 2 2 0 2.3 1.5 4.3 3.5 5-2 .7-3.5 2.7-3.5 5 0 1.1-.9 2-2 2s-2-.9-2-2c0-2.3-1.5-4.3-3.5-5 2-.7 3.5-2.7 3.5-5 0-1.1.9-2 2-2z"/></svg>'
  }
}

/** Circular icon for outdoor spaces */
function createOutdoorIcon(L: any, name: string, areaType: string, color = '#16a34a') {
  const svgIcon = getOutdoorSvgIcon(name, areaType)

  return L.divIcon({
    className: 'campus-outdoor-marker',
    html: `
      <div style="
        display: flex; align-items: center; justify-content: center;
        transform: translate(-50%, -50%);
      ">
        <div style="
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 50%;
          background: ${color}; border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          flex-shrink: 0;
        ">
          ${svgIcon}
        </div>
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

    // Build popup with action menu
    const popupContent = document.createElement('div')
    popupContent.style.minWidth = '160px'
    popupContent.innerHTML = `
      <strong style="font-size: 14px;">${building.name}</strong>
      ${building.code ? `<br/><span style="color: #6b7280; font-size: 12px;">${building.code}</span>` : ''}
      ${editable ? '<br/><span style="color: #9ca3af; font-size: 11px; margin-top: 2px; display: block;">Drag to reposition</span>' : ''}
    `

    if (editable) {
      const menuContainer = document.createElement('div')
      menuContainer.style.cssText = 'margin-top:8px;border-top:1px solid #e5e7eb;padding-top:4px;display:flex;flex-direction:column;'

      const menuItemStyle = 'display:flex;align-items:center;gap:8px;padding:7px 4px;border:none;background:none;width:100%;text-align:left;font-size:13px;color:#374151;cursor:pointer;border-radius:4px;'
      const menuItemHover = 'background:#f3f4f6;'

      // Edit Building
      if (onEditBuilding) {
        const editBtn = document.createElement('button')
        editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg> Edit Building`
        editBtn.style.cssText = menuItemStyle
        editBtn.onmouseover = () => { editBtn.style.cssText = menuItemStyle + menuItemHover }
        editBtn.onmouseout = () => { editBtn.style.cssText = menuItemStyle }
        editBtn.onclick = (e) => { e.stopPropagation(); marker.closePopup(); onEditBuilding(building.id) }
        menuContainer.appendChild(editBtn)
      }

      // Add Rooms
      if (onManageRooms) {
        const roomsBtn = document.createElement('button')
        roomsBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12v.01"/><path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z"/></svg> Manage Rooms`
        roomsBtn.style.cssText = menuItemStyle
        roomsBtn.onmouseover = () => { roomsBtn.style.cssText = menuItemStyle + menuItemHover }
        roomsBtn.onmouseout = () => { roomsBtn.style.cssText = menuItemStyle }
        roomsBtn.onclick = (e) => { e.stopPropagation(); marker.closePopup(); onManageRooms(building.id) }
        menuContainer.appendChild(roomsBtn)
      }

      // Delete Building
      if (onDeleteBuilding) {
        const deleteBtn = document.createElement('button')
        deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg> Delete`
        deleteBtn.style.cssText = menuItemStyle + 'color:#dc2626;margin-top:4px;border-top:1px solid #e5e7eb;padding-top:8px;border-radius:0 0 4px 4px;'
        deleteBtn.onmouseover = () => { deleteBtn.style.cssText = menuItemStyle + 'color:#dc2626;margin-top:4px;border-top:1px solid #e5e7eb;padding-top:8px;border-radius:0 0 4px 4px;background:#fef2f2;' }
        deleteBtn.onmouseout = () => { deleteBtn.style.cssText = menuItemStyle + 'color:#dc2626;margin-top:4px;border-top:1px solid #e5e7eb;padding-top:8px;border-radius:0 0 4px 4px;' }
        deleteBtn.onclick = (e) => { e.stopPropagation(); marker.closePopup(); onDeleteBuilding(building.id) }
        menuContainer.appendChild(deleteBtn)
      }

      popupContent.appendChild(menuContainer)
    }

    marker.bindPopup(popupContent, { closeButton: false, autoPan: true, autoPanPadding: [20, 20] })

    // Show popup on hover
    let hoverTimeout: ReturnType<typeof setTimeout> | null = null
    marker.on('mouseover', () => {
      if (hoverTimeout) { clearTimeout(hoverTimeout); hoverTimeout = null }
      marker.openPopup()
    })
    marker.on('mouseout', () => {
      hoverTimeout = setTimeout(() => marker.closePopup(), 300)
    })
    // Keep popup open while mouse is over the popup itself
    marker.on('popupopen', () => {
      const popupEl = marker.getPopup()?.getElement()
      if (popupEl) {
        popupEl.addEventListener('mouseenter', () => {
          if (hoverTimeout) { clearTimeout(hoverTimeout); hoverTimeout = null }
        })
        popupEl.addEventListener('mouseleave', () => {
          hoverTimeout = setTimeout(() => marker.closePopup(), 300)
        })
      }
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
    outdoorPopup.style.minWidth = '160px'
    outdoorPopup.innerHTML = `
      <strong style="font-size: 14px;">${space.name}</strong>
      <br/><span style="color: #6b7280; font-size: 12px;">${space.areaType.replace('_', ' ')}</span>
      ${editable ? '<br/><span style="color: #9ca3af; font-size: 11px; margin-top: 2px; display: block;">Drag to reposition</span>' : ''}
    `

    if (editable) {
      const menuContainer = document.createElement('div')
      menuContainer.style.cssText = 'margin-top:8px;border-top:1px solid #e5e7eb;padding-top:4px;display:flex;flex-direction:column;'

      const menuItemStyle = 'display:flex;align-items:center;gap:8px;padding:7px 4px;border:none;background:none;width:100%;text-align:left;font-size:13px;color:#374151;cursor:pointer;border-radius:4px;'
      const menuItemHover = 'background:#f3f4f6;'

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
        deleteBtn.style.cssText = menuItemStyle + 'color:#dc2626;margin-top:4px;border-top:1px solid #e5e7eb;padding-top:8px;border-radius:0 0 4px 4px;'
        deleteBtn.onmouseover = () => { deleteBtn.style.cssText = menuItemStyle + 'color:#dc2626;margin-top:4px;border-top:1px solid #e5e7eb;padding-top:8px;border-radius:0 0 4px 4px;background:#fef2f2;' }
        deleteBtn.onmouseout = () => { deleteBtn.style.cssText = menuItemStyle + 'color:#dc2626;margin-top:4px;border-top:1px solid #e5e7eb;padding-top:8px;border-radius:0 0 4px 4px;' }
        deleteBtn.onclick = (e) => { e.stopPropagation(); marker.closePopup(); onDeleteOutdoor(space.id) }
        menuContainer.appendChild(deleteBtn)
      }

      outdoorPopup.appendChild(menuContainer)
    }

    marker.bindPopup(outdoorPopup, { closeButton: false, autoPan: true, autoPanPadding: [20, 20] })

    // Show popup on hover
    let outdoorHoverTimeout: ReturnType<typeof setTimeout> | null = null
    marker.on('mouseover', () => {
      if (outdoorHoverTimeout) { clearTimeout(outdoorHoverTimeout); outdoorHoverTimeout = null }
      marker.openPopup()
    })
    marker.on('mouseout', () => {
      outdoorHoverTimeout = setTimeout(() => marker.closePopup(), 300)
    })
    marker.on('popupopen', () => {
      const popupEl = marker.getPopup()?.getElement()
      if (popupEl) {
        popupEl.addEventListener('mouseenter', () => {
          if (outdoorHoverTimeout) { clearTimeout(outdoorHoverTimeout); outdoorHoverTimeout = null }
        })
        popupEl.addEventListener('mouseleave', () => {
          outdoorHoverTimeout = setTimeout(() => marker.closePopup(), 300)
        })
      }
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
        addBuildingPolygon(L, map, { ...building, polygonCoordinates: editingPolygon.coordinates }, getBuildingColor(building))
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
        const color = getBuildingColor(b)
        if (b.polygonCoordinates && b.polygonCoordinates.length >= 3) {
          addBuildingPolygon(L, map, b, color)
        } else {
          addBuildingMarker(L, map, b, color)
        }
      }
    })
  }, [buildings, addBuildingMarker, addBuildingPolygon])

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
  }, [outdoorSpaces, addOutdoorMarker, addOutdoorPolygon])

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
          {/* Drawing mode controls */}
          {drawingMode && (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-lg border border-blue-200">
                <span>{drawingMode.points.length} / 3+ points</span>
              </div>
              <button
                onClick={finishDrawing}
                disabled={drawingMode.points.length < 3}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  drawingMode.points.length < 3
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                Done
              </button>
              <button
                onClick={undoDrawingPoint}
                disabled={drawingMode.points.length === 0}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  drawingMode.points.length === 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Undo
              </button>
              <button
                onClick={clearDrawingMode}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-white text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Cancel
              </button>
            </>
          )}

          {/* Editing polygon controls */}
          {editingPolygon && !drawingMode && (
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

              {editable && (onAddBuildingAtPosition || onAddOutdoorSpaceAtPosition) && (
                <button
                  disabled={!!drawingMode || !!editingPolygon}
                  onClick={() => {
                    if (placingMode) {
                      setPlacingMode(null)
                      setClickPopover(null)
                    } else {
                      setPlacingMode('unified')
                    }
                  }}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    drawingMode || editingPolygon
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : placingMode
                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {placingMode ? 'Cancel Placement' : 'Add to Map'}
                </button>
              )}

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

        {/* Placement type popover */}
        {clickPopover && (
          <div
            style={{
              position: 'absolute',
              left: Math.min(Math.max(clickPopover.position.x, 10), (mapContainerRef.current?.clientWidth || 300) - 180),
              top: Math.max(clickPopover.position.y - 80, 10),
              zIndex: 1000,
            }}
            className="bg-white rounded-xl shadow-xl border border-gray-200 p-3 min-w-[160px]"
          >
            <p className="text-xs font-semibold text-gray-500 mb-2 text-center">What is this?</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handlePopoverSelectBuilding}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors"
              >
                <Building2 className="w-4 h-4" />
                Building
              </button>
              <button
                onClick={handlePopoverSelectOutdoor}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-green-50 hover:text-green-700 transition-colors"
              >
                <TreePine className="w-4 h-4" />
                Outdoor Space
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
        {/* Division color legend */}
        <div className="flex items-center gap-3">
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
          <span className="text-gray-400">|</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#16a34a' }} />
            <span>Outdoor</span>
          </div>
        </div>
      </div>

      {/* Status bar */}
      {(editingPolygon || placingMode || drawingMode || clickPopover || quickPlaceMode) && (
        <div className="px-4 py-2 border-t border-gray-200 bg-amber-50 text-xs text-amber-700 font-medium">
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
