/* ------------------------------------------------------------------ */
/*  Manual polygon drawing mode hook                                   */
/* ------------------------------------------------------------------ */

import { useState, useRef, useCallback, useEffect, type MutableRefObject } from 'react'
import type { LatLng } from './map-types'

interface UseMapDrawingOptions {
  mapInstanceRef: MutableRefObject<any>
  editingPolygonLayerRef: MutableRefObject<any>
  onShowEditablePolygon: (coordinates: LatLng[]) => void
  onSetEditingPolygon: (value: { buildingId: string; coordinates: LatLng[] } | null) => void
}

interface UseMapDrawingReturn {
  drawingMode: { buildingId: string; points: LatLng[] } | null
  startDrawing: (buildingId: string) => void
  finishDrawing: () => void
  undoDrawingPoint: () => void
  clearDrawingMode: () => void
}

export function useMapDrawing({
  mapInstanceRef,
  editingPolygonLayerRef,
  onShowEditablePolygon,
  onSetEditingPolygon,
}: UseMapDrawingOptions): UseMapDrawingReturn {
  const [drawingMode, setDrawingMode] = useState<{ buildingId: string; points: LatLng[] } | null>(null)
  const drawingMarkersRef = useRef<any[]>([])
  const drawingPolylineRef = useRef<any>(null)

  const clearDrawingMode = useCallback(() => {
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
  }, [mapInstanceRef])

  const startDrawing = useCallback((buildingId: string) => {
    setDrawingMode({ buildingId, points: [] })
    const map = mapInstanceRef.current
    if (map) {
      map.getContainer().style.cursor = 'crosshair'
    }
  }, [mapInstanceRef])

  const finishDrawing = useCallback(() => {
    if (!drawingMode || drawingMode.points.length < 3) return
    onShowEditablePolygon(drawingMode.points)
    onSetEditingPolygon({ buildingId: drawingMode.buildingId, coordinates: drawingMode.points })
    clearDrawingMode()
  }, [drawingMode, clearDrawingMode, onShowEditablePolygon, onSetEditingPolygon])

  const undoDrawingPoint = useCallback(() => {
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
  }, [drawingMode, mapInstanceRef])

  /* ── Drawing mode map clicks ─────────────────────────────────────── */

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
  }, [drawingMode, mapInstanceRef, editingPolygonLayerRef])

  return {
    drawingMode,
    startDrawing,
    finishDrawing,
    undoDrawingPoint,
    clearDrawingMode,
  }
}
