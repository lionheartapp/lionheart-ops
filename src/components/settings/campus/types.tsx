// Shared types and constants for the Campus settings tab

export type SchoolLink = { id: string; name: string; gradeLevel: string; color: string }

export type Building = {
  id: string
  name: string
  code: string | null
  latitude: number | null
  longitude: number | null
  schoolDivision: 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL' | 'GLOBAL'
  buildingType: 'GENERAL' | 'ARTS_CULTURE' | 'ATHLETICS' | 'ADMINISTRATION' | 'SUPPORT_SERVICES'
  images: string[] | null
  sortOrder: number
  isActive: boolean
  school?: { id: string; name: string; gradeLevel: string; color: string } | null
  /** Schools this building is scoped to (M:N). Empty array = shared with all schools. */
  schools?: SchoolLink[]
  polygonCoordinates?: Array<{ lat: number; lng: number }> | null
}

export type Area = {
  id: string
  name: string
  areaType: 'FIELD' | 'COURT' | 'GYM' | 'COMMON' | 'PARKING' | 'OTHER'
  buildingId: string | null
  latitude: number | null
  longitude: number | null
  images: string[] | null
  sortOrder: number
  isActive: boolean
  building?: { id: string; name: string; code: string | null } | null
  /** Schools this area is scoped to (M:N). Empty array = shared with all schools. */
  schools?: SchoolLink[]
}

export type Room = {
  id: string
  buildingId: string
  areaId: string | null
  roomNumber: string
  displayName: string | null
  floor: string | null
  images: string[] | null
  sortOrder: number
  isActive: boolean
  building?: { id: string; name: string; code: string | null } | null
  area?: { id: string; name: string; areaType: string } | null
}

export type Campus = {
  id: string
  name: string
  campusType: 'HEADQUARTERS' | 'CAMPUS' | 'SATELLITE'
  address: string | null
}

export type SchoolInfo = {
  id: string
  name: string
  color: string
  gradeLevel: string
}

export type DeleteConfirm = {
  type: 'building' | 'outdoor' | 'room'
  id: string
  name: string
  roomCount: number
  ticketCount: number
  action: 'delete' | 'deactivate'
}

// ─── Constants ────────────────────────────────────────────────────────────

export const DIVISION_LABELS: Record<string, string> = {
  GLOBAL: 'Global',
  ELEMENTARY: 'Elementary',
  MIDDLE_SCHOOL: 'Middle School',
  HIGH_SCHOOL: 'High School',
}

export const DIVISION_ORDER = ['ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL', 'GLOBAL'] as const

export const DIVISION_COLORS: Record<string, string> = {
  ELEMENTARY: '#7c3aed',
  MIDDLE_SCHOOL: '#0891b2',
  HIGH_SCHOOL: '#dc2626',
  GLOBAL: '#2563eb',
}

export const BUILDING_TYPE_LABELS: Record<string, string> = {
  GENERAL: 'General',
  ARTS_CULTURE: 'Arts & Culture',
  ATHLETICS: 'Athletics',
  ADMINISTRATION: 'Administration',
  SUPPORT_SERVICES: 'Support Services',
}

export const OUTDOOR_TYPE_LABELS: Record<string, string> = {
  FIELD: 'Athletic Field',
  COURT: 'Court',
  GYM: 'Gymnasium',
  COMMON: 'Gathering Area',
  PARKING: 'Parking',
  OTHER: 'Other',
}

// ─── Render helpers ───────────────────────────────────────────────────────

export function renderStatusBadge(isActive: boolean) {
  return (
    <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${isActive ? 'bg-green-50 text-green-600 ring-1 ring-green-200' : 'bg-slate-50 text-slate-400 ring-1 ring-slate-200'}`}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}

export function renderSkeleton() {
  return (
    <div className="ui-glass-table animate-pulse p-4 space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2">
          <div className="h-4 w-40 bg-slate-200 rounded" />
          <div className="h-4 w-24 bg-slate-200 rounded" />
          <div className="h-4 w-16 bg-slate-200 rounded" />
          <div className="h-4 w-12 bg-slate-200 rounded flex-1" />
        </div>
      ))}
    </div>
  )
}
