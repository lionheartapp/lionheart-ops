'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useJsApiLoader, StandaloneSearchBox } from '@react-google-maps/api'
import { ArrowRight, Check, Loader2, School, Building2, Upload } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import confetti from 'canvas-confetti'

const LIBRARIES: ('places')[] = ['places']
const LIONHEART_URL = (process.env.NEXT_PUBLIC_LIONHEART_URL || 'http://localhost:5173').replace(/\/+$/, '')

function extractDomain(place: google.maps.places.PlaceResult): string | null {
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
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [schoolName, setSchoolName] = useState(orgNameFromUrl || '')
  const [schoolAddress, setSchoolAddress] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#3b82f6')
  const [secondaryColor, setSecondaryColor] = useState('#f59e0b')
  const [logoUrl, setLogoUrl] = useState('')
  const [website, setWebsite] = useState('')
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null)

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

  const getToken = useCallback(() => {
    if (typeof window === 'undefined') return null
    const hash = window.location.hash
    const match = hash.match(/#token=([^&]+)/)
    return match ? decodeURIComponent(match[1]) : null
  }, [])

  const onPlacesChanged = () => {
    const places = searchBox?.getPlaces()
    if (!places?.length) return
    const place = places[0]
    setSchoolName(place.name || '')
    setSchoolAddress(place.formatted_address || '')
    const domain = extractDomain(place)
    if (domain) {
      setWebsite(domain)
      setLogoUrl('')
      fetch(`/api/setup/logo-url?domain=${encodeURIComponent(domain)}`)
        .then((r) => r.json())
        .then((d) => d?.url && setLogoUrl(d.url))
        .catch(() => {})
    } else {
      setLogoUrl('')
      setWebsite('')
    }
  }

  const handleNextStep = () => {
    if (!schoolName.trim()) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setStep(2)
    }, 600)
  }

  const fireConfetti = () => {
    const end = Date.now() + 1500
    const colors = [primaryColor, secondaryColor, '#ffffff']
    function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors,
      })
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors,
      })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }

  const handleFinish = async () => {
    fireConfetti()
    setStep(3)

    const token = getToken()
    if (token && schoolName) {
      try {
        await fetch('/api/setup/branding', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            orgId,
            name: schoolName.trim(),
            address: schoolAddress || undefined,
            logoUrl: logoUrl || null,
            website: website || undefined,
            colors: { primary: primaryColor, secondary: secondaryColor },
          }),
        })
      } catch {
        // continue
      }
      if (typeof window !== 'undefined' && window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
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
    <div className="min-h-screen w-full bg-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background: Soft aurora gradients */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-100 rounded-full blur-[100px] opacity-60 animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-violet-100 rounded-full blur-[100px] opacity-60 animate-[pulse_10s_ease-in-out_infinite]" />
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1: Identity */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="relative z-10 w-full max-w-lg"
          >
            <div className="bg-white/80 backdrop-blur-xl border border-white/60 p-8 rounded-3xl shadow-2xl shadow-zinc-200/50">
              <div className="mb-8 text-center">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-3xl shadow-inner">
                  🏫
                </div>
                <h1 className="text-3xl font-bold text-zinc-900 tracking-tight mb-2">
                  What&apos;s your school&apos;s name?
                </h1>
                <p className="text-zinc-500">We&apos;ll set up your digital campus based on your location.</p>
              </div>

              <div className="space-y-4">
                <StandaloneSearchBox onLoad={(ref) => setSearchBox(ref)} onPlacesChanged={onPlacesChanged}>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                      <School className="w-5 h-5 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search for your school..."
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleNextStep()}
                      className="w-full pl-12 pr-4 py-4 bg-white border border-zinc-200 rounded-xl text-lg outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm text-zinc-900"
                      autoFocus
                    />
                  </div>
                </StandaloneSearchBox>

                <button
                  onClick={handleNextStep}
                  disabled={!schoolName.trim() || loading}
                  className="w-full py-4 bg-zinc-900 text-white rounded-xl font-semibold text-lg hover:bg-zinc-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-zinc-900/20"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Next <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 2: Personalize */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="relative z-10 w-full max-w-lg"
          >
            <div className="bg-white/90 backdrop-blur-xl border border-white/60 p-8 rounded-3xl shadow-2xl shadow-zinc-200/50">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900">Let&apos;s make it yours.</h2>
                  <p className="text-zinc-500 text-sm mt-1">{schoolName}</p>
                </div>
                <div className="w-16 h-16 rounded-xl border border-zinc-100 bg-white shadow-md flex items-center justify-center overflow-hidden p-2 relative group cursor-pointer">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="w-full h-full object-contain"
                      onError={() => setLogoUrl('')}
                    />
                  ) : (
                    <Building2 className="w-8 h-8 text-zinc-300" />
                  )}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Upload className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                    Brand Colors
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-zinc-700">Primary</span>
                      <div className="flex items-center gap-3 p-2 rounded-xl border border-zinc-200 bg-zinc-50">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                        />
                        <span className="text-sm font-mono text-zinc-500 uppercase">{primaryColor}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-zinc-700">Secondary</span>
                      <div className="flex items-center gap-3 p-2 rounded-xl border border-zinc-200 bg-zinc-50">
                        <input
                          type="color"
                          value={secondaryColor}
                          onChange={(e) => setSecondaryColor(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                        />
                        <span className="text-sm font-mono text-zinc-500 uppercase">{secondaryColor}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100">
                  <p className="text-xs text-zinc-400 mb-2 text-center">Dashboard Preview</p>
                  <div className="w-full h-24 rounded-lg bg-white shadow-sm border border-zinc-200 overflow-hidden flex flex-col">
                    <div className="h-8 w-full flex items-center px-3" style={{ backgroundColor: primaryColor }}>
                      <div className="w-16 h-2 bg-white/20 rounded-full" />
                    </div>
                    <div className="flex-1 p-3 flex gap-3">
                      <div className="w-12 h-full bg-zinc-100 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <div className="w-3/4 h-2 bg-zinc-100 rounded-full" />
                        <div className="w-1/2 h-2 bg-zinc-100 rounded-full" />
                        <div className="mt-auto w-8 h-8 rounded-full ml-auto" style={{ backgroundColor: secondaryColor }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setStep(1)}
                    className="px-6 py-3 rounded-xl border border-zinc-200 text-zinc-600 font-medium hover:bg-zinc-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleFinish}
                    className="flex-1 px-6 py-3 rounded-xl bg-zinc-900 text-white font-bold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-zinc-900/20"
                  >
                    Finish Setup <Check className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 3: Celebration */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 w-full max-w-lg text-center"
          >
            <div className="bg-white/90 backdrop-blur-xl border border-white/60 p-12 rounded-3xl shadow-2xl shadow-zinc-200/50">
              <div className="text-6xl mb-6">🎉</div>
              <h1 className="text-3xl font-bold text-zinc-900 tracking-tight mb-2">Welcome home!</h1>
              <p className="text-zinc-500 mb-8">
                Your campus is ready. Taking you to your dashboard…
              </p>
              <Loader2 className="w-10 h-10 animate-spin text-zinc-400 mx-auto" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
