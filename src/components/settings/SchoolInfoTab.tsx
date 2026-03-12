'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Save, School, CheckCircle, XCircle, Pencil } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { handleAuthResponse } from '@/lib/client-auth'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'
import { Clock } from 'lucide-react'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { FloatingInput, FloatingDropdown } from '@/components/ui/FloatingInput'
import ImageDropZone from '@/components/settings/ImageDropZone'

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

// ─── Standalone Event Buffer Section ────────────────────────────────────
function EventBufferSection() {
  const [bufferMinutes, setBufferMinutes] = useState<number | null>(null)
  const [savedValue, setSavedValue] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetchApi<{ eventBufferMinutes: number }>('/api/settings/organization')
      .then((data) => {
        setBufferMinutes(data.eventBufferMinutes)
        setSavedValue(data.eventBufferMinutes)
      })
      .catch(() => {})
  }, [])

  const handleSave = async () => {
    if (bufferMinutes === null || bufferMinutes === savedValue) return
    setSaving(true)
    try {
      const res = await fetch('/api/settings/organization', {
        method: 'PATCH',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: JSON.stringify({ eventBufferMinutes: bufferMinutes }),
      })
      const json = await res.json()
      if (json.ok) {
        setSavedValue(bufferMinutes)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch {
      // silently fail
    }
    setSaving(false)
  }

  if (bufferMinutes === null) return null

  const isDirty = bufferMinutes !== savedValue

  return (
    <section>
      <h3 className="text-lg font-semibold text-gray-900">Event Settings</h3>
      <div className="h-px bg-gray-200 mt-2 mb-4" />
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
          <Clock className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 space-y-1">
          <label htmlFor="event-buffer" className="text-sm font-medium text-gray-900">
            Location buffer time
          </label>
          <p className="text-xs text-gray-500">
            Minimum minutes between events at the same location. Set to 0 to disable.
          </p>
          <div className="flex items-center gap-3 mt-2">
            <input
              id="event-buffer"
              type="number"
              min={0}
              max={480}
              value={bufferMinutes}
              onChange={(e) => setBufferMinutes(Math.max(0, Math.min(480, parseInt(e.target.value) || 0)))}
              className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-300"
            />
            <span className="text-sm text-gray-500">minutes</span>
            {isDirty && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-full hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
            {saved && (
              <span className="text-xs text-green-600 font-medium">Saved</span>
            )}
          </div>
        </div>
      </div>
    </section>
  )
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

  // Slug editing state
  const [slugEditing, setSlugEditing] = useState(false)
  const [slugInput, setSlugInput] = useState('')
  const [slugValidating, setSlugValidating] = useState(false)
  const [slugValid, setSlugValid] = useState<null | true | string>(null) // null=unchecked, true=valid, string=error
  const [slugSaving, setSlugSaving] = useState(false)
  const [slugSuccess, setSlugSuccess] = useState('')
  const [slugError, setSlugError] = useState('')
  const slugDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Slug editing helpers
  const openSlugEdit = () => {
    setSlugInput(form.slug)
    setSlugValid(null)
    setSlugError('')
    setSlugSuccess('')
    setSlugEditing(true)
  }

  const cancelSlugEdit = () => {
    setSlugEditing(false)
    setSlugInput('')
    setSlugValid(null)
    setSlugError('')
    setSlugSuccess('')
    if (slugDebounceRef.current) clearTimeout(slugDebounceRef.current)
  }

  const validateSlugFormat = (slug: string): string | null => {
    if (slug.length < 3) return 'Slug must be at least 3 characters'
    if (slug.length > 50) return 'Slug must be 50 characters or less'
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return 'Slug can only contain lowercase letters, numbers, and hyphens'
    }
    return null
  }

  const handleSlugInputChange = (value: string) => {
    const normalized = value.toLowerCase().trim()
    setSlugInput(normalized)
    setSlugValid(null)
    setSlugError('')

    if (slugDebounceRef.current) clearTimeout(slugDebounceRef.current)

    const formatError = validateSlugFormat(normalized)
    if (formatError) {
      setSlugValid(formatError)
      return
    }

    // Don't check if same as current slug
    if (normalized === form.slug) {
      setSlugValid(true)
      return
    }

    setSlugValidating(true)
    slugDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/organizations/slug-check?slug=${encodeURIComponent(normalized)}`)
        const data = await res.json()
        if (data.ok && data.data?.valid) {
          setSlugValid(true)
        } else {
          setSlugValid(data.data?.reason || 'Slug is not available')
        }
      } catch {
        setSlugValid('Could not validate slug')
      } finally {
        setSlugValidating(false)
      }
    }, 300)
  }

  const handleSlugSave = async () => {
    if (slugValid !== true || slugSaving) return

    setSlugSaving(true)
    setSlugError('')

    try {
      const res = await fetch('/api/settings/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ slug: slugInput }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data?.error?.message || 'Failed to update subdomain')

      // Update form state and localStorage
      setForm((prev) => ({ ...prev, slug: slugInput }))
      setSavedForm((prev) => ({ ...prev, slug: slugInput }))
      if (typeof window !== 'undefined') {
        localStorage.setItem('org-slug', slugInput)
      }
      setSlugSuccess(`Subdomain updated to ${slugInput}.lionheartapp.com`)
      setSlugEditing(false)
    } catch (err) {
      setSlugError(err instanceof Error ? err.message : 'Failed to update subdomain')
    } finally {
      setSlugSaving(false)
    }
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
          className="px-4 py-2 min-h-[40px] rounded-full bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition"
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
          <School className="w-6 h-6 text-primary-600" />
          School Information
        </h2>
        <div className="h-px bg-gray-200 mt-4 mb-6" />

        {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {success && <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
          <FloatingInput id="si-schoolName" label="School Name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />

          <FloatingDropdown id="si-institutionType" label="Institution Type" value={form.institutionType} onChange={(v) => setForm((prev) => ({ ...prev, institutionType: v as any }))} options={[
            { value: '', label: '-- Select Institution Type --' },
            { value: 'PUBLIC', label: 'Public' },
            { value: 'PRIVATE', label: 'Private' },
            { value: 'CHARTER', label: 'Charter' },
            { value: 'HYBRID', label: 'Hybrid' },
          ]} />

          <FloatingDropdown id="si-gradeLevel" label="Grade Level / Organization Type" value={form.gradeLevel} onChange={(v) => setForm((prev) => ({ ...prev, gradeLevel: v as any }))} options={[
            { value: '', label: '-- Select Type --' },
            { value: 'ELEMENTARY', label: 'Elementary School' },
            { value: 'MIDDLE_SCHOOL', label: 'Middle School' },
            { value: 'HIGH_SCHOOL', label: 'High School' },
            { value: 'GLOBAL', label: 'Global' },
            { value: 'MULTI_SCHOOL_CAMPUS', label: 'Multi-School Campus' },
          ]} />

          <FloatingInput id="si-district" label="District" value={form.district} onChange={(event) => setForm((prev) => ({ ...prev, district: event.target.value }))} />

          <FloatingInput id="si-website" label="Website" value={form.website} onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))} />

          <FloatingInput id="si-phone" label="School Phone" value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />

          <FloatingInput id="si-gradeRange" label="Grade Range" value={form.gradeRange} onChange={(event) => setForm((prev) => ({ ...prev, gradeRange: event.target.value }))} />

          <div className="md:col-span-2">
            <label htmlFor="si-physicalAddress" className="block text-xs text-gray-500 font-medium mb-1.5">Physical Address</label>
            <AddressAutocomplete
              value={form.physicalAddress}
              onChange={(value) => setForm((prev) => ({ ...prev, physicalAddress: value }))}
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900">Enrollment & Staffing</h3>
        <div className="h-px bg-gray-200 mt-4 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
          <FloatingInput id="si-studentCount" label="Student Count" type="number" min={0} value={form.studentCount} onChange={(event) => setForm((prev) => ({ ...prev, studentCount: event.target.value }))} />
          <FloatingInput id="si-staffCount" label="Staff Count" type="number" min={0} value={form.staffCount} onChange={(event) => setForm((prev) => ({ ...prev, staffCount: event.target.value }))} />
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900">Branding</h3>
        <div className="h-px bg-gray-200 mt-4 mb-6" />

        {/* Subdomain slug management */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div>
              <p className="text-sm font-medium text-gray-700">Subdomain</p>
              <p className="text-xs text-gray-500 mt-0.5">
                <span className="font-mono text-gray-800">{form.slug || 'your-school'}</span>
                .lionheartapp.com
              </p>
            </div>
            {!slugEditing && (
              <button
                type="button"
                onClick={openSlugEdit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200 cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
                Change Slug
              </button>
            )}
          </div>

          <AnimatePresence>
            {slugSuccess && !slugEditing && (
              <motion.div
                key="slug-success"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {slugSuccess}
                </div>
              </motion.div>
            )}

            {slugEditing && (
              <motion.div
                key="slug-edit"
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-4">
                  <div className="rounded-lg border border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-800">
                    Changing your subdomain will update all links to your organization. Existing bookmarks will stop working.
                  </div>

                  {slugError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {slugError}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-700">
                      Type the new slug to confirm
                    </label>
                    <div className="relative">
                      <FloatingInput
                        id="si-slug-new"
                        label="New subdomain slug"
                        value={slugInput}
                        onChange={(e) => handleSlugInputChange(e.target.value)}
                        disabled={slugSaving}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                        {slugValidating && (
                          <span className="inline-block h-4 w-4 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
                        )}
                        {!slugValidating && slugValid === true && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        {!slugValidating && typeof slugValid === 'string' && (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    </div>
                    {typeof slugValid === 'string' && (
                      <p className="text-xs text-red-600">{slugValid}</p>
                    )}
                    {slugValid === true && slugInput !== form.slug && (
                      <p className="text-xs text-green-600">
                        {slugInput}.lionheartapp.com is available
                      </p>
                    )}
                    {slugValid === true && slugInput === form.slug && (
                      <p className="text-xs text-gray-500">
                        That is already your current slug
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSlugSave}
                      disabled={slugValid !== true || slugSaving || slugInput === form.slug}
                      className="px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {slugSaving ? 'Saving...' : 'Confirm Change'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelSlugEdit}
                      disabled={slugSaving}
                      className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider between slug section and image uploads */}
        <div className="h-px bg-gray-200 my-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
          <ImageDropZone
            label="Logo"
            imageUrl={form.logoUrl}
            imageType="logo"
            onImageChange={(url) => setForm((prev) => ({ ...prev, logoUrl: url || '' }))}
            aspectRatio="aspect-[3/2]"
            disabled={saving}
          />
          <ImageDropZone
            label="Hero Image"
            imageUrl={form.heroImageUrl}
            imageType="hero"
            onImageChange={(url) => setForm((prev) => ({ ...prev, heroImageUrl: url || '' }))}
            aspectRatio="aspect-video"
            disabled={saving}
          />
          <FloatingDropdown id="si-imagePosition" label="Image Position" value={form.imagePosition} onChange={(v) => setForm((prev) => ({ ...prev, imagePosition: v as FormState['imagePosition'] }))} options={[
            { value: 'LEFT', label: 'Left' },
            { value: 'RIGHT', label: 'Right' },
          ]} />
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

      {/* Event Buffer Settings — standalone, separate from school-info form */}
      <EventBufferSection />

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={resetForm}
          disabled={saving}
          className="px-4 py-2 min-h-[40px] rounded-full bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset
        </button>
      </div>

      {isDirty && (
        <div className="fixed inset-x-0 bottom-0 z-mobilenav border-t border-gray-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-10 lg:px-8">
            <p className="text-sm text-gray-700">You have unsaved school information changes.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="px-4 py-2 min-h-[40px] rounded-full bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={saveSchoolInfo}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
