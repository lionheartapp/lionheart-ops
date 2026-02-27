'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, AlertCircle, Loader2 } from 'lucide-react'

interface SchoolData {
  name: string
  logo?: string
  primaryColor?: string
  phone?: string
  address?: string
  gradeRange?: string
  institutionType?: string
}

export default function SchoolInfoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
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

  // Fetch organization info on mount
  useEffect(() => {
    const fetchOrgInfo = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem('auth-token')
        const orgId = localStorage.getItem('org-id')

        if (!token || !orgId) {
          // No auth, show empty form
          setLoading(false)
          return
        }

        // Fetch org details via onboarding school-info endpoint
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
            await performSchoolLookup(org.website, org.name)
          }
        }
      } catch (err) {
        console.error('Error fetching org info:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchOrgInfo()
  }, [])

  const performSchoolLookup = async (website: string, schoolName?: string) => {
    try {
      setLoading(true)
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
          setData((prev) => ({
            ...prev,
            logo: schoolData.logo || prev.logo,
            primaryColor: schoolData.colors?.primary || prev.primaryColor,
            phone: schoolData.phone || prev.phone,
            address: schoolData.address || prev.address,
            gradeRange: schoolData.gradeRange || prev.gradeRange,
            institutionType: schoolData.institutionType?.toUpperCase() || prev.institutionType,
          }))
        }
      }
    } catch (err) {
      console.error('School lookup failed:', err)
    } finally {
      setLoading(false)
    }
  }

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

  // Validate address on blur
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
      // Silently fail — validation is non-critical
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

      // Save to sessionStorage for finalize step
      sessionStorage.setItem(
        'onboarding-school-data',
        JSON.stringify({
          logo: data.logo,
          primaryColor: data.primaryColor,
        })
      )

      // Call PATCH endpoint to save school info
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-gray-600">Finding your school&apos;s information...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Let&apos;s set up your school</h2>
        <p className="text-gray-600 mt-2">
          We&apos;ve pre-filled what we could find. Feel free to update any information.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Branded Preview Card */}
      {data.name && (
        <div
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
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-6">
        {/* Logo */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
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

        {/* Primary Color */}
        <div>
          <label htmlFor="color" className="block text-sm font-medium text-gray-900 mb-2">
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

        {/* School Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-900 mb-2">
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

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-900 mb-2">
              Address
            </label>
            <input
              id="address"
              type="text"
              value={data.address}
              onChange={(e) => {
                setData((prev) => ({ ...prev, address: e.target.value }))
                setAddressValidation(null) // Reset validation on change
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

          <div>
            <label htmlFor="gradeRange" className="block text-sm font-medium text-gray-900 mb-2">
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

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-gray-900 mb-2">
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
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t border-gray-200">
        <button
          onClick={() => router.push('/onboarding/members')}
          className="px-6 py-3 text-gray-700 font-medium text-center hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded transition"
        >
          Skip for now
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Looks good, continue
        </button>
      </div>
    </div>
  )
}
