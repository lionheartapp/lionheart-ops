'use client'

import { useQuery } from '@tanstack/react-query'

interface BuildingRaw {
  id: string
  name: string
  code: string | null
  areas: { id: string; name: string; areaType: string }[]
}

interface UnassignedAreaRaw {
  id: string
  name: string
  areaType: string
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
  type: 'building' | 'area'
}

export function flattenCampusLocations(data: CampusLookupResponse['data']): CampusLocationOption[] {
  const options: CampusLocationOption[] = []

  for (const building of data.buildings) {
    // Add the building itself
    options.push({
      label: building.name,
      buildingId: building.id,
      areaId: null,
      type: 'building',
    })

    // Add each area under the building
    for (const area of building.areas) {
      options.push({
        label: `${building.name} — ${area.name}`,
        buildingId: building.id,
        areaId: area.id,
        type: 'area',
      })
    }
  }

  // Add unassigned areas (no building)
  for (const area of data.unassignedAreas) {
    options.push({
      label: area.name,
      buildingId: null,
      areaId: area.id,
      type: 'area',
    })
  }

  return options
}

async function fetchCampusLocations(): Promise<CampusLocationOption[]> {
  const res = await fetch('/api/campus/lookup')
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
