'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, ArrowRight, Loader2, Palette, Sparkles } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

type SchoolData = {
  name: string
  address: string
  colors: { primary: string; secondary: string }
  logo: string
  website: string
}

// Mock function to simulate address lookup and branding fetch
// In production, this would call Google Places API (by address) + Brandfetch for colors/logo
const simulateAddressLookup = async (address: string, orgName: string): Promise<SchoolData> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        name: orgName,
        address: address || '31950 Pauba Rd, Temecula, CA 92592',
        colors: { primary: '#003366', secondary: '#c4a006' },
        logo: 'https://logo.clearbit.com/linfield.com',
        website: 'linfield.com',
      })
    }, 1500)
  })
}

const LIONHEART_URL = (process.env.NEXT_PUBLIC_LIONHEART_URL || 'http://localhost:5173').replace(/\/+$/, '')

const PLATFORM_URL = (process.env.NEXT_PUBLIC_PLATFORM_URL || 'http://localhost:3001').replace(/\/+$/, '')

// Basic validation: addresses typically have a street number and city/state (e.g. "123 Main St, City, ST")
function looksLikeAddress(input: string): boolean {
  const trimmed = input.trim()
  if (trimmed.length < 15) return false
  if (!/\d/.test(trimmed)) return false // Must have at least one digit (street number)
  return true
}

function SetupContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('orgId')
  const orgNameFromUrl = searchParams.get('orgName')
  const userNameFromUrl = searchParams.get('userName')

  const [step, setStep] = useState(1)
  const [addressQuery, setAddressQuery] = useState('')
  const [addressError, setAddressError] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null)
  const [orgName, setOrgName] = useState(orgNameFromUrl || '')

  // Fetch org name if not in URL (e.g. from Google OAuth or bookmarked setup link)
  useEffect(() => {
    if (!orgId || orgNameFromUrl) return
    fetch(`${PLATFORM_URL}/api/setup/org?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => r.json())
      .then((d) => d.name && setOrgName(d.name))
      .catch(() => {})
  }, [orgId, orgNameFromUrl])

  if (!orgId) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="text-center text-zinc-500">
          <p className="text-lg">Missing organization. Please complete signup first.</p>
          <a
            href={`${LIONHEART_URL}/signup`}
            className="mt-4 inline-block text-blue-600 hover:underline font-medium"
          >
            Go to signup →
          </a>
        </div>
      </div>
    )
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddressError('')
    const trimmed = addressQuery.trim()
    if (!trimmed) return
    if (!looksLikeAddress(trimmed)) {
      setAddressError('Please enter a valid address with street number and city (e.g. 31950 Pauba Rd, Temecula, CA)')
      return
    }
    setIsSearching(true)
    const data = await simulateAddressLookup(trimmed, orgName || 'Your School')
    setSchoolData(data)
    setIsSearching(false)
    setStep(2)
  }

  const handleConfirm = () => {
    // Save branding to Organization settings via API (optional - implement when ready)
    // await fetch(`/api/organizations/${orgId}/branding`, { method: 'PATCH', body: JSON.stringify(schoolData) })
    // Pass userName so Lionheart can show it immediately (fallback if /api/user/me hasn't loaded)
    const params = new URLSearchParams()
    const userName = searchParams.get('userName')
    if (userName) params.set('userName', userName)
    const qs = params.toString()
    window.location.href = `${LIONHEART_URL}/app${qs ? '?' + qs : ''}`
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col items-center justify-center p-6 font-sans">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-lg text-center space-y-8"
          >
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight text-zinc-900">
                Let&apos;s find your school.
              </h1>
              <p className="text-lg text-zinc-500">
                Enter your school&apos;s address so we can configure your location and branding.
              </p>
            </div>

            <form onSubmit={handleSearch} className="space-y-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  {isSearching ? (
                    <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                  ) : (
                    <MapPin className="w-5 h-5 text-zinc-400" />
                  )}
                </div>
                <input
                  type="text"
                  autoFocus
                  value={addressQuery}
                  onChange={(e) => {
                    setAddressQuery(e.target.value)
                    if (addressError) setAddressError('')
                  }}
                  placeholder="Enter school address (e.g. 31950 Pauba Rd, Temecula, CA)"
                  className={`w-full pl-12 pr-20 py-4 text-lg rounded-2xl border shadow-xl focus:outline-none focus:ring-2 transition-all ${
                    addressError
                      ? 'border-amber-400 shadow-zinc-100 focus:ring-amber-500 focus:border-amber-500'
                      : 'border-zinc-200 shadow-zinc-100 focus:ring-blue-600 focus:border-transparent'
                  }`}
                />
                <button
                  type="submit"
                  disabled={!addressQuery.trim() || isSearching}
                  className="absolute inset-y-2 right-2 px-4 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 disabled:opacity-50 transition-opacity"
                >
                  Go
                </button>
              </div>
              {addressError && (
                <p className="text-sm text-amber-700 text-left">
                  {addressError}
                </p>
              )}
            </form>
          </motion.div>
        )}

        {step === 2 && schoolData && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl"
          >
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold mb-4">
                <Sparkles className="w-4 h-4" /> Match Found
              </div>
              <h1 className="text-3xl font-bold text-zinc-900">Welcome to Lionheart.</h1>
              <p className="text-zinc-500 mt-2">We&apos;ve personalized your workspace.</p>
            </div>

            <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl overflow-hidden">
              <div
                className="h-32 w-full relative flex items-end p-6"
                style={{ backgroundColor: schoolData.colors.primary }}
              >
                <div className="absolute top-4 right-4 flex gap-2">
                  <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white rounded-full text-xs font-medium border border-white/30 flex items-center gap-1">
                    <Palette className="w-3 h-3" /> Theme Applied
                  </span>
                </div>

                <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center p-2 translate-y-1/2">
                  <img src={schoolData.logo} alt="Logo" className="w-full h-full object-contain" />
                </div>
              </div>

              <div className="pt-14 pb-8 px-8">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-900">{schoolData.name}</h2>
                    <div className="flex items-center gap-2 text-zinc-500 mt-1">
                      <MapPin className="w-4 h-4 shrink-0" />
                      {schoolData.address}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                      Detected Colors
                    </p>
                    <div className="flex gap-2 justify-end">
                      <div
                        className="w-8 h-8 rounded-full shadow-sm ring-1 ring-zinc-100"
                        style={{ background: schoolData.colors.primary }}
                        title="Primary"
                      />
                      <div
                        className="w-8 h-8 rounded-full shadow-sm ring-1 ring-zinc-100"
                        style={{ background: schoolData.colors.secondary }}
                        title="Secondary"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-zinc-100 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-6 py-3 rounded-xl border border-zinc-200 text-zinc-600 font-medium hover:bg-zinc-50 transition-colors"
                  >
                    Wrong school
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="px-8 py-3 rounded-xl bg-zinc-900 text-white font-bold hover:bg-zinc-800 transition-colors flex items-center gap-2 shadow-lg shadow-zinc-900/20"
                  >
                    Looks good, let&apos;s go <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Decorative background elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[40vw] h-[40vw] bg-blue-100/50 rounded-full blur-3xl opacity-60" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[40vw] h-[40vw] bg-violet-100/50 rounded-full blur-3xl opacity-60" />
      </div>
    </div>
  )
}

export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <p className="text-zinc-500">Loading…</p>
        </div>
      }
    >
      <SetupContent />
    </Suspense>
  )
}
