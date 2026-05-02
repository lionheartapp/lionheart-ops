/* ------------------------------------------------------------------ */
/*  Types for InteractiveCampusMap                                     */
/* ------------------------------------------------------------------ */

export interface LatLng {
  lat: number
  lng: number
}

/**
 * Lightweight building shape used by the campus map.
 * This is a subset of the full Building type from ./types.tsx,
 * tailored for map rendering (includes polygon/lat-lng fields).
 */
export interface MapBuilding {
  id: string
  name: string
  code: string | null
  latitude: number | null
  longitude: number | null
  schoolDivision?: string
  school?: { color?: string } | null
  polygonCoordinates?: LatLng[] | null
}

export interface OutdoorSpace {
  id: string
  name: string
  areaType: string
  lat: number | null
  lng: number | null
  polygonCoordinates?: LatLng[] | null
}

export interface MapConfig {
  center: { lat: number; lng: number }
  address: string | null
  orgName: string
}

export interface InteractiveCampusMapProps {
  buildings: MapBuilding[]
  outdoorSpaces?: OutdoorSpace[]
  schools?: { name: string; color: string; gradeLevel?: string }[]
  mapCenter?: { lat: number; lng: number; name: string; address: string | null } | null
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
  /** When true, hides school legend and increases map height (single-campus view) */
  embedded?: boolean
  /** Campus name shown in map header when embedded */
  campusName?: string | null
}
