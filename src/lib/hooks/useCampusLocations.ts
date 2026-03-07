'use client'

import { useQuery } from '@tanstack/react-query'

interface RoomRaw {
  id: string
  roomNumber: string | null
  displayName: string | null
  floor: string | null
  areaId?: string | null
}

interface AreaRaw {
  id: string
  name: string
  areaType: string
  rooms?: RoomRaw[]
}

interface BuildingRaw {
  id: string
  name: string
  code: string | null
  areas: (AreaRaw & { rooms?: RoomRaw[] })[]
  rooms?: RoomRaw[]
}

interface UnassignedAreaRaw {
  id: string
  name: string
  areaType: string
  rooms?: RoomRaw[]
}

interface CampusLookupResponse {
  ok: boolean
  data: {
    buildings: BuildingRaw[]
    unassignedAreas: UnassignedAreaRaw[]
  }
}

export interface CampusLocationOption {
  label: string
  buildingId: string | null
  areaId: string | null
  roomId: string | null
  type: 'building' | 'area' | 'room'
  /** Display hierarchy for UI (e.g. "Main Building > 2nd Floor > Room 201") */
  hierarchy?: string[]
}

export function flattenCampusLocations(data: CampusLookupResponse['data']): CampusLocationOption[] {
  const options: CampusLocationOption[] = []

  for (const building of data.buildings) {
    // Add the building itself
    options.push({
      label: building.name,
      buildingId: building.id,
      areaId: null,
      roomId: null,
      type: 'building',
      hierarchy: [building.name],
    })

    // Add rooms directly under building (no area)
    if (building.rooms) {
      for (const room of building.rooms) {
        const roomLabel = room.displayName || room.roomNumber || `Room ${room.id}`
        options.push({
          label: roomLabel,
          buildingId: building.id,
          areaId: null,
          roomId: room.id,
          type: 'room',
          hierarchy: [building.name, roomLabel],
        })
      }
    }

    // Add each area under the building
    for (const area of building.areas) {
      options.push({
        label: `${building.name} — ${area.name}`,
        buildingId: building.id,
        areaId: area.id,
        roomId: null,
        type: 'area',
        hierarchy: [building.name, area.name],
      })

      // Add rooms within this area
      if (area.rooms) {
        for (const room of area.rooms) {
          const roomLabel = room.displayName || room.roomNumber || `Room ${room.id}`
          options.push({
            label: roomLabel,
            buildingId: building.id,
            areaId: area.id,
            roomId: room.id,
            type: 'room',
            hierarchy: [building.name, area.name, roomLabel],
          })
        }
      }
    }
  }

  // Add unassigned areas (no building)
  for (const area of data.unassignedAreas) {
    options.push({
      label: area.name,
      buildingId: null,
      areaId: area.id,
      roomId: null,
      type: 'area',
      hierarchy: [area.name],
    })

    // Add rooms within unassigned areas
    if (area.rooms) {
      for (const room of area.rooms) {
        const roomLabel = room.displayName || room.roomNumber || `Room ${room.id}`
        options.push({
          label: roomLabel,
          buildingId: null,
          areaId: area.id,
          roomId: room.id,
          type: 'room',
          hierarchy: [area.name, roomLabel],
        })
      }
    }
  }

  return options
}

async function fetchCampusLocations(): Promise<CampusLocationOption[]> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
  const res = await fetch('/api/campus/lookup', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) return []
  const json: CampusLookupResponse = await res.json()
  if (!json.ok) return []
  return flattenCampusLocations(json.data)
}

export function useCampusLocations() {
  return useQuery({
    queryKey: ['campus-locations'],
    queryFn: fetchCampusLocations,
    staleTime: 300_000,
  })
}
