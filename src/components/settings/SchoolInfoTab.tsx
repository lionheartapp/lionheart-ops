'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Save, School, Globe } from 'lucide-react'
import { handleAuthResponse } from '@/lib/client-auth'
import { FloatingInput } from '@/components/ui/FloatingInput'
import BrandingSection from '@/components/settings/school-info/BrandingSection'
import SchoolsManagement from '@/components/settings/SchoolsManagement'
import {
  type SchoolInfo,
  type FormState,
  EMPTY_FORM,
  toFormState,
  formatTimestamp,
  areFormsEqual,
} from '@/components/settings/school-info/school-info-types'

type SchoolInfoTabProps = {
  onDirtyChange?: (isDirty: boolean) => void
  onRegisterSave?: (handler: () => Promise<boolean>) => void
  onRegisterDiscard?: (handler: () => void) => void
  securitySection?: React.ReactNode
}

type SchoolInfoSubTab = 'organization' | 'schools' | 'branding-settings'

const SCHOOL_INFO_TABS: { key: SchoolInfoSubTab; label: string }[] = [
  { key: 'organization', label: 'Organization' },
  { key: 'schools', label: 'Schools' },
  { key: 'branding-settings', label: 'Branding & Settings' },
]

export default function SchoolInfoTab({ onDirtyChange, onRegisterSave, onRegisterDiscard, securitySection }: SchoolInfoTabProps) {
  const [subTab, setSubTab] = useState<SchoolInfoSubTab>('organization')
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

  const loadSchoolInfo = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    loadSchoolInfo()
  }, [loadSchoolInfo])

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
        // Notify sidebar to pick up branding changes without a full page reload
        window.dispatchEvent(new CustomEvent('branding-changed', {
          detail: { name: data.data.name, logoUrl: data.data.logoUrl || null },
        }))
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
    <div className="space-y-6 animate-pulse py-2">
      {/* School Details card */}
      <div className="ui-glass p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-slate-200" />
          <div className="space-y-1.5">
            <div className="h-4 w-28 bg-slate-200 rounded" />
            <div className="h-3 w-48 bg-slate-100 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-10 bg-slate-200 rounded" />
          <div className="h-10 bg-slate-200 rounded" />
          <div className="h-10 bg-slate-200 rounded" />
          <div className="h-10 bg-slate-200 rounded" />
        </div>
      </div>

      {/* Enrollment & Staffing card */}
      <div className="ui-glass p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-slate-200" />
          <div className="space-y-1.5">
            <div className="h-4 w-36 bg-slate-200 rounded" />
            <div className="h-3 w-32 bg-slate-100 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-10 bg-slate-200 rounded" />
          <div className="h-10 bg-slate-200 rounded" />
        </div>
      </div>

      {/* Branding card */}
      <div className="ui-glass p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-slate-200" />
          <div className="space-y-1.5">
            <div className="h-4 w-20 bg-slate-200 rounded" />
            <div className="h-3 w-44 bg-slate-100 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-24 bg-slate-200 rounded" />
          <div className="h-24 bg-slate-200 rounded" />
        </div>
      </div>

      {/* Workspace Metadata card */}
      <div className="ui-glass p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-slate-200" />
          <div className="space-y-1.5">
            <div className="h-4 w-36 bg-slate-200 rounded" />
            <div className="h-3 w-28 bg-slate-100 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-16 bg-slate-100 rounded-lg" />
          <div className="h-16 bg-slate-100 rounded-lg" />
        </div>
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
          className="px-4 py-2 min-h-[40px] rounded-full bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 pb-24">
      {/* Header — full-width, flush top */}
      <div className="-mt-6 lg:-mt-8 -mx-4 sm:-mx-10 px-4 sm:px-10 py-5 bg-white/60 backdrop-blur-sm border-b border-slate-200/60">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
            <School className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Organization</h3>
            <p className="text-sm text-slate-500 mt-0.5">Manage your organization details, branding, and settings</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mt-5 pt-5 border-t border-slate-200/60">
          <div className="inline-flex gap-1 rounded-full bg-slate-100 p-1">
            {SCHOOL_INFO_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setSubTab(t.key)}
                className={`relative px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 cursor-pointer ${
                  subTab === t.key ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {subTab === t.key && (
                  <motion.div
                    layoutId="schoolInfoTabPill"
                    className="absolute inset-0 rounded-full bg-slate-900"
                    transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
                  />
                )}
                <span className="relative z-10">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>}

      {/* ── Organization tab ── */}
      <div className={subTab !== 'organization' ? 'hidden' : 'space-y-6'}>

      {/* Organization Details */}
      <section className="ui-glass p-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
            <School className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Organization Details</h3>
            <p className="text-sm text-slate-500 mt-0.5">Basic information about your organization</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
          <FloatingInput id="si-schoolName" label="Organization Name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
          <FloatingInput id="si-website" label="Website" value={form.website} onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))} />
          <FloatingInput id="si-phone" label="Phone" value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
        </div>
      </section>
      </div>

      {/* ── Schools tab ── */}
      <div className={subTab !== 'schools' ? 'hidden' : undefined}>
        <SchoolsManagement />
      </div>

      {/* ── Branding & Settings tab ── */}
      <div className={subTab !== 'branding-settings' ? 'hidden' : 'space-y-6'}>
      <BrandingSection
        form={form}
        setForm={setForm}
        saving={saving}
        slugEditing={slugEditing}
        slugInput={slugInput}
        slugValidating={slugValidating}
        slugValid={slugValid}
        slugSaving={slugSaving}
        slugSuccess={slugSuccess}
        slugError={slugError}
        openSlugEdit={openSlugEdit}
        cancelSlugEdit={cancelSlugEdit}
        handleSlugInputChange={handleSlugInputChange}
        handleSlugSave={handleSlugSave}
      />

      {/* Workspace Metadata */}
      <section className="ui-glass p-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Workspace Metadata</h3>
            <p className="text-sm text-slate-500 mt-0.5">System information</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-slate-500">Organization ID</p>
            <p className="mt-1 font-medium text-slate-900 break-all">{schoolInfo?.id || '—'}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-slate-500">Created At</p>
            <p className="mt-1 font-medium text-slate-900">{schoolInfo ? formatTimestamp(schoolInfo.createdAt) : '—'}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 md:col-span-2">
            <p className="text-slate-500">Primary Admin Contact</p>
            <p className="mt-1 font-medium text-slate-900">{schoolInfo?.primaryAdminContact.name || '—'}</p>
            <p className="text-slate-600">{schoolInfo?.primaryAdminContact.email || '—'}</p>
            <p className="text-slate-600">{schoolInfo?.primaryAdminContact.phone || '—'}</p>
            <p className="text-slate-600">{schoolInfo?.primaryAdminContact.title || '—'}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 md:col-span-2">
            <p className="text-slate-500">Campus Snapshot</p>
            <p className="mt-1 font-medium text-slate-900">
              Buildings: {schoolInfo?.campusSnapshot.buildings ?? 0} · Areas: {schoolInfo?.campusSnapshot.areas ?? 0} · Rooms: {schoolInfo?.campusSnapshot.rooms ?? 0}
            </p>
          </div>
        </div>
      </section>

      {securitySection && securitySection}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={resetForm}
          disabled={saving}
          className="px-4 py-2 min-h-[40px] rounded-full bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset
        </button>
      </div>

      {isDirty && (
        <div className="fixed inset-x-0 bottom-0 z-mobilenav border-t border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-10 lg:px-8">
            <p className="text-sm text-slate-700">You have unsaved school information changes.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="px-4 py-2 min-h-[40px] rounded-full bg-slate-100 text-slate-700 text-sm font-medium hover:bg-slate-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={saveSchoolInfo}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
