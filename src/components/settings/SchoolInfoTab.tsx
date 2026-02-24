'use client'

import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'

type SchoolInfo = {
  id: string
  name: string
  schoolType: 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL' | 'GLOBAL'
  slug: string
  physicalAddress: string | null
  district: string | null
  website: string | null
  phone: string | null
  principalTitle: string | null
  principalName: string | null
  principalEmail: string | null
  principalPhone: string | null
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
  schoolType: 'ELEMENTARY' | 'MIDDLE_SCHOOL' | 'HIGH_SCHOOL' | 'GLOBAL'
  slug: string
  physicalAddress: string
  district: string
  website: string
  phone: string
  principalTitle: string
  principalName: string
  principalEmail: string
  principalPhone: string
  gradeRange: string
  studentCount: string
  staffCount: string
  logoUrl: string
  heroImageUrl: string
  imagePosition: 'LEFT' | 'RIGHT'
}

const EMPTY_FORM: FormState = {
  name: '',
  schoolType: 'GLOBAL',
  slug: '',
  physicalAddress: '',
  district: '',
  website: '',
  phone: '',
  principalTitle: '',
  principalName: '',
  principalEmail: '',
  principalPhone: '',
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
    schoolType: data.schoolType,
    slug: data.slug,
    physicalAddress: data.physicalAddress || '',
    district: data.district || '',
    website: data.website || '',
    phone: data.phone || '',
    principalTitle: data.principalTitle || '',
    principalName: data.principalName || '',
    principalEmail: data.principalEmail || '',
    principalPhone: data.principalPhone || '',
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

export default function SchoolInfoTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

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
      const data = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data?.error?.message || 'Failed to load school information')
      }

      setSchoolInfo(data.data)
      setForm(toFormState(data.data))
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

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    const normalizedWebsite = form.website.trim()
      ? form.website.startsWith('http://') || form.website.startsWith('https://')
        ? form.website.trim()
        : `https://${form.website.trim()}`
      : ''

    const payload = {
      ...form,
      website: normalizedWebsite,
      slug: form.slug.trim().toLowerCase(),
      studentCount: form.studentCount.trim() === '' ? null : Number(form.studentCount),
      staffCount: form.staffCount.trim() === '' ? null : Number(form.staffCount),
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

      const data = await response.json()
      if (!response.ok || !data.ok) {
        throw new Error(data?.error?.message || 'Failed to save school information')
      }

      setSchoolInfo((prev) =>
        prev
          ? {
              ...prev,
              ...data.data,
            }
          : data.data
      )
      setForm(toFormState(data.data))

      if (typeof window !== 'undefined') {
        localStorage.setItem('org-name', data.data.name)
        localStorage.setItem('org-school-type', data.data.schoolType)
        if (data.data.logoUrl) {
          localStorage.setItem('org-logo-url', data.data.logoUrl)
        } else {
          localStorage.removeItem('org-logo-url')
        }
      }

      setSuccess('School information saved')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save school information')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    if (!schoolInfo) return
    setForm(toFormState(schoolInfo))
    setError('')
    setSuccess('')
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
    <form onSubmit={handleSave} className="space-y-8">
      <section>
        <h2 className="text-3xl font-semibold text-gray-900">School Information</h2>
        <div className="h-px bg-gray-200 mt-4 mb-6" />

        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">School Name</label>
            <input className="ui-input" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">School Type</label>
            <select className="ui-select w-full" value={form.schoolType} onChange={(event) => setForm((prev) => ({ ...prev, schoolType: event.target.value as FormState['schoolType'] }))}>
              <option value="ELEMENTARY">Elementary</option>
              <option value="MIDDLE_SCHOOL">Middle School</option>
              <option value="HIGH_SCHOOL">High School</option>
              <option value="GLOBAL">Global</option>
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

      <section>
        <h3 className="text-2xl font-semibold text-gray-900">Principal Contact</h3>
        <div className="h-px bg-gray-200 mt-4 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
            <input className="ui-input" placeholder="Principal" value={form.principalTitle} onChange={(event) => setForm((prev) => ({ ...prev, principalTitle: event.target.value }))} />
          </div>
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

      <section>
        <h3 className="text-2xl font-semibold text-gray-900">Enrollment & Staffing</h3>
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
        <h3 className="text-2xl font-semibold text-gray-900">Branding</h3>
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
        <h3 className="text-2xl font-semibold text-gray-900">Workspace Metadata</h3>
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
    </form>
  )
}
