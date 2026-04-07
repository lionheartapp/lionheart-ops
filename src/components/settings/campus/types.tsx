// Shared types and constants for the Campus settings tab

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
}

export type Area = {
  id: string
  name: string
  areaType: 'FIELD' | 'COURT' | 'GYM' | 'COMMON' | 'PARKING' | 'OTHER'
  buildingId: string | null
  images: string[] | null
  sortOrder: number
  isActive: boolean
  building?: { id: string; name: string; code: string | null } | null
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
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
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
