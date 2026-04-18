export type SchoolInfo = {
  id: string
  name: string
  institutionType: 'PUBLIC' | 'PRIVATE' | 'CHARTER' | 'HYBRID' | null
  gradeLevel: 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL' | 'GLOBAL' | 'MULTI_SCHOOL_CAMPUS' | null
  slug: string
  physicalAddress: string | null
  district: string | null
  website: string | null
  phone: string | null
  gradeRange: string | null
  studentCount: number | null
  staffCount: number | null
  logoUrl: string | null
  heroImageUrl: string | null
  imagePosition: 'LEFT' | 'RIGHT'
  createdAt: string
  updatedAt: string
  primaryAdminContact: {
    name: string | null
    email: string | null
    phone: string | null
    title: string | null
  }
  campusSnapshot: {
    buildings: number
    areas: number
    rooms: number
  }
}

export type FormState = {
  name: string
  institutionType: 'PUBLIC' | 'PRIVATE' | 'CHARTER' | 'HYBRID' | ''
  gradeLevel: 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL' | 'GLOBAL' | 'MULTI_SCHOOL_CAMPUS' | ''
  slug: string
  physicalAddress: string
  district: string
  website: string
  phone: string
  gradeRange: string
  studentCount: string
  staffCount: string
  logoUrl: string
  heroImageUrl: string
  imagePosition: 'LEFT' | 'RIGHT'
}

export const EMPTY_FORM: FormState = {
  name: '',
  institutionType: '',
  gradeLevel: '',
  slug: '',
  physicalAddress: '',
  district: '',
  website: '',
  phone: '',
  gradeRange: '',
  studentCount: '',
  staffCount: '',
  logoUrl: '',
  heroImageUrl: '',
  imagePosition: 'LEFT',
}

export function toFormState(data: SchoolInfo): FormState {
  return {
    name: data.name,
    institutionType: data.institutionType || '',
    gradeLevel: data.gradeLevel || '',
    slug: data.slug,
    physicalAddress: data.physicalAddress || '',
    district: data.district || '',
    website: data.website || '',
    phone: data.phone || '',
    gradeRange: data.gradeRange || '',
    studentCount: data.studentCount == null ? '' : String(data.studentCount),
    staffCount: data.staffCount == null ? '' : String(data.staffCount),
    logoUrl: data.logoUrl || '',
    heroImageUrl: data.heroImageUrl || '',
    imagePosition: data.imagePosition,
  }
}

export function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

export function areFormsEqual(a: FormState, b: FormState): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
