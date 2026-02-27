'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { MapPin, Loader2, Plus, Save, Layers, Maximize2 } from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Building {
  id: string
  name: string
  code: string | null
  latitude: number | null
  longitude: number | null
}

interface MapConfig {
  center: { lat: number; lng: number }
  address: string | null
  orgName: string
}

interface InteractiveCampusMapProps {
  buildings: Building[]
  onBuildingPositionChange?: (buildingId: string, lat: number, lng: number) => void
  onAddBuildingAtPosition?: (lat: number, lng: number) => void
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
    // CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      link.crossOrigin = ''
      document.head.appendChild(link)
    }

    // JS
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
/*  Custom marker icon builder                                         */
/* ------------------------------------------------------------------ */

function createBuildingIcon(L: any, label: string, color = '#2563eb') {
  return L.divIcon({
    className: 'campus-building-marker',
    html: `
      <div style="
        display: flex; align-items: center; gap: 6px;
        background: ${color}; color: white;
        padding: 4px 10px; border-radius: 20px;
        font-size: 12px; font-weight: 600;
        white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        border: 2px solid white; cursor: grab;
        transform: translate(-50%, -50%);
      ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
          <path d="M9 22V12h6v10"/>
          <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01"/>
        </svg>
        ${label}
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
        width: 36px; height: 36px; border-radius: 50%;
        background: #dc2626; border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transform: translate(-50%, -50%);
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
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
  onBuildingPositionChange,
  onAddBuildingAtPosition,
  editable = true,
}: InteractiveCampusMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const [loading, setLoading] = useState(true)
  const [mapConfig, setMapConfig] = useState<MapConfig | null>(null)
  const [isPlacingMode, setIsPlacingMode] = useState(false)
  const [activeLayer, setActiveLayer] = useState<'satellite' | 'street'>('satellite')
  const [pendingMoves, setPendingMoves] = useState<Map<string, { lat: number; lng: number }>>(new Map())
  const tileLayersRef = useRef<{ satellite: any; street: any }>({ satellite: null, street: null })

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null

  // Fetch org location
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

      // Prevent double init
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
      }

      const map = L.map(mapContainerRef.current, {
        center: [mapConfig.center.lat, mapConfig.center.lng],
        zoom: 17,
        zoomControl: false,
      })

      // Zoom control top-right
      L.control.zoom({ position: 'topright' }).addTo(map)

      // Satellite tiles (Esri)
      const satellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri',
          maxZoom: 20,
        }
      )

      // Street tiles (OpenStreetMap)
      const street = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }
      )

      // Labels overlay for satellite view
      const labels = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 20, opacity: 0.7 }
      )

      satellite.addTo(map)
      labels.addTo(map)

      tileLayersRef.current = { satellite, street }
      mapInstanceRef.current = map

      // Org center marker
      L.marker([mapConfig.center.lat, mapConfig.center.lng], {
        icon: createOrgIcon(L),
        zIndexOffset: -100,
      })
        .addTo(map)
        .bindPopup(`<strong>${mapConfig.orgName}</strong><br/>${mapConfig.address || ''}`)

      // Building markers
      buildings.forEach((b) => {
        if (b.latitude && b.longitude) {
          addBuildingMarker(L, map, b)
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapConfig])

  const addBuildingMarker = useCallback((L: any, map: any, building: Building) => {
    if (!building.latitude || !building.longitude) return

    const marker = L.marker([building.latitude, building.longitude], {
      icon: createBuildingIcon(L, building.code || building.name),
      draggable: editable,
      zIndexOffset: 100,
    }).addTo(map)

    marker.bindPopup(`
      <div style="min-width: 140px;">
        <strong style="font-size: 14px;">${building.name}</strong>
        ${building.code ? `<br/><span style="color: #6b7280; font-size: 12px;">Code: ${building.code}</span>` : ''}
        ${editable ? '<br/><span style="color: #2563eb; font-size: 11px; margin-top: 4px; display: block;">Drag to reposition</span>' : ''}
      </div>
    `)

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

  // Handle placing mode clicks
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !isPlacingMode) return

    const handleClick = (e: any) => {
      if (onAddBuildingAtPosition) {
        onAddBuildingAtPosition(e.latlng.lat, e.latlng.lng)
      }
      setIsPlacingMode(false)
    }

    map.on('click', handleClick)
    map.getContainer().style.cursor = 'crosshair'

    return () => {
      map.off('click', handleClick)
      map.getContainer().style.cursor = ''
    }
  }, [isPlacingMode, onAddBuildingAtPosition])

  // Update markers when buildings change
  useEffect(() => {
    const L = (window as any).L
    const map = mapInstanceRef.current
    if (!L || !map) return

    buildings.forEach((b) => {
      if (b.latitude && b.longitude && !markersRef.current.has(b.id)) {
        addBuildingMarker(L, map, b)
      }
    })
  }, [buildings, addBuildingMarker])

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
              onClick={() => setIsPlacingMode(!isPlacingMode)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isPlacingMode
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              {isPlacingMode ? 'Click map to place...' : 'Place Building'}
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
          style={{ height: 450, width: '100%' }}
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-200 bg-gray-50 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-600 border-2 border-white shadow-sm" />
          School Center
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-600 border-2 border-white shadow-sm" />
          Building
        </div>
        {editable && (
          <span className="ml-auto text-gray-400">Drag buildings to reposition</span>
        )}
      </div>
    </div>
  )
}
