// Pure utility functions and constants for the Schools feature.
// No React dependencies — safe to import from any context.

export type SchoolFormData = {
  name: string
  gradeLevel: 'ALL_GRADES' | 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL'
  color: string
  institutionType: string
  address: string
  principalName: string
  principalEmail: string
  principalPhone: string
  principalPhoneExt: string
}

export type PrincipalOption = {
  id: string
  name: string
  email: string
  phone: string | null
  jobTitle: string
  avatar: string | null
}

export type SuccessModalData = {
  schoolId: string
  schoolName: string
  principalId: string | null
  principalName: string
  principalEmail: string
  principalPhone: string
  principalPhoneExt: string
  principalJobTitle: string
}

export type PrincipalEditorData = {
  schoolId: string
  principalId: string | null
  principalName: string
  principalEmail: string
  principalPhone: string
  principalPhoneExt: string
  principalJobTitle: string
}

export const GRADE_LEVEL_DEFAULTS: Record<string, string> = {
  ALL_GRADES: '#3b82f6',
  ELEMENTARY: '#a855f7',
  MIDDLE_SCHOOL: '#14b8a6',
  HIGH_SCHOOL: '#ef4444',
}

export const COLOR_PRESETS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Slate', value: '#64748b' },
] as const

export const EMPTY_FORM: SchoolFormData = {
  name: '',
  gradeLevel: 'ALL_GRADES',
  color: '#3b82f6',
  institutionType: '',
  address: '',
  principalName: '',
  principalEmail: '',
  principalPhone: '',
  principalPhoneExt: '',
}

export const formatPhoneInput = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (!digits) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export const normalizeExtensionInput = (value: string): string =>
  value.replace(/\D/g, '').slice(0, 6)

export const normalizeSearchText = (value: string): string =>
  value.toLowerCase().trim().replace(/\s+/g, ' ')

export const splitSearchTokens = (value: string): string[] =>
  normalizeSearchText(value).split(' ').filter(Boolean)

export const matchesWordPrefixSequence = (name: string, query: string): boolean => {
  const nameTokens = splitSearchTokens(name)
  const queryTokens = splitSearchTokens(query)
  if (queryTokens.length === 0) return false
  if (queryTokens.length > nameTokens.length) return false

  let nameIndex = 0
  for (const queryToken of queryTokens) {
    let found = false
    while (nameIndex < nameTokens.length) {
      if (nameTokens[nameIndex].startsWith(queryToken)) {
        found = true
        nameIndex += 1
        break
      }
      nameIndex += 1
    }
    if (!found) return false
  }

  return true
}

export const isValidPhoneValue = (value: string): boolean => {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}
