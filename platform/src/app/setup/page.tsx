'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useJsApiLoader, StandaloneSearchBox } from '@react-google-maps/api'
import { Check, Loader2, Upload, Search, MapPin, Users, FileSpreadsheet } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import confetti from 'canvas-confetti'
import { parseMembersCsv } from '@/lib/parseMembersCsv'

const LIBRARIES: ('places')[] = ['places']
const LIONHEART_URL = (process.env.NEXT_PUBLIC_LIONHEART_URL || 'http://localhost:5173').replace(/\/+$/, '')

function extractDomainFromPlace(place: google.maps.places.PlaceResult): string | null {
  const raw = (place as { website?: string; url?: string }).website || (place as { website?: string; url?: string }).url
  if (raw) {
    try {
      return new URL(raw).hostname.replace(/^www\./, '')
    } catch {
      // ignore
    }
  }
  const addr = place.formatted_address || ''
  const m = addr.match(/\b([a-z0-9-]+\.(edu|org|com|net))\b/i)
  return m?.[1]?.toLowerCase() || null
}

function SetupContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams.get('orgId')
  const orgNameFromUrl = searchParams.get('orgName')
  const [mapsKey, setMapsKey] = useState<string | null>(null)
  const [mapsKeyLoading, setMapsKeyLoading] = useState(true)

  useEffect(() => {
    fetch('/api/setup/maps-key')
      .then((r) => r.json())
      .then((d) => (d.key ? setMapsKey(d.key) : setMapsKey(null)))
      .catch(() => setMapsKey(null))
      .finally(() => setMapsKeyLoading(false))
  }, [])

  if (!orgId) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-center text-zinc-500">
          <p className="text-lg">Missing organization. Please complete signup first.</p>
          <a
            href={`${LIONHEART_URL}/signup`}
            className="mt-4 inline-block text-blue-500 hover:underline font-medium"
          >
            Go to signup →
          </a>
        </div>
      </div>
    )
  }

  if (mapsKeyLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span>Loading…</span>
        </div>
      </div>
    )
  }

  if (!mapsKey) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-zinc-500 text-center max-w-md space-y-4">
        <p>
          Google Maps API key is not configured. Add <code className="text-zinc-600">GOOGLE_PLACES_API_KEY</code> or{' '}
          <code className="text-zinc-600">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to platform/.env
        </p>
      </div>
    )
  }

  return (
    <SetupWizard
      orgId={orgId}
      orgNameFromUrl={orgNameFromUrl}
      searchParams={searchParams}
      mapsKey={mapsKey}
    />
  )
}

