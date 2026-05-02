'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { MapPin, Loader2, Building2, TreePine } from 'lucide-react'

import type { MapConfig, InteractiveCampusMapProps } from './campus/map-types'
import { loadLeaflet } from './campus/leaflet-loader'
import { getBuildingColor, getOutdoorColor, createOrgIcon } from './campus/map-icons'
import MapToolbar from './campus/MapToolbar'
import MapLegend from './campus/MapLegend'
import { useMapDrawing } from './campus/useMapDrawing'
import { usePolygonEditing } from './campus/usePolygonEditing'
import { useMapMarkers } from './campus/useMapMarkers'

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
  embedded = false,
  campusName: campusNameProp,
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
  const [pendingMoves, setPendingMoves] = useState<Map<string, { lat: number; lng: number }>>(new Map())
  const [clickPopover, setClickPopover] = useState<{
    position: { x: number; y: number }
    coordinates: { lat: number; lng: number }
  } | null>(null)
  const pendingMarkerRef = useRef<any>(null)

  // Build a division->color lookup from schools
  const schoolColorByDivision = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of schools) {
      if (s.gradeLevel) map[s.gradeLevel] = s.color
    }
    return map
  }, [schools])

  /* ── Polygon editing hook ────────────────────────────────────────── */

  // Drawing hook needs polygon editing refs, and polygon editing needs
  // drawing clear — break the cycle by using the clear ref pattern.
  // We define polygon editing first so its layerRef is available to drawing.

  // Forward-declare clearDrawingMode so polygon editing can call it
  const drawingClearRef = useRef<() => void>(() => {})

  const {
    editingPolygon,
    setEditingPolygon,
    editingPolygonLayerRef,
    showEditablePolygon,
    clearEditingPolygon,
    handleSavePolygon,
    handleCancelPolygon,
    detectingId,
    handleDetectOutline,
  } = usePolygonEditing({
    mapInstanceRef,
    markersRef,
    polygonsRef,
    labelsRef,
    buildings,
    schoolColorByDivision,
    onPolygonSaved,
    drawingModeClear: () => drawingClearRef.current(),
  })

  /* ── Drawing hook ────────────────────────────────────────────────── */

  const {
    drawingMode,
    startDrawing,
    finishDrawing,
    undoDrawingPoint,
    clearDrawingMode,
  } = useMapDrawing({
    mapInstanceRef,
    editingPolygonLayerRef,
    onShowEditablePolygon: showEditablePolygon,
    onSetEditingPolygon: setEditingPolygon,
  })

  // Wire the forward ref
  drawingClearRef.current = clearDrawingMode

  /* ── Marker management hook ──────────────────────────────────────── */

  const {
    addBuildingPolygon,
    addBuildingMarker,
    addOutdoorPolygon,
    addOutdoorMarker,
  } = useMapMarkers({
    markersRef,
    polygonsRef,
    labelsRef,
    editable,
    setPendingMoves,
    onBuildingSelected,
    onEditBuilding,
    onDeleteBuilding,
    onManageRooms,
    onEditOutdoor,
    onDeleteOutdoor,
    onOutdoorPositionChange,
  })

  /* ── Map config fetch ────────────────────────────────────────────── */

  useEffect(() => {
    if (mapCenterProp) {
      setMapConfig({
        center: { lat: mapCenterProp.lat, lng: mapCenterProp.lng },
        address: mapCenterProp.address,
        orgName: mapCenterProp.name,
      })
      return
    }
    const url = campusId
      ? `/api/settings/campus/map-data?campusId=${campusId}`
      : '/api/settings/campus/map-data'
    fetch(url, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
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
  }, [mapCenterProp, campusId])

  /* ── Initialize map ──────────────────────────────────────────────── */

  useEffect(() => {
    if (!mapConfig || !mapContainerRef.current) return

    setLoading(true)

    let cancelled = false

    loadLeaflet().then(() => {
      if (cancelled || !mapContainerRef.current) return
      const L = (window as any).L

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
      }

      const CAMPUS_RADIUS = 0.006
      const campusBounds = L.latLngBounds(
        [mapConfig.center.lat - CAMPUS_RADIUS, mapConfig.center.lng - CAMPUS_RADIUS],
        [mapConfig.center.lat + CAMPUS_RADIUS, mapConfig.center.lng + CAMPUS_RADIUS]
      )

      const map = L.map(mapContainerRef.current, {
        center: [mapConfig.center.lat, mapConfig.center.lng],
        zoom: 17,
        minZoom: 15,
        maxZoom: 18,
        maxBounds: campusBounds,
        maxBoundsViscosity: 0.8,
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

      mapInstanceRef.current = map

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
        ;(map as any)._resizeObserver = ro
      }

      // Org center marker -- DRAGGABLE
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

      let revealed = false
      const reveal = () => {
        if (cancelled || revealed) return
        revealed = true
        map.invalidateSize()
        setMapReady(n => n + 1)
      }

      if (satellite.isLoading && !satellite.isLoading()) {
        reveal()
      } else {
        satellite.once('load', reveal)
      }

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
  }, [mapConfig?.center.lat, mapConfig?.center.lng])

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

  /* ── Sync buildings to map ───────────────────────────────────────── */

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

    setLoading(false)
  }, [buildings, addBuildingMarker, addBuildingPolygon, schoolColorByDivision, mapReady])

  /* ── Sync outdoor spaces to map ──────────────────────────────────── */

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

  /* ── Pending marker (shown while user fills in form) ─────────────── */

  useEffect(() => {
    const L = (window as any).L
    const map = mapInstanceRef.current
    if (!L || !map) return

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

  /* ── Save pending position moves ─────────────────────────────────── */

  const handleSavePositions = async () => {
    if (pendingMoves.size === 0) return
    for (const [buildingId, coords] of pendingMoves.entries()) {
      if (onBuildingPositionChange) {
        onBuildingPositionChange(buildingId, coords.lat, coords.lng)
      }
    }
    setPendingMoves(new Map())
  }

  /* ── Fit all markers ─────────────────────────────────────────────── */

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

  /* ── Render ───────────────────────────────────────────────────────── */

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
        campusName={embedded ? (campusNameProp ?? mapConfig?.orgName ?? null) : null}
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
          style={{ height: embedded ? 600 : 500, width: '100%', position: 'relative', zIndex: 0 }}
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

      {/* Legend — hidden in embedded (single-campus) view */}
      {!embedded && (
        <MapLegend
          buildings={buildings}
          outdoorSpaces={outdoorSpaces}
          schools={schools}
        />
      )}

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
