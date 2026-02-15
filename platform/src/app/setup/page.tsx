'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GoogleMap, useJsApiLoader, StandaloneSearchBox } from '@react-google-maps/api'
import { Search, MapPin, ArrowRight, Sparkles, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

const LIBRARIES: ('places')[] = ['places']

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#263c3f' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#746855' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f2835' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#f3d19c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
]

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  mapTypeId: 'hybrid',
  styles: MAP_STYLES,
  tilt: 45,
  heading: 0,
}

type SchoolData = {
  name: string
  address: string
  colors: { primary: string; secondary: string }
  logo: string | null
  website: string
}

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
  const [step, setStep] = useState(1)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null)
  const [selectedPlace, setSelectedPlace] = useState<google.maps.places.PlaceResult | null>(null)
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null)
  const [orgName, setOrgName] = useState(orgNameFromUrl || '')
  const [error, setError] = useState('')

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  })

  const getToken = useCallback(() => {
    if (typeof window === 'undefined') return null
    const hash = window.location.hash
    const match = hash.match(/#token=([^&]+)/)
    return match ? decodeURIComponent(match[1]) : null
  }, [])

  useEffect(() => {
    if (!orgId || orgNameFromUrl) return
    fetch(`/api/setup/org?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => r.json())
      .then((d) => d.name && setOrgName(d.name))
      .catch(() => {})
  }, [orgId, orgNameFromUrl])

  useEffect(() => {
    if (!map || selectedPlace) return
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          map.setZoom(13)
        },
        () => {}
      )
    }
  }, [map, selectedPlace])

  const onLoadMap = useCallback((m: google.maps.Map) => setMap(m), [])
  const onLoadSearchBox = useCallback((ref: google.maps.places.SearchBox) => setSearchBox(ref), [])

  const onPlacesChanged = useCallback(() => {
    const places = searchBox?.getPlaces()
    if (!places?.length) return

    const place = places[0]
    const location = place.geometry?.location
    const types = place.types || []

    if (!location) return

    const isSchool = types.some((t) =>
      ['school', 'university', 'secondary_school', 'primary_school', 'college'].includes(t)
    )
    if (!isSchool) {
      setError("This location isn't listed as a school. You can still proceed if it's correct.")
    } else {
      setError('')
    }

    setSelectedPlace(place)
    map?.panTo(location)
    map?.setZoom(18)
    map?.setTilt(45)
    setStep(2)

    setTimeout(() => {
      const domain = extractDomain(place)
      const logo = domain ? `https://logo.clearbit.com/${domain}` : null
      setSchoolData({
        name: place.name || orgName || 'Your School',
        address: place.formatted_address || '',
        colors: { primary: '#1e3a8a', secondary: '#fbbf24' },
        logo,
        website: domain || '',
      })
      setStep(3)
    }, 3000)
  }, [searchBox, map, orgName])

  const handleFinish = async () => {
    if (!schoolData || !orgId) return
    const token = getToken()
    if (token) {
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
    const qs = params.toString()
    window.location.href = `${LIONHEART_URL}/app${qs ? '?' + qs : ''}`
  }

  const handleWrongSchool = () => {
    setStep(1)
    setSelectedPlace(null)
    setSchoolData(null)
    setError('')
  }

  if (!orgId) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="text-center text-zinc-500">
          <p className="text-lg">Missing organization. Please complete signup first.</p>
          <a
            href={`${LIONHEART_URL}/signup`}
            className="mt-4 inline-block text-blue-400 hover:underline font-medium"
          >
            Go to signup →
          </a>
        </div>
      </div>
    )
  }

  if (!apiKey) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">
        <p>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured. Add it to platform/.env</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span>Initializing map…</span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden font-sans bg-zinc-950">
      <div className="absolute inset-0 z-0">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={{ lat: 37.0902, lng: -95.7129 }}
          zoom={4}
          options={mapOptions}
          onLoad={onLoadMap}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/20 to-zinc-950/20 pointer-events-none" />
      </div>

      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 pointer-events-none">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
              className="pointer-events-auto w-full max-w-lg"
            >
              <div className="bg-white/95 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl shadow-black/50">
                <div className="mb-6">
                  <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Identify your campus.</h1>
                  <p className="text-zinc-500 mt-2">
                    Search for your school to auto-configure branding and satellite maps.
                  </p>
                </div>

                <StandaloneSearchBox onLoad={onLoadSearchBox} onPlacesChanged={onPlacesChanged}>
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 group-focus-within:text-blue-600 transition-colors" />
                    <input
                      type="text"
                      placeholder="Search school name or address…"
                      className="w-full pl-12 pr-4 py-4 bg-zinc-50 border-2 border-transparent focus:bg-white focus:border-blue-500 rounded-2xl outline-none text-lg transition-all shadow-inner text-zinc-900"
                      autoFocus
                    />
                  </div>
                </StandaloneSearchBox>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 p-3 bg-amber-50 text-amber-700 rounded-xl flex items-center gap-2 text-sm font-medium"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="relative w-[320px] h-[320px] sm:w-[400px] sm:h-[400px] flex items-center justify-center">
                <div className="absolute inset-0 border border-emerald-500/30 rounded-full animate-ping" />
                <div className="absolute inset-0 border border-emerald-500/20 rounded-full animate-[ping_3s_linear_infinite]" />
                <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent absolute top-1/2 blur-sm animate-[spin_4s_linear_infinite]" />
                <div className="bg-zinc-900/80 backdrop-blur-md px-6 py-3 rounded-full border border-emerald-500/30 text-emerald-400 font-mono text-sm flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  Analyzing campus infrastructure…
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && schoolData && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="pointer-events-auto w-full max-w-lg"
            >
              <div className="bg-white rounded-3xl overflow-hidden shadow-2xl ring-1 ring-black/5">
                <div
                  className="h-32 w-full relative flex items-center justify-center"
                  style={{ backgroundColor: schoolData.colors.primary }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  <div className="w-24 h-24 bg-white rounded-2xl shadow-xl flex items-center justify-center p-2 absolute -bottom-12 border-4 border-white">
                    {schoolData.logo ? (
                      <img
                        src={schoolData.logo}
                        alt="School"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          e.currentTarget.nextElementSibling?.classList.remove('hidden')
                        }}
                      />
                    ) : null}
                    <span
                      className={`text-lg font-bold text-zinc-600 truncate px-1 ${schoolData.logo ? 'hidden' : ''}`}
                    >
                      {schoolData.name}
                    </span>
                  </div>
                </div>

                <div className="pt-16 pb-8 px-8 text-center">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold uppercase tracking-wider mb-4">
                    <Sparkles className="w-3.5 h-3.5" /> Match Found
                  </div>

                  <h2 className="text-2xl font-bold text-zinc-900 mb-2">{schoolData.name}</h2>
                  <p className="text-zinc-500 flex items-center justify-center gap-1.5 text-sm">
                    <MapPin className="w-4 h-4 shrink-0" /> {schoolData.address}
                  </p>

                  <div className="mt-8 grid grid-cols-2 gap-3 text-left">
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                      <p className="text-xs text-zinc-400 font-medium uppercase">Primary</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div
                          className="w-4 h-4 rounded-full shrink-0"
                          style={{ background: schoolData.colors.primary }}
                        />
                        <span className="text-sm font-mono text-zinc-700">{schoolData.colors.primary}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100">
                      <p className="text-xs text-zinc-400 font-medium uppercase">Satellite</p>
                      <div className="flex items-center gap-2 mt-1 text-emerald-600">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span className="text-sm font-medium">Synced</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex gap-3">
                    <button
                      type="button"
                      onClick={handleWrongSchool}
                      className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 text-zinc-600 font-medium hover:bg-zinc-50 transition-colors"
                    >
                      Wrong school
                    </button>
                    <button
                      type="button"
                      onClick={handleFinish}
                      className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                    >
                      Confirm & Continue <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      }
    >
      <SetupContent />
    </Suspense>
  )
}