function SetupWizard({
  orgId,
  orgNameFromUrl,
  searchParams,
  mapsKey,
}: {
  orgId: string
  orgNameFromUrl: string | null
  searchParams: URLSearchParams
  mapsKey: string
}) {
  const [step, setStep] = useState(orgNameFromUrl ? 2 : 1)
  const [loading, setLoading] = useState(false)
  const [schoolName, setSchoolName] = useState(orgNameFromUrl || '')
  const [schoolAddress, setSchoolAddress] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#3b82f6')
  const [secondaryColor, setSecondaryColor] = useState('#f59e0b')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoLoading, setLogoLoading] = useState(false)
  const [website, setWebsite] = useState('')
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null)
  const [invites, setInvites] = useState(['', '', ''])
  const [csvMembers, setCsvMembers] = useState<Array<{ name: string; email: string; role?: string; teamNames?: string[] }>>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: mapsKey,
    libraries: LIBRARIES,
  })

  useEffect(() => {
    if (!orgId || orgNameFromUrl) return
    fetch(`/api/setup/org?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => r.json())
      .then((d) => d.name && setSchoolName(d.name))
      .catch(() => {})
  }, [orgId, orgNameFromUrl])

  const startAtBranding = !!orgNameFromUrl

  const getToken = useCallback(() => {
    if (typeof window === 'undefined') return null
    const hash = window.location.hash
    const match = hash.match(/#token=([^&]+)/)
    return match ? decodeURIComponent(match[1]) : null
  }, [])

  const fetchLogoForDomain = useCallback((domain: string) => {
    setLogoLoading(true)
    fetch(`/api/setup/logo-url?domain=${encodeURIComponent(domain)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.url) setLogoUrl(d.url)
      })
      .catch(() => {})
      .finally(() => setLogoLoading(false))
  }, [])

  const onPlacesChanged = () => {
    const places = searchBox?.getPlaces()
    if (!places?.length) return
    const place = places[0]
    setSchoolName(place.name || schoolName)
    setSchoolAddress(place.formatted_address || '')
    let domain = extractDomainFromPlace(place)
    const placeId = (place as { place_id?: string }).place_id
    if (placeId && !domain) {
      fetch(`/api/places/details?placeId=${encodeURIComponent(placeId)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d?.websiteUri) {
            try {
              domain = new URL(d.websiteUri).hostname.replace(/^www\./, '')
            } catch {}
          }
          if (domain) {
            setWebsite(domain)
            fetchLogoForDomain(domain)
          }
        })
        .catch(() => {})
    } else if (domain) {
      setWebsite(domain)
      fetchLogoForDomain(domain)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const valid = file.type === 'image/svg+xml' || file.type === 'image/png' || file.type === 'image/jpeg'
    if (!valid) return
    const reader = new FileReader()
    reader.onload = () => setLogoUrl(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleNextStep = () => {
    if (!schoolName.trim()) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setStep(2)
    }, 400)
  }

  const fireConfetti = () => {
    const end = Date.now() + 1500
    const colors = [primaryColor, secondaryColor, '#ffffff']
    function frame() {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors })
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }

  const token = getToken()
  const authHeaders = token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' }

  const handleContinueFromBranding = async () => {
    if (!schoolName.trim()) return
    setLoading(true)
    try {
      if (token) {
        try {
          await fetch('/api/setup/branding', {
            method: 'PATCH',
            headers: authHeaders,
            body: JSON.stringify({
              orgId,
              name: schoolName.trim(),
              address: schoolAddress?.trim() || undefined,
              logoUrl: logoUrl || null,
              website: website || undefined,
              colors: { primary: primaryColor, secondary: secondaryColor },
            }),
          })
        } catch {
          // continue
        }
        try {
          const buildingsRes = await fetch('/api/buildings', { headers: authHeaders })
          const buildings = await buildingsRes.json()
          if (Array.isArray(buildings) && buildings.length === 0) {
            const createRes = await fetch('/api/buildings', {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify({ name: 'Main Campus', division: 'HIGH' }),
            })
            const b = await createRes.json()
            if (b?.id) {
              await fetch('/api/rooms', {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ name: 'General Room', buildingId: b.id }),
              })
            }
          }
        } catch {
          // non-blocking
        }
      }
      setStep(3)
    } finally {
      setLoading(false)
    }
  }

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.name.toLowerCase().endsWith('.csv')) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const parsed = parseMembersCsv(text)
      setCsvMembers(parsed)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleFinishSetup = async (skipInvites = false) => {
    setLoading(true)
    fireConfetti()
    setStep(4)

    if (token && !skipInvites) {
      const hasCsv = csvMembers.length > 0
      const manualEmails = invites.filter((e) => e.trim().includes('@'))

      if (hasCsv) {
        try {
          await fetch('/api/setup/invite-members', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              orgId,
              members: csvMembers.map((m) => ({
                name: m.name,
                email: m.email,
                role: m.role,
                teamNames: m.teamNames,
              })),
            }),
          })
        } catch {
          // non-blocking
        }
      } else if (manualEmails.length > 0) {
        try {
          await fetch('/api/setup/invite-members', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ orgId, emails: manualEmails }),
          })
        } catch {
          // non-blocking
        }
      }
    }

    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }

    const params = new URLSearchParams()
    const userName = searchParams.get('userName')
    const userEmail = searchParams.get('userEmail')
    if (userName) params.set('userName', userName)
    if (userEmail) params.set('userEmail', userEmail)
    if (schoolName.trim()) params.set('orgName', schoolName.trim())
    const qs = params.toString()

    setTimeout(() => {
      window.location.href = `${LIONHEART_URL}/app${qs ? '?' + qs : ''}`
    }, 2000)
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans">
      {/* Nav - matches landing page */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-900 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <span className="font-bold text-xl tracking-tight text-primary-900">Lionheart</span>
        </div>
        <span className="text-sm text-zinc-500">Setup</span>
      </nav>

      <main className="max-w-7xl mx-auto px-6">
        {/* Stepper */}
        <div className="pt-8 pb-4">
          <div className="flex items-center gap-1 sm:gap-2 max-w-2xl">
            {[
              { n: 1, label: 'Identity' },
              { n: 2, label: 'Branding' },
              { n: 3, label: 'Team' },
              { n: 4, label: 'Done' },
            ].map(({ n, label }, i) => (
              <div key={n} className="flex items-center flex-1 min-w-0">
                <div className={`flex items-center gap-1.5 sm:gap-2 ${step >= n ? 'text-primary-600' : 'text-zinc-400'}`}>
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium shrink-0 ${
                    step >= n ? 'bg-primary-100 text-primary-600' : 'bg-zinc-100 text-zinc-400'
                  }`}>
                    {step > n ? <Check className="w-3 h-3 sm:w-4 sm:h-4" /> : n}
                  </div>
                  <span className="text-xs sm:text-sm font-medium hidden sm:inline truncate">{label}</span>
                </div>
                {i < 3 && <div className={`flex-1 h-0.5 min-w-[8px] mx-0.5 ${step > n ? 'bg-primary-200' : 'bg-zinc-200'}`} />}
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1: Only when no orgName - school search */}
          {step === 1 && !startAtBranding && (
            <motion.section
              key="step1"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="pt-16 pb-24"
            >
              <div className="max-w-xl">
                <h1 className="text-3xl font-bold text-zinc-900 tracking-tight mb-2">Find your school</h1>
                <p className="text-zinc-500 mb-8">Search to pull your logo and address automatically.</p>
                <StandaloneSearchBox onLoad={(ref) => setSearchBox(ref)} onPlacesChanged={onPlacesChanged}>
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search for your school..."
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleNextStep()}
                      className="w-full pl-12 pr-4 py-4 border border-zinc-200 rounded-xl text-lg outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all"
                      autoFocus
                    />
                  </div>
                </StandaloneSearchBox>
                <button
                  onClick={handleNextStep}
                  disabled={!schoolName.trim() || loading}
                  className="mt-6 w-full py-4 bg-primary-600 text-white rounded-xl font-semibold text-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Next <Check className="w-5 h-5" /></>}
                </button>
              </div>
            </motion.section>
          )}

          {/* STEP 2: Branding - Let's make it yours */}
          {step === 2 && (
            <motion.section
              key="step2"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="pt-16 pb-24"
            >
              <div className="max-w-2xl">
                <h1 className="text-3xl font-bold text-zinc-900 tracking-tight mb-2">Let&apos;s make it yours.</h1>
                <p className="text-zinc-500 mb-10">Add your logo and brand colors.</p>

                {/* Logo: search + upload */}
                <div className="mb-10">
                  <label className="block text-sm font-medium text-zinc-700 mb-3">Your logo</label>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                      className="w-24 h-24 rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 hover:border-primary-300 hover:bg-primary-50/30 flex items-center justify-center overflow-hidden cursor-pointer transition-colors shrink-0"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      {logoLoading ? (
                        <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
                      ) : logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="Logo"
                          className="w-full h-full object-contain p-2"
                          onError={() => setLogoUrl('')}
                        />
                      ) : (
                        <div className="text-center">
                          <Upload className="w-8 h-8 text-zinc-400 mx-auto mb-1" />
                          <span className="text-xs text-zinc-500">PNG / SVG</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-500 mb-3">Search for your school to fetch the logo automatically, or upload your own.</p>
                      <StandaloneSearchBox onLoad={(ref) => setSearchBox(ref)} onPlacesChanged={onPlacesChanged}>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                          <input
                            type="text"
                            placeholder="Search school name to fetch logo..."
                            className="w-full pl-10 pr-4 py-3 border border-zinc-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                          />
                        </div>
                      </StandaloneSearchBox>
                    </div>
                  </div>
                </div>

                {/* Campus address - used for Campus Map */}
                <div className="mb-10">
                  <label className="block text-sm font-medium text-zinc-700 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Campus address
                  </label>
                  <p className="text-sm text-zinc-500 mb-3">
                    Used for the Campus Map so we can show a Google view of your campus.
                  </p>
                  <StandaloneSearchBox onLoad={(ref) => setSearchBox(ref)} onPlacesChanged={onPlacesChanged}>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="text"
                        placeholder="Search or enter address..."
                        value={schoolAddress}
                        onChange={(e) => setSchoolAddress(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                      />
                    </div>
                  </StandaloneSearchBox>
                </div>

                {/* Brand colors */}
                <div className="mb-10">
                  <label className="block text-sm font-medium text-zinc-700 mb-4">Brand colors</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-zinc-500 block mb-2">Primary</span>
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 bg-zinc-50">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                        />
                        <span className="text-sm font-mono text-zinc-600">{primaryColor}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-500 block mb-2">Secondary</span>
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 bg-zinc-50">
                        <input
                          type="color"
                          value={secondaryColor}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                          className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                        />
                        <span className="text-sm font-mono text-zinc-600">{secondaryColor}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div className="mb-10 p-4 rounded-xl bg-zinc-50 border border-zinc-100">
                  <p className="text-xs text-zinc-400 mb-3">Preview</p>
                  <div className="w-full h-20 rounded-lg bg-white border border-zinc-200 overflow-hidden flex">
                    <div className="h-full flex items-center px-4" style={{ backgroundColor: primaryColor, minWidth: 120 }}>
                      {logoUrl ? (
                        <img src={logoUrl} alt="" className="h-10 w-auto max-w-[80px] object-contain" />
                      ) : (
                        <span className="text-white font-bold text-lg">L</span>
                      )}
                    </div>
                    <div className="flex-1 flex items-center px-4">
                      <div className="w-8 h-8 rounded-full" style={{ backgroundColor: secondaryColor }} />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  {!startAtBranding && (
                    <button
                      onClick={() => setStep(1)}
                      className="px-6 py-3 rounded-xl border border-zinc-200 text-zinc-600 font-medium hover:bg-zinc-50 transition-colors"
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={handleContinueFromBranding}
                    disabled={loading}
                    className="flex-1 py-3 px-6 rounded-xl bg-primary-600 text-white font-bold hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continue <Check className="w-5 h-5" /></>}
                  </button>
                </div>
              </div>
            </motion.section>
          )}

          {/* STEP 3: Team - Invite colleagues */}
          {step === 3 && (
            <motion.section
              key="step3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="pt-16 pb-24"
            >
              <div className="max-w-xl">
                <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
                  <Users className="w-7 h-7 text-blue-600" />
                </div>
                <h1 className="text-3xl font-bold text-zinc-900 tracking-tight mb-2">Don&apos;t fly solo</h1>
                <p className="text-zinc-500 mb-6">
                  Invite your Facilities Director, IT Admin, or Office Manager. Upload a CSV or enter emails below.
                </p>

                {/* CSV upload */}
                <div className="mb-8">
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => csvInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-colors"
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                    {csvMembers.length > 0
                      ? `${csvMembers.length} members from CSV`
                      : 'Upload CSV'}
                  </button>
                  {csvMembers.length > 0 && (
                    <p className="text-sm text-emerald-600 mt-2">
                      CSV loaded. Use columns: Name, Email, Role, Teams
                    </p>
                  )}
                </div>

                <p className="text-sm text-zinc-500 mb-3">Or enter emails manually:</p>
                <div className="space-y-3 mb-8">
                  {invites.map((email, idx) => (
                    <div key={idx} className="relative">
                      <input
                        type="email"
                        placeholder="colleague@school.edu"
                        className="w-full py-3 px-4 border border-zinc-200 rounded-xl text-zinc-900 outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                        value={email}
                        onChange={(e) => {
                          const next = [...invites]
                          next[idx] = e.target.value
                          setInvites(next)
                        }}
                      />
                      {email.trim().includes('@') && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">
                          <Check className="w-5 h-5" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleFinishSetup(false)}
                  disabled={loading}
                  className="w-full py-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mb-3"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Finish Setup'}
                </button>
                <button
                  onClick={() => handleFinishSetup(true)}
                  className="w-full py-2 text-zinc-500 text-sm hover:text-zinc-700"
                >
                  Skip for now
                </button>
              </div>
            </motion.section>
          )}

          {/* STEP 4: Celebration */}
          {step === 4 && (
            <motion.section
              key="step4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pt-32 pb-24 text-center"
            >
              <div className="text-6xl mb-6">🎉</div>
              <h1 className="text-3xl font-bold text-zinc-900 tracking-tight mb-2">Welcome home!</h1>
              <p className="text-zinc-500 mb-8">Your campus is ready. Taking you to your dashboard…</p>
              <Loader2 className="w-10 h-10 animate-spin text-zinc-400 mx-auto" />
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center text-zinc-500">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      }
    >
      <SetupContent />
    </Suspense>
  )
}
