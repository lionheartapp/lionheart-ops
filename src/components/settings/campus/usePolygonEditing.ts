/* ------------------------------------------------------------------ */
/*  Polygon editing mode hook (editable vertices + save/cancel)        */
/* ------------------------------------------------------------------ */

import { useState, useRef, useCallback, type MutableRefObject, type Dispatch, type SetStateAction } from 'react'
import type { LatLng, MapBuilding } from './map-types'
import { getBuildingColor, createPolygonLabel } from './map-icons'

interface UsePolygonEditingOptions {
  mapInstanceRef: MutableRefObject<any>
  markersRef: MutableRefObject<Map<string, any>>
  polygonsRef: MutableRefObject<Map<string, any>>
  labelsRef: MutableRefObject<Map<string, any>>
  buildings: MapBuilding[]
  schoolColorByDivision: Record<string, string>
  onPolygonSaved?: (buildingId: string, coordinates: LatLng[]) => void
  drawingModeClear: () => void
}

interface EditingPolygon {
  buildingId: string
  coordinates: LatLng[]
}

interface UsePolygonEditingReturn {
  editingPolygon: EditingPolygon | null
  setEditingPolygon: Dispatch<SetStateAction<EditingPolygon | null>>
  editingPolygonLayerRef: MutableRefObject<any>
  editingVertexMarkersRef: MutableRefObject<any[]>
  showEditablePolygon: (coordinates: LatLng[]) => void
  clearEditingPolygon: () => void
  handleSavePolygon: () => Promise<void>
  handleCancelPolygon: () => void
  detectingId: string | null
  handleDetectOutline: (buildingId: string) => Promise<void>
}

export function usePolygonEditing({
  mapInstanceRef,
  markersRef,
  polygonsRef,
  labelsRef,
  buildings,
  schoolColorByDivision,
  onPolygonSaved,
  drawingModeClear,
}: UsePolygonEditingOptions): UsePolygonEditingReturn {
  const [editingPolygon, setEditingPolygon] = useState<EditingPolygon | null>(null)
  const [detectingId, setDetectingId] = useState<string | null>(null)
  const editingPolygonLayerRef = useRef<any>(null)
  const editingVertexMarkersRef = useRef<any[]>([])

  const getAuthHeaders = (): Record<string, string> => {
    const csrfToken = document.cookie.split(';').find(c => c.trim().startsWith('csrf-token='))?.trim().split('=')[1] || ''
    return {
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
    }
  }

  const clearEditingPolygon = useCallback(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (editingPolygonLayerRef.current) {
      map.removeLayer(editingPolygonLayerRef.current)
      editingPolygonLayerRef.current = null
    }
    editingVertexMarkersRef.current.forEach((m) => map.removeLayer(m))
    editingVertexMarkersRef.current = []

    // Also clear drawing mode if active
    drawingModeClear()
  }, [mapInstanceRef, drawingModeClear])

  const showEditablePolygon = useCallback((coordinates: LatLng[]) => {
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
  }, [mapInstanceRef, clearEditingPolygon])

  const handleSavePolygon = useCallback(async () => {
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
        const color = getBuildingColor(building, schoolColorByDivision)
        const updatedBuilding = { ...building, polygonCoordinates: editingPolygon.coordinates }
        const coords = editingPolygon.coordinates.map((p: LatLng) => [p.lat, p.lng])

        const polygon = L.polygon(coords, {
          color: color,
          weight: 2,
          opacity: 0.9,
          fillColor: color,
          fillOpacity: 0.25,
          className: 'campus-building-polygon',
        }).addTo(map)

        polygon.bindTooltip(updatedBuilding.name, {
          sticky: true,
          className: 'campus-tooltip',
          direction: 'top',
          offset: [0, -10],
        })

        polygonsRef.current.set(updatedBuilding.id, polygon)

        const center = polygon.getBounds().getCenter()
        const label = L.marker(center, {
          icon: createPolygonLabel(L, updatedBuilding.code || updatedBuilding.name, color),
          interactive: false,
        }).addTo(map)
        labelsRef.current.set(updatedBuilding.id, label)
      }
    }

    setEditingPolygon(null)
  }, [editingPolygon, onPolygonSaved, clearEditingPolygon, mapInstanceRef, markersRef, polygonsRef, labelsRef, buildings, schoolColorByDivision])

  const handleCancelPolygon = useCallback(() => {
    clearEditingPolygon()
    setEditingPolygon(null)
  }, [clearEditingPolygon])

  /* ── AI outline detection ────────────────────────────────────────── */

  const handleDetectOutline = useCallback(async (buildingId: string) => {
    setDetectingId(buildingId)
    try {
      const res = await fetch(`/api/settings/campus/buildings/${buildingId}/detect-outline`, {
        method: 'POST',
        credentials: 'include',
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
  }, [showEditablePolygon])

  return {
    editingPolygon,
    setEditingPolygon,
    editingPolygonLayerRef,
    editingVertexMarkersRef,
    showEditablePolygon,
    clearEditingPolygon,
    handleSavePolygon,
    handleCancelPolygon,
    detectingId,
    handleDetectOutline,
  }
}
