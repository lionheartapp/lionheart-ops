// ─── Types ──────────────────────────────────────────────────────────────────

export interface BatchDetail {
  id: string
  name: string
  batchType: 'DEPLOYMENT' | 'COLLECTION'
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  schoolYear?: string | null
  grade?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  school?: { id: string; name: string } | null
  items: BatchItem[]
}

export interface BatchItem {
  id: string
  status: 'PENDING' | 'PROCESSED' | 'SKIPPED'
  condition?: string | null
  damageNotes?: string | null
  damageFeeCents?: number | null
  processedAt?: string | null
  device?: {
    id: string
    assetTag: string
    deviceType: string
    make?: string | null
    model?: string | null
  } | null
  student?: {
    id: string
    firstName: string
    lastName: string
    studentId?: string | null
    grade?: string | null
  } | null
}

export interface BatchProgress {
  total: number
  processed: number
  remaining: number
}

export interface StudentSearchResult {
  id: string
  firstName: string
  lastName: string
  studentId?: string | null
  grade?: string | null
  school?: { id: string; name: string } | null
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const CONDITION_OPTIONS = [
  { value: '', label: 'Select...' },
  { value: 'EXCELLENT', label: 'Excellent' },
  { value: 'GOOD', label: 'Good' },
  { value: 'FAIR', label: 'Fair' },
  { value: 'POOR', label: 'Poor' },
  { value: 'BROKEN', label: 'Broken' },
]

export const CONDITION_COLORS: Record<string, string> = {
  EXCELLENT: 'bg-green-100 text-green-700',
  GOOD: 'bg-blue-100 text-blue-700',
  FAIR: 'bg-yellow-100 text-yellow-700',
  POOR: 'bg-orange-100 text-orange-700',
  BROKEN: 'bg-red-100 text-red-700',
}
