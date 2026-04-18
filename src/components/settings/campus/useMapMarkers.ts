/* ------------------------------------------------------------------ */
/*  Map marker & polygon management callbacks                          */
/* ------------------------------------------------------------------ */

import { useCallback, type MutableRefObject, type Dispatch, type SetStateAction } from 'react'
import type { LatLng, MapBuilding, OutdoorSpace } from './map-types'
import {
  createBuildingCircleIcon,
  createOutdoorIcon,
  createPolygonLabel,
} from './map-icons'

interface UseMapMarkersOptions {
  markersRef: MutableRefObject<Map<string, any>>
  polygonsRef: MutableRefObject<Map<string, any>>
  labelsRef: MutableRefObject<Map<string, any>>
  editable: boolean
  setPendingMoves: Dispatch<SetStateAction<Map<string, { lat: number; lng: number }>>>
  onBuildingSelected?: (buildingId: string) => void
  onEditBuilding?: (buildingId: string) => void
  onDeleteBuilding?: (buildingId: string) => void
  onManageRooms?: (buildingId: string) => void
  onEditOutdoor?: (outdoorId: string) => void
  onDeleteOutdoor?: (outdoorId: string) => void
  onOutdoorPositionChange?: (areaId: string, lat: number, lng: number) => void
}

interface UseMapMarkersReturn {
  addBuildingPolygon: (L: any, map: any, building: MapBuilding, color: string) => void
  addBuildingMarker: (L: any, map: any, building: MapBuilding, color: string) => void
  addOutdoorPolygon: (L: any, map: any, space: OutdoorSpace, color: string) => void
  addOutdoorMarker: (L: any, map: any, space: OutdoorSpace, color: string) => void
}

export function useMapMarkers({
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
}: UseMapMarkersOptions): UseMapMarkersReturn {

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
  }, [onBuildingSelected, polygonsRef, labelsRef])

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
  }, [editable, onBuildingSelected, onEditBuilding, onDeleteBuilding, onManageRooms, markersRef, setPendingMoves])

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
  }, [polygonsRef, labelsRef])

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
  }, [editable, onOutdoorPositionChange, onEditOutdoor, onDeleteOutdoor, markersRef])

  return {
    addBuildingPolygon,
    addBuildingMarker,
    addOutdoorPolygon,
    addOutdoorMarker,
  }
}
