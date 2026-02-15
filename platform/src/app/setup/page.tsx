'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, ArrowRight, Loader2, Palette, Sparkles } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

type SchoolData = {
  name: string
  address: string
  colors: { primary: string; secondary: string }
  logo: string | null
  website: string
}

type Suggestion = { text: string; placeId?: string }

// Mock function to simulate branding fetch (logo/colors from address)
// In production, could use Brandfetch by domain from address
const simulateAddressLookup = async (address: string, orgName: string): Promise<SchoolData> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Try to get logo from domain; if not found, use null so sidebar shows school name
      const domain = address.match(/\b([a-z0-9-]+\.(edu|org|com|net))\b/i)?.[1]?.toLowerCase()
      const logo = domain ? `https://logo.clearbit.com/${domain}` : null
      resolve({
        name: orgName,
        address: address || '31950 Pauba Rd, Temecula, CA 92592',
        colors: { primary: '#003366', secondary: '#c4a006' },
        logo,
        website: domain || '',
      })
    }, 1200)
  })
}

const LIONHEART_URL = (process.env.NEXT_PUBLIC_LIONHEART_URL || 'http://localhost:5173').replace(/\/+$/, '')
const PLATFORM_URL = (typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_PLATFORM_URL || 'http://localhost:3001').replace(/\/+$/, '')

const AUTOCOMPLETE_DEBOUNCE_MS = 300

function SetupContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('orgId')
  const orgNameFromUrl = searchParams.get('orgName')
  const [step, setStep] = useState(1)
  const [addressQuery, setAddressQuery] = useState('')
  const [addressError, setAddressError] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null)
  const [orgName, setOrgName] = useState(orgNameFromUrl || '')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Read token from hash (passed by signup for branding API)
  const getToken = useCallback(() => {
    if (typeof window === 'undefined') return null
    const hash = window.location.hash
    const match = hash.match(/#token=([^&]+)/)
    return match ? decodeURIComponent(match[1]) : null
  }, [])

  // Fetch org name if not in URL
  useEffect(() => {
    if (!orgId || orgNameFromUrl) return
    fetch(`/api/setup/org?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => r.json())
      .then((d) => d.name && setOrgName(d.name))
      .catch(() => {})
  }, [orgId, orgNameFromUrl])

  // Address autocomplete
  useEffect(() => {
    const q = addressQuery.trim()
    if (q.length < 3) {
      setSuggestions([])
      setSuggestionsOpen(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      setSuggestionsLoading(true)
      fetch('/api/places/autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: q }),
      })
        .then((r) => r.json())
        .then((data) => {
          const list: Suggestion[] = []
          for (const s of data.suggestions || []) {
            const pp = s.placePrediction
            if (pp?.text?.text) list.push({ text: pp.text.text, placeId: pp.placeId })
          }
          setSuggestions(list)
          setSuggestionsOpen(list.length > 0)
        })
        .catch(() => setSuggestions([]))
        .finally(() => setSuggestionsLoading(false))
    }, AUTOCOMPLETE_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [addressQuery])

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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
    if (trimmed.length < 5 || !/\d/.test(trimmed)) {
      setAddressError('Please enter or select a valid address with street number and city.')
      return
    }
    setSuggestionsOpen(false)
    setIsSearching(true)
    const data = await simulateAddressLookup(trimmed, orgName || 'Your School')
    setSchoolData(data)
    setIsSearching(false)
    setStep(2)
  }

  const handleSelectSuggestion = (text: string) => {
    setAddressQuery(text)
    setSuggestionsOpen(false)
    setAddressError('')
    inputRef.current?.focus()
  }

  const handleConfirm = async () => {
    if (!schoolData) return
    const token = getToken()
    if (token && orgId) {
      try {
        await fetch('/api/setup/branding', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            orgId,
            address: schoolData.address,
            logoUrl: schoolData.logo || null,
            name: orgName || schoolData.name,
            website: schoolData.website || undefined,
            colors: schoolData.colors,
          }),
        })
      } catch {
        // Continue to redirect even if save fails
      }
      // Clear token from hash
      if (typeof window !== 'undefined' && window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    }
    const params = new URLSearchParams()
    const userName = searchParams.get('userName')
    const userEmail = searchParams.get('userEmail')
    if (userName) params.set('userName', userName)
    if (userEmail) params.set('userEmail', userEmail)
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
              <div className="relative" ref={dropdownRef}>
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  {isSearching ? (
                    <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                  ) : suggestionsLoading ? (
                    <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                  ) : (
                    <MapPin className="w-5 h-5 text-zinc-400" />
                  )}
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  autoComplete="off"
                  autoFocus
                  value={addressQuery}
                  onChange={(e) => {
                    setAddressQuery(e.target.value)
                    if (addressError) setAddressError('')
                  }}
                  onFocus={() => suggestions.length > 0 && setSuggestionsOpen(true)}
                  placeholder="Start typing your school address…"
                  className={`w-full pl-12 pr-20 py-4 text-lg rounded-2xl border shadow-xl focus:outline-none focus:ring-2 transition-all ${
                    addressError
                      ? 'border-amber-400 shadow-zinc-100 focus:ring-amber-500 focus:border-amber-500'
                      : 'border-zinc-200 shadow-zinc-100 focus:ring-blue-600 focus:border-transparent'
                  }`}
                />
                {suggestionsOpen && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden z-50 max-h-60 overflow-y-auto">
                    {suggestions.map((s, i) => (
                      <button
                        key={s.placeId || i}
                        type="button"
                        onClick={() => handleSelectSuggestion(s.text)}
                        className="w-full text-left px-4 py-3 hover:bg-zinc-50 text-sm text-zinc-800 flex items-center gap-2"
                      >
                        <MapPin className="w-4 h-4 text-zinc-400 shrink-0" />
                        {s.text}
                      </button>
                    ))}
                  </div>
                )}
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
                  {schoolData.logo ? (
                    <img src={schoolData.logo} alt="Logo" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  ) : (
                    <span className="text-lg font-bold text-zinc-600 truncate px-1">{schoolData.name}</span>
                  )}
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
