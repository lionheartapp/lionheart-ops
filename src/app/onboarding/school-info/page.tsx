'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, AlertCircle, Loader2, Sparkles, Building2, GraduationCap, MapPin, Palette } from 'lucide-react'
import { logger } from '@/lib/logger'
import { motion } from 'framer-motion'
import AnimatedFormField from '@/components/onboarding/AnimatedFormField'
import { FloatingDropdown } from '@/components/ui/FloatingInput'
import { FileInput } from '@/components/ui/FileInput'
import { Input } from '@/components/ui/Input'

interface SchoolData {
  name: string
  schoolName: string
  campusName: string
  campusAddress: string
  campusKind: string
  campusGradeLevel: string
  logo?: string
  primaryColor?: string
  phone?: string
  district?: string
  principalName?: string
  principalEmail?: string
  principalPhone?: string
  studentCount?: string
  staffCount?: string
  institutionType?: string
}

const AI_STATUS_MESSAGES = [
  'Searching public sources...',
  'Finding institution details...',
  'Checking location data...',
]

const STRUCTURE_NOTES = [
  'Organization is the billing and account container.',
  'School is the academic institution or division.',
  'Campus is the physical place where work happens.',
]

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
  },
}

export default function SchoolInfoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [aiLookupActive, setAiLookupActive] = useState(false)
  const [aiStatusIndex, setAiStatusIndex] = useState(0)
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set())
  const [data, setData] = useState<SchoolData>({
    name: '',
    schoolName: '',
    campusName: 'Main Campus',
    campusAddress: '',
    campusKind: 'HEADQUARTERS',
    campusGradeLevel: '',
    logo: '',
    primaryColor: '#2563eb',
    phone: '',
    district: '',
    principalName: '',
    principalEmail: '',
    principalPhone: '',
    studentCount: '',
    staffCount: '',
    institutionType: 'PUBLIC',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [addressValidation, setAddressValidation] = useState<{
    valid: boolean
    formattedAddress: string
    suggestion?: string
  } | null>(null)
  const [validatingAddress, setValidatingAddress] = useState(false)

  // Rotate AI status messages
  useEffect(() => {
    if (!aiLookupActive) return
    const interval = setInterval(() => {
      setAiStatusIndex((prev) => (prev + 1) % AI_STATUS_MESSAGES.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [aiLookupActive])

  const highlightField = useCallback((fieldName: string) => {
    setHighlightedFields((prev) => new Set(prev).add(fieldName))
    setTimeout(() => {
      setHighlightedFields((prev) => {
        const next = new Set(prev)
        next.delete(fieldName)
        return next
      })
    }, 1500)
  }, [])

  const performSchoolLookup = useCallback(async (website: string, schoolName?: string) => {
    try {
      setAiLookupActive(true)
      setAiStatusIndex(0)
      const token = localStorage.getItem('auth-token')
      const response = await fetch('/api/onboarding/school-lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ website, schoolName }),
      })

      if (response.ok) {
        const result = await response.json()
        if (result.ok && result.data) {
          const schoolData = result.data
          const fieldsToHighlight: string[] = []

          setData((prev) => {
            const next = { ...prev }
            if (schoolData.logo) { next.logo = schoolData.logo; fieldsToHighlight.push('logo') }
            if (schoolData.colors?.primary) { next.primaryColor = schoolData.colors.primary; fieldsToHighlight.push('color') }
            if (schoolData.phone) { next.phone = schoolData.phone; fieldsToHighlight.push('phone') }
            if (schoolData.address && !next.campusAddress) { next.campusAddress = schoolData.address; fieldsToHighlight.push('address') }
            if (schoolData.institutionType) { next.institutionType = schoolData.institutionType.toUpperCase(); fieldsToHighlight.push('type') }
            if (schoolData.principalName) { next.principalName = schoolData.principalName; fieldsToHighlight.push('principal') }
            if (schoolData.principalEmail) { next.principalEmail = schoolData.principalEmail; fieldsToHighlight.push('principal') }
            return next
          })

          // Highlight AI-filled fields
          setTimeout(() => {
            fieldsToHighlight.forEach((f) => highlightField(f))
          }, 200)
        }
      }
    } catch (err) {
      logger.error({ error: String(err) }, 'School lookup failed')
    } finally {
      setAiLookupActive(false)
    }
  }, [highlightField])

  // Fetch organization info on mount
  useEffect(() => {
    const fetchOrgInfo = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem('auth-token')
        const orgId = localStorage.getItem('org-id')

        if (!token || !orgId) {
          setLoading(false)
          return
        }

        const res = await fetch('/api/onboarding/school-info', {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!res.ok) {
          setLoading(false)
          return
        }

        const result = await res.json()
        if (result.ok && result.data) {
          const org = result.data
          setData((prev) => ({
            ...prev,
            name: org.name || '',
            schoolName: org.schoolName || org.name || '',
            campusName: org.campusName || 'Main Campus',
            campusAddress: org.campusAddress || org.physicalAddress || '',
            campusKind: org.campusKind || 'HEADQUARTERS',
            campusGradeLevel: org.campusGradeLevel || '',
            logo: org.logoUrl || '',
            primaryColor: org.schoolColor || org.primaryColor || '#2563eb',
            phone: org.phone || '',
            district: org.district || '',
            principalName: org.principalName || '',
            principalEmail: org.principalEmail || '',
            principalPhone: org.principalPhone || '',
            studentCount: org.studentCount ? String(org.studentCount) : '',
            staffCount: org.staffCount ? String(org.staffCount) : '',
            institutionType: org.institutionType || 'PUBLIC',
          }))

          // Trigger school lookup
          if (org.website) {
            setLoading(false)
            await performSchoolLookup(org.website, org.name)
            return
          }
        }
      } catch (err) {
        logger.error({ error: String(err) }, 'Error fetching org info')
      } finally {
        setLoading(false)
      }
    }

    fetchOrgInfo()
  }, [performSchoolLookup])

  const handleLogoUpload = (files: File[]) => {
    const file = files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setData((prev) => ({
          ...prev,
          logo: event.target?.result as string,
        }))
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAddressBlur = async () => {
    const address = data.campusAddress?.trim()
    if (!address || address.length < 5) {
      setAddressValidation(null)
      return
    }

    const token = localStorage.getItem('auth-token')
    if (!token) return

    setValidatingAddress(true)
    try {
      const res = await fetch('/api/onboarding/validate-address', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ address }),
      })

      if (res.ok) {
        const result = await res.json()
        if (result.ok && result.data) {
          setAddressValidation(result.data)
        }
      }
    } catch {
      // Silently fail
    } finally {
      setValidatingAddress(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError('')

      const token = localStorage.getItem('auth-token')
      if (!token) {
        setError('Authentication token not found')
        return
      }

      sessionStorage.setItem(
        'onboarding-school-data',
        JSON.stringify({
          logo: data.logo,
          primaryColor: data.primaryColor,
        })
      )

      const response = await fetch('/api/onboarding/school-info', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          schoolName: data.schoolName || data.name || null,
          campusName: data.campusName || null,
          campusAddress: data.campusAddress || null,
          campusKind: data.campusKind || 'HEADQUARTERS',
          campusGradeLevel: data.campusGradeLevel || null,
          phone: data.phone || null,
          district: data.district || null,
          principalName: data.principalName || null,
          principalEmail: data.principalEmail || null,
          principalPhone: data.principalPhone || null,
          institutionType: data.institutionType || null,
          studentCount: data.studentCount ? Number(data.studentCount) : null,
          staffCount: data.staffCount ? Number(data.staffCount) : null,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save school information')
      }

      router.push('/onboarding/members')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !aiLookupActive) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-3" />
        <p className="text-slate-600">Loading your school information...</p>
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* AI Thinking Indicator */}
      {aiLookupActive && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-primary-50 border border-primary-200 rounded-xl p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-600" />
            </div>
            <div>
              <p className="font-semibold text-primary-900 text-sm">AI is finding your school...</p>
              <motion.p
                key={aiStatusIndex}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-primary-600"
              >
                {AI_STATUS_MESSAGES[aiStatusIndex]}
              </motion.p>
            </div>
          </div>
          {/* Shimmer bar */}
          <div
            className="h-1.5 rounded-full bg-gradient-to-r from-primary-200 via-primary-400 to-primary-200"
            style={{
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s linear infinite',
            }}
          />
        </motion.div>
      )}

      {/* Title */}
      <AnimatedFormField>
        <div className="space-y-3">
          <h2 className="text-3xl font-bold text-slate-900">Confirm your structure</h2>
          <p className="text-slate-600 mt-2">
            We pre-filled what we could. Confirm the account, school, and campus details so the dashboard can route work to the right place.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {STRUCTURE_NOTES.map((note) => (
              <div key={note} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                {note}
              </div>
            ))}
          </div>
        </div>
      </AnimatedFormField>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Branded Preview Card */}
      {data.name && (
        <AnimatedFormField highlight={highlightedFields.has('logo') || highlightedFields.has('color')}>
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="rounded-lg p-6 text-white border border-opacity-20"
            style={{
              backgroundColor: data.primaryColor || '#2563eb',
              borderColor: 'rgba(255,255,255,0.1)',
            }}
          >
            <div className="flex items-center gap-4">
              {data.logo ? (
                <img
                  src={data.logo}
                  alt={data.name}
                  className="w-16 h-16 bg-white rounded-lg p-2 object-contain"
                  onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden') }}
                />
              ) : null}
              <div className={`w-16 h-16 bg-white rounded-lg flex items-center justify-center text-slate-400 text-lg font-bold ${data.logo ? 'hidden' : ''}`}>
                {data.name?.charAt(0) || '?'}
              </div>
              <div>
                <h3 className="text-2xl font-bold">{data.name}</h3>
                <p className="text-white text-opacity-80">
                  {data.schoolName || data.name} · {data.campusName || 'Main Campus'}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatedFormField>
      )}

      {/* Form Fields */}
      <div className="space-y-5">
        <AnimatedFormField>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-subtle">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900">Organization</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-slate-900 mb-1.5">Main Phone</label>
                <Input
                  id="phone"
                  type="tel"
                  value={data.phone}
                  onChange={(e) => setData((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div>
                <label htmlFor="district" className="block text-sm font-medium text-slate-900 mb-1.5">District or Network</label>
                <Input
                  id="district"
                  value={data.district}
                  onChange={(e) => setData((prev) => ({ ...prev, district: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label htmlFor="studentCount" className="block text-sm font-medium text-slate-900 mb-1.5">Students</label>
                <Input
                  id="studentCount"
                  type="number"
                  min={0}
                  value={data.studentCount}
                  onChange={(e) => setData((prev) => ({ ...prev, studentCount: e.target.value }))}
                  placeholder="Enrollment"
                />
              </div>
              <div>
                <label htmlFor="staffCount" className="block text-sm font-medium text-slate-900 mb-1.5">Staff</label>
                <Input
                  id="staffCount"
                  type="number"
                  min={0}
                  value={data.staffCount}
                  onChange={(e) => setData((prev) => ({ ...prev, staffCount: e.target.value }))}
                  placeholder="Staff count"
                />
              </div>
            </div>
          </section>
        </AnimatedFormField>

        <AnimatedFormField highlight={highlightedFields.has('type') || highlightedFields.has('principal')}>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-subtle">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900">Primary School</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="schoolName" className="block text-sm font-medium text-slate-900 mb-1.5">School Name</label>
                <Input
                  id="schoolName"
                  value={data.schoolName}
                  onChange={(e) => setData((prev) => ({ ...prev, schoolName: e.target.value }))}
                  placeholder="School or division name"
                />
              </div>
              <FloatingDropdown
                id="type"
                label="Institution Type"
                value={data.institutionType || ''}
                onChange={(value) => setData((prev) => ({ ...prev, institutionType: value }))}
                options={[
                  { value: 'PUBLIC', label: 'Public' },
                  { value: 'PRIVATE', label: 'Private' },
                  { value: 'CHARTER', label: 'Charter' },
                  { value: 'HYBRID', label: 'Hybrid' },
                ]}
              />
              <div>
                <label htmlFor="principalName" className="block text-sm font-medium text-slate-900 mb-1.5">Principal or Lead</label>
                <Input
                  id="principalName"
                  value={data.principalName}
                  onChange={(e) => setData((prev) => ({ ...prev, principalName: e.target.value }))}
                  placeholder="Name"
                />
              </div>
              <div>
                <label htmlFor="principalEmail" className="block text-sm font-medium text-slate-900 mb-1.5">Lead Email</label>
                <Input
                  id="principalEmail"
                  type="email"
                  value={data.principalEmail}
                  onChange={(e) => setData((prev) => ({ ...prev, principalEmail: e.target.value }))}
                  placeholder="name@school.edu"
                />
              </div>
              <div>
                <label htmlFor="principalPhone" className="block text-sm font-medium text-slate-900 mb-1.5">Lead Phone</label>
                <Input
                  id="principalPhone"
                  type="tel"
                  value={data.principalPhone}
                  onChange={(e) => setData((prev) => ({ ...prev, principalPhone: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>
          </section>
        </AnimatedFormField>

        <AnimatedFormField highlight={highlightedFields.has('address')}>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-subtle">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900">Primary Campus</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="campusName" className="block text-sm font-medium text-slate-900 mb-1.5">Campus Name</label>
                <Input
                  id="campusName"
                  value={data.campusName}
                  onChange={(e) => setData((prev) => ({ ...prev, campusName: e.target.value }))}
                  placeholder="Main Campus"
                />
              </div>
              <FloatingDropdown
                id="campusKind"
                label="Campus Type"
                value={data.campusKind || 'HEADQUARTERS'}
                onChange={(value) => setData((prev) => ({ ...prev, campusKind: value }))}
                options={[
                  { value: 'HEADQUARTERS', label: 'Headquarters' },
                  { value: 'CAMPUS', label: 'Campus' },
                  { value: 'SATELLITE', label: 'Satellite' },
                ]}
              />
              <div className="sm:col-span-2">
                <label htmlFor="campusAddress" className="block text-sm font-medium text-slate-900 mb-1.5">Campus Address</label>
                <Input
                  id="campusAddress"
                  type="text"
                  value={data.campusAddress}
                  onChange={(e) => {
                    setData((prev) => ({ ...prev, campusAddress: e.target.value }))
                    setAddressValidation(null)
                  }}
                  onBlur={handleAddressBlur}
                  placeholder="123 Main St, City, State"
                />
                {validatingAddress && (
                  <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Verifying address...
                  </p>
                )}
                {addressValidation?.suggestion && (
                  <div className="mt-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                    <p className="text-xs text-green-800 font-medium mb-1">Verified address:</p>
                    <p className="text-sm text-green-900">{addressValidation.formattedAddress}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setData((prev) => ({ ...prev, campusAddress: addressValidation.formattedAddress }))
                        setAddressValidation({ ...addressValidation, suggestion: undefined })
                      }}
                      className="mt-1.5 text-xs font-medium text-green-700 hover:text-green-800 underline"
                    >
                      Use this address
                    </button>
                  </div>
                )}
                {addressValidation && !addressValidation.suggestion && addressValidation.valid && (
                  <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">Address verified</p>
                )}
              </div>
              <FloatingDropdown
                id="campusGradeLevel"
                label="Campus Grade Band"
                value={data.campusGradeLevel || ''}
                onChange={(value) => setData((prev) => ({ ...prev, campusGradeLevel: value }))}
                placeholder="Select when relevant"
                options={[
                  { value: '', label: 'Not grade-specific' },
                  { value: 'ELEMENTARY', label: 'Elementary' },
                  { value: 'MIDDLE_SCHOOL', label: 'Middle School' },
                  { value: 'HIGH_SCHOOL', label: 'High School' },
                ]}
              />
            </div>
          </section>
        </AnimatedFormField>

        <AnimatedFormField highlight={highlightedFields.has('logo') || highlightedFields.has('color')}>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-subtle">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-900">Branding</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1.5">Logo</label>
                <div className="flex items-center gap-4">
                  {data.logo ? (
                    <img
                      src={data.logo}
                      alt="logo"
                      className="w-20 h-20 bg-slate-100 rounded-lg p-1 object-contain border border-slate-200"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        setData((prev) => ({ ...prev, logo: '' }))
                      }}
                    />
                  ) : (
                    <div className="w-20 h-20 bg-slate-100 rounded-lg border border-slate-200 border-dashed flex items-center justify-center text-slate-400">
                      <span className="text-xs">No logo</span>
                    </div>
                  )}
                  <FileInput accept="image/*" compact onFiles={handleLogoUpload} className="border-solid px-4 py-2">
                    <span className="text-slate-900 text-sm font-medium flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Upload
                    </span>
                  </FileInput>
                </div>
              </div>
              <div>
                <label htmlFor="color" className="block text-sm font-medium text-slate-900 mb-1.5">Primary Color</label>
                <div className="flex items-center gap-3">
                  <Input
                    id="color"
                    type="color"
                    value={data.primaryColor}
                    onChange={(e) => setData((prev) => ({ ...prev, primaryColor: e.target.value }))}
                    className="w-12 h-12 rounded-lg cursor-pointer border border-slate-200"
                  />
                  <Input
                    type="text"
                    value={data.primaryColor}
                    onChange={(e) => setData((prev) => ({ ...prev, primaryColor: e.target.value }))}
                    className="flex-1"
                    placeholder="#2563eb"
                  />
                </div>
              </div>
            </div>
          </section>
        </AnimatedFormField>
      </div>

      {/* Actions */}
      <AnimatedFormField>
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t border-slate-200">
          <button
            onClick={() => router.push('/onboarding/members')}
            className="px-6 py-3 text-slate-700 font-medium text-center hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded transition"
          >
            Skip for now
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Looks good, continue
          </button>
        </div>
      </AnimatedFormField>
    </motion.div>
  )
}
