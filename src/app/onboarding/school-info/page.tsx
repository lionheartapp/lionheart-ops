'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, AlertCircle, Loader2, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import AnimatedFormField from '@/components/onboarding/AnimatedFormField'

interface SchoolData {
  name: string
  logo?: string
  primaryColor?: string
  phone?: string
  address?: string
  gradeRange?: string
  institutionType?: string
}

const AI_STATUS_MESSAGES = [
  'Searching the web...',
  'Found your school!',
  'Pulling in details...',
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
    logo: '',
    primaryColor: '#2563eb',
    phone: '',
    address: '',
    gradeRange: '',
    institutionType: 'Public',
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
            if (schoolData.address) { next.address = schoolData.address; fieldsToHighlight.push('address') }
            if (schoolData.gradeRange) { next.gradeRange = schoolData.gradeRange; fieldsToHighlight.push('gradeRange') }
            if (schoolData.institutionType) { next.institutionType = schoolData.institutionType.toUpperCase(); fieldsToHighlight.push('type') }
            return next
          })

          // Highlight AI-filled fields
          setTimeout(() => {
            fieldsToHighlight.forEach((f) => highlightField(f))
          }, 200)
        }
      }
    } catch (err) {
      console.error('School lookup failed:', err)
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
            logo: org.logoUrl || '',
            primaryColor: org.primaryColor || '#2563eb',
            phone: org.phone || '',
            address: org.physicalAddress || '',
            gradeRange: org.gradeRange || '',
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
        console.error('Error fetching org info:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchOrgInfo()
  }, [performSchoolLookup])

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
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
    const address = data.address?.trim()
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
          phone: data.phone || null,
          physicalAddress: data.address || null,
          gradeRange: data.gradeRange || null,
          institutionType: data.institutionType || null,
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
        <p className="text-gray-600">Loading your school information...</p>
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
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Let&apos;s set up your school</h2>
          <p className="text-gray-600 mt-2">
            We&apos;ve pre-filled what we could find. Feel free to update any information.
          </p>
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
                />
              ) : (
                <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center text-gray-400">
                  No logo
                </div>
              )}
              <div>
                <h3 className="text-2xl font-bold">{data.name}</h3>
                <p className="text-white text-opacity-80">is ready to go</p>
              </div>
            </div>
          </motion.div>
        </AnimatedFormField>
      )}

      {/* Form Fields */}
      <div className="space-y-6">
        {/* Logo */}
        <AnimatedFormField highlight={highlightedFields.has('logo')}>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1.5">
              Logo
            </label>
            <div className="flex items-center gap-4">
              {data.logo ? (
                <img
                  src={data.logo}
                  alt="logo"
                  className="w-20 h-20 bg-gray-100 rounded-lg p-1 object-contain border border-gray-200"
                />
              ) : (
                <div className="w-20 h-20 bg-gray-100 rounded-lg border border-gray-200 border-dashed flex items-center justify-center text-gray-400">
                  <span className="text-xs">No logo</span>
                </div>
              )}
              <label className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.parentElement?.querySelector('input')?.click()
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload Logo
                </button>
              </label>
            </div>
          </div>
        </AnimatedFormField>

        {/* Primary Color */}
        <AnimatedFormField highlight={highlightedFields.has('color')}>
          <div>
            <label htmlFor="color" className="block text-sm font-medium text-gray-900 mb-1.5">
              Primary Color
            </label>
            <div className="flex items-center gap-3">
              <input
                id="color"
                type="color"
                value={data.primaryColor}
                onChange={(e) => setData((prev) => ({ ...prev, primaryColor: e.target.value }))}
                className="w-12 h-12 rounded-lg cursor-pointer border border-gray-200"
              />
              <input
                type="text"
                value={data.primaryColor}
                onChange={(e) => setData((prev) => ({ ...prev, primaryColor: e.target.value }))}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 ui-input"
                placeholder="#2563eb"
              />
            </div>
          </div>
        </AnimatedFormField>

        {/* School Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AnimatedFormField highlight={highlightedFields.has('phone')}>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-900 mb-1.5">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                value={data.phone}
                onChange={(e) => setData((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="(555) 123-4567"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 ui-input"
              />
            </div>
          </AnimatedFormField>

          <AnimatedFormField highlight={highlightedFields.has('address')}>
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-900 mb-1.5">
                Address
              </label>
              <input
                id="address"
                type="text"
                value={data.address}
                onChange={(e) => {
                  setData((prev) => ({ ...prev, address: e.target.value }))
                  setAddressValidation(null)
                }}
                onBlur={handleAddressBlur}
                placeholder="123 Main St, City, State"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 ui-input"
              />
              {validatingAddress && (
                <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
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
                      setData((prev) => ({ ...prev, address: addressValidation.formattedAddress }))
                      setAddressValidation({ ...addressValidation, suggestion: undefined })
                    }}
                    className="mt-1.5 text-xs font-medium text-green-700 hover:text-green-800 underline"
                  >
                    Use this address
                  </button>
                </div>
              )}
              {addressValidation && !addressValidation.suggestion && addressValidation.valid && (
                <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                  ✓ Address verified
                </p>
              )}
            </div>
          </AnimatedFormField>

          <AnimatedFormField highlight={highlightedFields.has('gradeRange')}>
            <div>
              <label htmlFor="gradeRange" className="block text-sm font-medium text-gray-900 mb-1.5">
                Grade Range
              </label>
              <input
                id="gradeRange"
                type="text"
                value={data.gradeRange}
                onChange={(e) => setData((prev) => ({ ...prev, gradeRange: e.target.value }))}
                placeholder="K-5, 6-8, 9-12"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 ui-input"
              />
            </div>
          </AnimatedFormField>

          <AnimatedFormField highlight={highlightedFields.has('type')}>
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-900 mb-1.5">
                Institution Type
              </label>
              <select
                id="type"
                value={data.institutionType}
                onChange={(e) => setData((prev) => ({ ...prev, institutionType: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 ui-select"
              >
                <option value="PUBLIC">Public</option>
                <option value="PRIVATE">Private</option>
                <option value="CHARTER">Charter</option>
                <option value="HYBRID">Hybrid</option>
              </select>
            </div>
          </AnimatedFormField>
        </div>
      </div>

      {/* Actions */}
      <AnimatedFormField>
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t border-gray-200">
          <button
            onClick={() => router.push('/onboarding/members')}
            className="px-6 py-3 text-gray-700 font-medium text-center hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded transition"
          >
            Skip for now
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Looks good, continue
          </button>
        </div>
      </AnimatedFormField>
    </motion.div>
  )
}
