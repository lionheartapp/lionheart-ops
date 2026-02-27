'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Save, School } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import SchoolsManagement from './SchoolsManagement'

type SchoolInfo = {
  id: string
  name: string
  institutionType: 'PUBLIC' | 'PRIVATE' | 'CHARTER' | 'HYBRID' | null
  gradeLevel: 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL' | 'GLOBAL' | 'MULTI_SCHOOL_CAMPUS' | null
  slug: string
  physicalAddress: string | null
  district: string | null
  website: string | null
  phone: string | null
  principalName: string | null
  principalEmail: string | null
  principalPhone: string | null
  headOfSchoolsName: string | null
  headOfSchoolsEmail: string | null
  headOfSchoolsPhone: string | null
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

type FormState = {
  name: string
  institutionType: 'PUBLIC' | 'PRIVATE' | 'CHARTER' | 'HYBRID' | ''
  gradeLevel: 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL' | 'GLOBAL' | 'MULTI_SCHOOL_CAMPUS' | ''
  slug: string
  physicalAddress: string
  district: string
  website: string
  phone: string
  principalName: string
  principalEmail: string
  principalPhone: string
  headOfSchoolsName: string
  headOfSchoolsEmail: string
  headOfSchoolsPhone: string
  gradeRange: string
  studentCount: string
  staffCount: string
  logoUrl: string
  heroImageUrl: string
  imagePosition: 'LEFT' | 'RIGHT'
}

const EMPTY_FORM: FormState = {
  name: '',
  institutionType: '',
  gradeLevel: '',
  slug: '',
  physicalAddress: '',
  district: '',
  website: '',
  phone: '',
  principalName: '',
  principalEmail: '',
  principalPhone: '',
  headOfSchoolsName: '',
  headOfSchoolsEmail: '',
  headOfSchoolsPhone: '',
  gradeRange: '',
  studentCount: '',
  staffCount: '',
  logoUrl: '',
  heroImageUrl: '',
  imagePosition: 'LEFT',
}

function toFormState(data: SchoolInfo): FormState {
  return {
    name: data.name,
    institutionType: data.institutionType || '',
    gradeLevel: data.gradeLevel || '',
    slug: data.slug,
    physicalAddress: data.physicalAddress || '',
    district: data.district || '',
    website: data.website || '',
    phone: data.phone || '',
    principalName: data.principalName || '',
    principalEmail: data.principalEmail || '',
    principalPhone: data.principalPhone || '',
    headOfSchoolsName: data.headOfSchoolsName || '',
    headOfSchoolsEmail: data.headOfSchoolsEmail || '',
    headOfSchoolsPhone: data.headOfSchoolsPhone || '',
    gradeRange: data.gradeRange || '',
    studentCount: data.studentCount == null ? '' : String(data.studentCount),
    staffCount: data.staffCount == null ? '' : String(data.staffCount),
    logoUrl: data.logoUrl || '',
    heroImageUrl: data.heroImageUrl || '',
    imagePosition: data.imagePosition,
  }
}

function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

type SchoolInfoTabProps = {
  onDirtyChange?: (isDirty: boolean) => void
  onRegisterSave?: (handler: () => Promise<boolean>) => void
  onRegisterDiscard?: (handler: () => void) => void
}

function areFormsEqual(a: FormState, b: FormState) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export default function SchoolInfoTab({ onDirtyChange, onRegisterSave, onRegisterDiscard }: SchoolInfoTabProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [savedForm, setSavedForm] = useState<FormState>(EMPTY_FORM)
  const formRef = useRef<FormState>(EMPTY_FORM)
  const isDirty = useMemo(() => !areFormsEqual(form, savedForm), [form, savedForm])

  useEffect(() => {
    formRef.current = form
  }, [form])

  const getAuthHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth-token') : null
    const headers: Record<string, string> = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    return headers
  }

  const loadSchoolInfo = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/settings/school-info', {
        headers: getAuthHeaders(),
      })
      if (handleAuthResponse(response)) return
      const data = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data?.error?.message || 'Failed to load school information')
      }

      const nextForm = toFormState(data.data)
      setSchoolInfo(data.data)
      setForm(nextForm)
      setSavedForm(nextForm)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load school information')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSchoolInfo()
  }, [])

  useEffect(() => {
    if (!success) return
    const timeout = setTimeout(() => setSuccess(''), 2500)
    return () => clearTimeout(timeout)
  }, [success])

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isDirty])

  const saveSchoolInfo = useCallback(async () => {
    const currentForm = formRef.current
    setSaving(true)
    setError('')
    setSuccess('')

    const normalizedWebsite = currentForm.website.trim()
      ? currentForm.website.startsWith('http://') || currentForm.website.startsWith('https://')
        ? currentForm.website.trim()
        : `https://${currentForm.website.trim()}`
      : ''

    const payload = {
      ...currentForm,
      website: normalizedWebsite,
      slug: currentForm.slug.trim().toLowerCase(),
      studentCount: currentForm.studentCount.trim() === '' ? null : Number(currentForm.studentCount),
      staffCount: currentForm.staffCount.trim() === '' ? null : Number(currentForm.staffCount),
      institutionType: currentForm.institutionType || null,
      gradeLevel: currentForm.gradeLevel || null,
    }

    try {
      const response = await fetch('/api/settings/school-info', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      })
      if (handleAuthResponse(response)) return false

      const data = await response.json()
      if (!response.ok || !data.ok) {
        // For validation errors, show the first field-level message so the
        // user knows exactly which field to fix (e.g. "Logo URL must be valid")
        const details = data?.error?.details
        const firstFieldError =
          Array.isArray(details) && details.length > 0
            ? (details[0]?.message as string | undefined)
            : undefined
        throw new Error(firstFieldError || data?.error?.message || 'Failed to save school information')
      }

      setSchoolInfo((prev) =>
        prev
          ? {
              ...prev,
              ...data.data,
            }
          : data.data
      )
      const nextForm = toFormState(data.data)
      setForm(nextForm)
      setSavedForm(nextForm)

      if (typeof window !== 'undefined') {
        localStorage.setItem('org-name', data.data.name)
        if (data.data.logoUrl) {
          localStorage.setItem('org-logo-url', data.data.logoUrl)
        } else {
          localStorage.removeItem('org-logo-url')
        }
      }

      setSuccess('School information saved')
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save school information')
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  useEffect(() => {
    onRegisterSave?.(saveSchoolInfo)
  }, [onRegisterSave, saveSchoolInfo])

  const resetForm = useCallback(() => {
    setForm(savedForm)
    setError('')
    setSuccess('')
  }, [savedForm])

  useEffect(() => {
    onRegisterDiscard?.(resetForm)
  }, [onRegisterDiscard, resetForm])

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    await saveSchoolInfo()
  }

  const renderSkeleton = () => (
    <div className="space-y-8 animate-pulse py-2">
      {/* Header skeleton */}
      <div>
        <div className="h-8 w-48 bg-gray-200 rounded mb-2" />
        <div className="h-4 w-96 bg-gray-100 rounded" />
      </div>

      {/* School Info section */}
      <div className="space-y-4 pb-6 border-b border-gray-200">
        <div className="h-6 w-32 bg-gray-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
        </div>
      </div>

      {/* Principal Contact section */}
      <div className="space-y-4 pb-6 border-b border-gray-200">
        <div className="h-6 w-40 bg-gray-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
        </div>
      </div>

      {/* Enrollment & Staffing section */}
      <div className="space-y-4 pb-6 border-b border-gray-200">
        <div className="h-6 w-44 bg-gray-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
        </div>
      </div>

      {/* Branding section */}
      <div className="space-y-4 pb-6 border-b border-gray-200">
        <div className="h-6 w-32 bg-gray-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="flex gap-2">
            <div className="h-10 w-24 bg-gray-200 rounded" />
            <div className="h-10 w-24 bg-gray-200 rounded" />
          </div>
        </div>
      </div>

      {/* Metadata section */}
      <div className="rounded-lg bg-gray-50 p-4 space-y-3">
        <div className="h-6 w-24 bg-gray-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="h-4 w-20 bg-gray-200 rounded" />
            <div className="h-5 w-32 bg-gray-200 rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-20 bg-gray-200 rounded" />
            <div className="h-5 w-32 bg-gray-200 rounded" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-20 bg-gray-200 rounded" />
            <div className="h-5 w-32 bg-gray-200 rounded" />
          </div>
        </div>
      </div>

      {/* Action buttons skeleton */}
      <div className="flex gap-2 pt-4">
        <div className="h-10 w-24 bg-gray-200 rounded" />
        <div className="h-10 w-24 bg-gray-200 rounded" />
      </div>
    </div>
  )

  if (loading) {
    return renderSkeleton()
  }

  if (error && !schoolInfo) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        <button
          type="button"
          onClick={loadSchoolInfo}
          className="px-4 py-2 min-h-[40px] rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-8 pb-24">
      <section>
        <h2 className="flex items-center gap-3 text-2xl font-semibold text-gray-900">
          <School className="w-6 h-6 text-blue-600" />
          School Information
        </h2>
        <div className="h-px bg-gray-200 mt-4 mb-6" />

        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">School Name</label>
            <input className="ui-input" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Institution Type</label>
            <select className="ui-select w-full" value={form.institutionType} onChange={(event) => setForm((prev) => ({ ...prev, institutionType: event.target.value as any }))}>
              <option value="">-- Select Institution Type --</option>
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
              <option value="CHARTER">Charter</option>
              <option value="HYBRID">Hybrid</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Grade Level / Organization Type</label>
            <select className="ui-select w-full" value={form.gradeLevel} onChange={(event) => setForm((prev) => ({ ...prev, gradeLevel: event.target.value as any }))}>
              <option value="">-- Select Type --</option>
              <option value="ELEMENTARY">Elementary School</option>
              <option value="MIDDLE_SCHOOL">Middle School</option>
              <option value="HIGH_SCHOOL">High School</option>
              <option value="GLOBAL">Global</option>
              <option value="MULTI_SCHOOL_CAMPUS">Multi-School Campus</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subdomain Slug</label>
            <input className="ui-input" value={form.slug} onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))} required />
            <p className="mt-1 text-xs text-gray-500">Used as: {form.slug || 'your-school'}.lionheartapp.com</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">District</label>
            <input className="ui-input" value={form.district} onChange={(event) => setForm((prev) => ({ ...prev, district: event.target.value }))} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
            <input className="ui-input" placeholder="https://example.edu" value={form.website} onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">School Phone</label>
            <input className="ui-input" value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Grade Range</label>
            <input className="ui-input" placeholder="e.g., K-12" value={form.gradeRange} onChange={(event) => setForm((prev) => ({ ...prev, gradeRange: event.target.value }))} />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Physical Address</label>
            <input className="ui-input" value={form.physicalAddress} onChange={(event) => setForm((prev) => ({ ...prev, physicalAddress: event.target.value }))} />
          </div>
        </div>
      </section>

      {/* Conditional: Multi-School Campus Section */}
      {form.gradeLevel === 'MULTI_SCHOOL_CAMPUS' && (
        <section>
          <h3 className="text-lg font-semibold text-gray-900">Head of Schools Contact</h3>
          <div className="h-px bg-gray-200 mt-4 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input className="ui-input" value={form.headOfSchoolsName} onChange={(event) => setForm((prev) => ({ ...prev, headOfSchoolsName: event.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input className="ui-input" type="email" value={form.headOfSchoolsEmail} onChange={(event) => setForm((prev) => ({ ...prev, headOfSchoolsEmail: event.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <input className="ui-input" value={form.headOfSchoolsPhone} onChange={(event) => setForm((prev) => ({ ...prev, headOfSchoolsPhone: event.target.value }))} />
            </div>
          </div>
        </section>
      )}

      {/* Conditional: Single School Principal Contact */}
      {form.gradeLevel !== 'MULTI_SCHOOL_CAMPUS' && form.gradeLevel !== '' && (
        <section>
          <h3 className="text-lg font-semibold text-gray-900">Principal Contact</h3>
          <div className="h-px bg-gray-200 mt-4 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input className="ui-input" value={form.principalName} onChange={(event) => setForm((prev) => ({ ...prev, principalName: event.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input className="ui-input" type="email" value={form.principalEmail} onChange={(event) => setForm((prev) => ({ ...prev, principalEmail: event.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <input className="ui-input" value={form.principalPhone} onChange={(event) => setForm((prev) => ({ ...prev, principalPhone: event.target.value }))} />
            </div>
          </div>
        </section>
      )}

      {/* Schools Management - Multi-School Campus */}
      {form.gradeLevel === 'MULTI_SCHOOL_CAMPUS' && (
        <section>
          <h3 className="text-lg font-semibold text-gray-900">Manage Schools</h3>
          <div className="h-px bg-gray-200 mt-4 mb-6" />
          <SchoolsManagement />
        </section>
      )}

      <section>
        <h3 className="text-lg font-semibold text-gray-900">Enrollment & Staffing</h3>
        <div className="h-px bg-gray-200 mt-4 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Student Count</label>
            <input
              className="ui-input"
              type="number"
              min={0}
              value={form.studentCount}
              onChange={(event) => setForm((prev) => ({ ...prev, studentCount: event.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Staff Count</label>
            <input
              className="ui-input"
              type="number"
              min={0}
              value={form.staffCount}
              onChange={(event) => setForm((prev) => ({ ...prev, staffCount: event.target.value }))}
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900">Branding</h3>
        <div className="h-px bg-gray-200 mt-4 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Logo URL</label>
            <input className="ui-input" value={form.logoUrl} onChange={(event) => setForm((prev) => ({ ...prev, logoUrl: event.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Hero Image URL</label>
            <input className="ui-input" value={form.heroImageUrl} onChange={(event) => setForm((prev) => ({ ...prev, heroImageUrl: event.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Image Position</label>
            <select className="ui-select w-full" value={form.imagePosition} onChange={(event) => setForm((prev) => ({ ...prev, imagePosition: event.target.value as FormState['imagePosition'] }))}>
              <option value="LEFT">Left</option>
              <option value="RIGHT">Right</option>
            </select>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900">Workspace Metadata</h3>
        <div className="h-px bg-gray-200 mt-4 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-gray-500">Organization ID</p>
            <p className="mt-1 font-medium text-gray-900 break-all">{schoolInfo?.id || '—'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-gray-500">Created At</p>
            <p className="mt-1 font-medium text-gray-900">{schoolInfo ? formatTimestamp(schoolInfo.createdAt) : '—'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 md:col-span-2">
            <p className="text-gray-500">Primary Admin Contact</p>
            <p className="mt-1 font-medium text-gray-900">{schoolInfo?.primaryAdminContact.name || '—'}</p>
            <p className="text-gray-600">{schoolInfo?.primaryAdminContact.email || '—'}</p>
            <p className="text-gray-600">{schoolInfo?.primaryAdminContact.phone || '—'}</p>
            <p className="text-gray-600">{schoolInfo?.primaryAdminContact.title || '—'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 md:col-span-2">
            <p className="text-gray-500">Campus Snapshot</p>
            <p className="mt-1 font-medium text-gray-900">
              Buildings: {schoolInfo?.campusSnapshot.buildings ?? 0} · Areas: {schoolInfo?.campusSnapshot.areas ?? 0} · Rooms: {schoolInfo?.campusSnapshot.rooms ?? 0}
            </p>
          </div>
        </div>
      </section>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={resetForm}
          disabled={saving}
          className="px-4 py-2 min-h-[40px] rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset
        </button>
      </div>

      {isDirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-10 lg:px-8">
            <p className="text-sm text-gray-700">You have unsaved school information changes.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="px-4 py-2 min-h-[40px] rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={saveSchoolInfo}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
