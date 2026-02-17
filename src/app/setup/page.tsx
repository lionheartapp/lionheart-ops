'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, Search, MapPin, Users, FileSpreadsheet, Globe, Upload, Link as LinkIcon, Copy, Plus, X, ChevronDown } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import confetti from 'canvas-confetti'
import { parseMembersCsv } from '@/lib/parseMembersCsv'

const LIONHEART_URL = (process.env.NEXT_PUBLIC_LIONHEART_URL || 'http://localhost:5173').replace(/\/+$/, '')
const PRIMARY = '#3b82f6'
const SECONDARY = '#f59e0b'

type SearchResult = {
  name: string
  address: string
  website?: string
  domain?: string
  logo?: string
}

function SetupContent() {
  const searchParams = useSearchParams()
  const orgId = searchParams?.get('orgId')
  const orgNameFromUrl = searchParams?.get('orgName')
  const userEmailFromUrl = searchParams?.get('userEmail')

  if (!orgId) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="text-center text-zinc-600">
          <p className="text-lg">Missing organization. Please complete signup first.</p>
          <a
            href={`${LIONHEART_URL}/signup`}
            className="mt-4 inline-block text-[#3b82f6] hover:underline font-medium"
          >
            Go to signup →
          </a>
        </div>
      </div>
    )
  }

  return (
    <SetupWizard
      orgId={orgId}
      orgNameFromUrl={orgNameFromUrl ?? null}
      userEmailFromUrl={userEmailFromUrl ?? null}
      searchParams={searchParams ?? new URLSearchParams()}
    />
  )
}

const GENERIC_EMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'aol.com', 'mail.com'])

/** Map user-friendly role labels (or CSV values) to DB UserRole enum values.
 * Roles: Admin (Director), Member (Doers), Requester (Teachers), Viewer (Optional) */
function normalizeRole(role?: string): string | undefined {
  if (!role || !role.trim()) return undefined
  const r = role.trim().toLowerCase()
  if (r === 'admin') return 'ADMIN'
  if (['member', 'maintenance', 'secretary', 'site secretary'].includes(r)) return 'SITE_SECRETARY'
  if (['requester', 'teacher'].includes(r)) return 'TEACHER'
  if (r === 'viewer') return 'VIEWER'
  if (['ADMIN', 'SITE_SECRETARY', 'TEACHER', 'VIEWER'].includes(role.trim())) return role.trim()
  return undefined
}

function SetupWizard({
  orgId,
  orgNameFromUrl,
  userEmailFromUrl,
  searchParams,
}: {
  orgId: string
  orgNameFromUrl: string | null
  userEmailFromUrl: string | null
  searchParams: URLSearchParams
}) {
  // Always start at step 1 (School Identity) - branding is mandatory, never skip
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const domainHint = (() => {
    const email = userEmailFromUrl?.trim().toLowerCase()
    if (!email || !email.includes('@')) return null
    const domain = email.split('@')[1]
    if (!domain || GENERIC_EMAIL_DOMAINS.has(domain)) return null
    const part = domain.split('.')[0]
    return part ? part.charAt(0).toUpperCase() + part.slice(1) : null
  })()
  const [searchQuery, setSearchQuery] = useState(domainHint || '')
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [schoolData, setSchoolData] = useState({
    name: orgNameFromUrl || '',
    address: '',
    website: '',
    logoUrl: '',
    loginHeroImageUrl: '',
    primaryColor: PRIMARY,
    secondaryColor: SECONDARY,
  })
  const [extractingBrand, setExtractingBrand] = useState(false)
  const hasAutoExtracted = useRef(false)

  useEffect(() => {
    if (orgNameFromUrl) setSchoolData((p) => ({ ...p, name: orgNameFromUrl }))
  }, [orgNameFromUrl])

  // Auto-extract colors and logo when a search result with a website is found
  useEffect(() => {
    if (!searchResult || hasAutoExtracted.current) return
    const raw = (searchResult.website || (searchResult.domain ? `https://${searchResult.domain}` : '')).trim()
    if (!raw || !raw.includes('.')) return
    hasAutoExtracted.current = true
    setExtractingBrand(true)
    fetch('/api/setup/extract-brand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: raw }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.primaryColor || data.secondaryColor || data.logoUrl) {
          setSchoolData((p) => ({
            ...p,
            primaryColor: data.primaryColor || p.primaryColor,
            secondaryColor: data.secondaryColor || p.secondaryColor,
            logoUrl: data.logoUrl || p.logoUrl,
          }))
        }
      })
      .catch(() => {})
      .finally(() => setExtractingBrand(false))
  }, [searchResult])
  const [invites, setInvites] = useState<Array<{ email: string; role: string }>>([
    { email: '', role: 'ADMIN' },
    { email: '', role: 'TEACHER' },
    { email: '', role: 'TEACHER' },
  ])
  const [linkCopied, setLinkCopied] = useState(false)
  const [csvMembers, setCsvMembers] = useState<Array<{ name: string; email: string; role?: string; teamNames?: string[] }>>([])
  const csvInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getToken = useCallback(() => {
    if (typeof window === 'undefined') return null
    const hash = window.location.hash
    const match = hash.match(/#token=([^&]+)/)
    return match ? decodeURIComponent(match[1]) : null
  }, [])

  const token = getToken()
  const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) authHeaders.Authorization = `Bearer ${token}`

  const saveSchoolAndCreateFacilities = useCallback(async (data: { name: string; address: string; website?: string; logoUrl?: string; loginHeroImageUrl?: string; primaryColor?: string; secondaryColor?: string }) => {
    if (!token) return
    await fetch('/api/setup/branding', {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        orgId,
        name: data.name.trim(),
        address: data.address?.trim() || undefined,
        website: data.website || undefined,
        logoUrl: data.logoUrl || null,
        loginHeroImageUrl: data.loginHeroImageUrl?.trim() || null,
        primaryColor: data.primaryColor || PRIMARY,
        secondaryColor: data.secondaryColor || SECONDARY,
      }),
    })
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
  }, [orgId, token])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setLoading(true)
    setSearchResult(null)
    try {
      const res = await fetch('/api/setup/search-school', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim() }),
      })
      const data = await res.json()
      if (data.found) {
        setSearchResult(data)
        setSchoolData({
          name: data.name,
          address: data.address || '',
          website: data.website || data.domain || '',
          logoUrl: data.logo || '',
          loginHeroImageUrl: '',
          primaryColor: '',
          secondaryColor: '',
        })
      } else {
        setManualMode(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleExtractBrand = async () => {
    const url = schoolData.website?.trim()
    if (!url) return
    setExtractingBrand(true)
    try {
      const res = await fetch('/api/setup/extract-brand', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (res.ok && (data.primaryColor || data.secondaryColor || data.logoUrl)) {
        setSchoolData((p) => ({
          ...p,
          primaryColor: data.primaryColor || p.primaryColor,
          secondaryColor: data.secondaryColor || p.secondaryColor,
          logoUrl: data.logoUrl || p.logoUrl,
        }))
      }
    } catch {
      // non-blocking
    } finally {
      setExtractingBrand(false)
    }
  }

  const confirmSchool = async () => {
    setLoading(true)
    try {
      if (token) {
        await saveSchoolAndCreateFacilities(schoolData)
      }
      setStep(2)
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
      setCsvMembers(parseMembersCsv(text))
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setSchoolData((p) => ({ ...p, logoUrl: reader.result as string }))
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const fireConfetti = () => {
    const end = Date.now() + 1500
    const colors = [PRIMARY, SECONDARY, '#ffffff']
    function frame() {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors })
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    frame()
  }

  const addInviteRow = () => setInvites((p) => [...p, { email: '', role: 'TEACHER' }])
  const removeInviteRow = (idx: number) => setInvites((p) => p.filter((_, i) => i !== idx))
  const updateInvite = (idx: number, field: 'email' | 'role', value: string) => {
    setInvites((p) => {
      const n = [...p]
      n[idx] = { ...n[idx], [field]: value }
      return n
    })
  }

  const copyInviteLink = () => {
    const base = LIONHEART_URL.replace(/\/+$/, '')
    navigator.clipboard.writeText(`${base}/join/${orgId}`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const handleFinishSetup = async (skipInvites = false) => {
    setLoading(true)
    fireConfetti()
    setStep(3)
    if (token && !skipInvites) {
      const hasCsv = csvMembers.length > 0
      const manualMembers = invites.filter((i) => i.email.trim().includes('@')).map((i) => ({ email: i.email.trim().toLowerCase(), role: i.role }))
      try {
        if (hasCsv) {
          const normalizedCsv = csvMembers.map((m) => ({ ...m, role: normalizeRole(m.role) ?? m.role }))
          await fetch('/api/setup/invite-members', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ orgId, members: normalizedCsv }),
          })
        } else if (manualMembers.length > 0) {
          await fetch('/api/setup/invite-members', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ orgId, members: manualMembers }),
          })
        }
      } catch {
        // non-blocking
      }
    }
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    const params = new URLSearchParams()
    params.set('onboarding', '1')
    if (orgId) params.set('orgId', orgId)
    if (searchParams?.get('userName')) params.set('userName', searchParams.get('userName')!)
    if (searchParams?.get('userEmail')) params.set('userEmail', searchParams.get('userEmail')!)
    if (schoolData.name) params.set('orgName', schoolData.name)
    if (schoolData.website) params.set('orgWebsite', schoolData.website)
    if (schoolData.address) params.set('orgAddress', schoolData.address)
    if (schoolData.logoUrl && schoolData.logoUrl.startsWith('http')) params.set('orgLogoUrl', schoolData.logoUrl)
    const qs = params.toString()
    // Stay on same origin so auth token in localStorage is preserved (avoid 401 on onboarding).
    const appUrl = typeof window !== 'undefined' ? `${window.location.origin}/app?${qs}` : `${LIONHEART_URL}/app?${qs}`
    setTimeout(() => {
      window.location.href = appUrl
    }, 2000)
  }

  const glassCard = 'rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50'

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-zinc-50">
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: PRIMARY }}>
          L
        </div>
        <span className="font-bold text-xl text-zinc-900 tracking-tight">Lionheart</span>
      </div>

      <AnimatePresence mode="wait">
        {/* STEP 1: Search & Confirm */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={`w-full max-w-lg p-8 ${glassCard}`}
          >
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-4" style={{ backgroundColor: `${PRIMARY}20` }}>
                <Search className="w-6 h-6" style={{ color: PRIMARY }} />
              </div>
              <h1 className="text-2xl font-bold text-zinc-900">Find your school</h1>
              <p className="text-zinc-600 text-sm mt-2">
                We&apos;ll auto-fill your logo, address, and campus map.
              </p>
            </div>

            {!searchResult && !manualMode && (
              <form onSubmit={handleSearch} className="relative">
                <input
                  type="text"
                  placeholder="e.g. Lincoln Academy, Riverside Prep"
                  className="w-full rounded-xl pl-4 pr-24 py-3.5 text-zinc-900 placeholder-zinc-400 bg-white border border-zinc-200 focus:ring-2 focus:ring-[#3b82f6]/30 focus:border-[#3b82f6] outline-none transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading || !searchQuery.trim()}
                  className="absolute right-2 top-2 bottom-2 px-4 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50"
                  style={{ backgroundColor: PRIMARY }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                </button>
              </form>
            )}

            {searchResult && !manualMode && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 rounded-xl overflow-hidden border border-zinc-200 bg-zinc-50"
              >
                <div className="h-0.5 bg-gradient-to-r from-[#3b82f6] to-[#f59e0b]" />
                <div className="p-5">
                  {/* School info row */}
                  <div className="flex items-start gap-4">
                    <div className="relative w-16 h-16 bg-white rounded-lg p-2 shrink-0">
                      {(schoolData.logoUrl || searchResult.logo) ? (
                        <>
                          <img src={schoolData.logoUrl || searchResult.logo} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                          <div className="absolute -bottom-1 -right-1 flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white" title="Logo found">
                            <Check className="w-3 h-3" strokeWidth={3} />
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full rounded bg-zinc-100 flex items-center justify-center text-zinc-500 text-xs">
                          {extractingBrand ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Logo'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-zinc-900">{searchResult.name}</h3>
                      {searchResult.address && (
                        <div className="flex items-center gap-1.5 text-sm text-zinc-600 mt-1">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          {searchResult.address}
                        </div>
                      )}
                      {searchResult.domain && (
                        <div className="flex items-center gap-1.5 text-sm text-zinc-600 mt-0.5">
                          <Globe className="w-3.5 h-3.5 shrink-0" />
                          {searchResult.domain}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Branding section – show logo and colors when found */}
                  {(searchResult.website || searchResult.domain) && (
                    <div className="mt-5 p-4 rounded-xl bg-white border border-zinc-200">
                      <p className="text-sm font-medium text-zinc-700 mb-3">Your branding</p>
                      {extractingBrand ? (
                        <div className="flex items-center gap-3 py-2">
                          <Loader2 className="w-5 h-5 animate-spin text-[#3b82f6]" />
                          <span className="text-sm text-zinc-600">Fetching logo and colors from your website…</span>
                        </div>
                      ) : (schoolData.logoUrl || searchResult.logo) || (schoolData.primaryColor && schoolData.secondaryColor) ? (
                        <div className="flex items-center gap-4 flex-wrap">
                          {(schoolData.logoUrl || searchResult.logo) && (
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-14 bg-zinc-50 rounded-lg flex items-center justify-center p-2 overflow-hidden">
                                <img src={schoolData.logoUrl || searchResult.logo} alt="" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                              </div>
                              <span className="text-xs text-emerald-600 font-medium">Logo found</span>
                            </div>
                          )}
                          {schoolData.primaryColor && schoolData.secondaryColor ? (
                            <div className="flex items-center gap-2">
                              <div className="flex rounded-lg overflow-hidden border border-zinc-200">
                                <div className="w-8 h-8" style={{ backgroundColor: schoolData.primaryColor }} title="Primary" />
                                <div className="w-8 h-8" style={{ backgroundColor: schoolData.secondaryColor }} title="Secondary" />
                              </div>
                              <span className="text-xs text-emerald-600 font-medium">Colors found</span>
                            </div>
                          ) : (searchResult.website || searchResult.domain) ? (
                            <p className="text-sm text-zinc-500">Colors not yet extracted. Click below to pull from your website.</p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-sm text-zinc-500 mb-3">We&apos;ll pull your logo and colors from your website.</p>
                      )}
                      <button
                        type="button"
                        onClick={handleExtractBrand}
                        disabled={extractingBrand}
                        className="w-full mt-2 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-60 border-2 border-dashed border-zinc-300 hover:border-[#3b82f6]/50 hover:bg-[#3b82f6]/5 text-zinc-700 hover:text-[#3b82f6]"
                      >
                        {extractingBrand ? <Loader2 className="w-5 h-5 animate-spin" /> : <Globe className="w-5 h-5" />}
                        {extractingBrand ? 'Extracting…' : 'Extract logo & colors from website'}
                      </button>
                    </div>
                  )}

                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={confirmSchool}
                      disabled={loading || extractingBrand}
                      className="flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-white"
                      style={{ backgroundColor: PRIMARY }}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Yes, this is us <Check className="w-4 h-4" /></>}
                    </button>
                    <button
                      onClick={() => { setSearchResult(null); setManualMode(true) }}
                      disabled={extractingBrand}
                      className="px-4 py-2.5 rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors disabled:opacity-50"
                    >
                      No
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {manualMode && (
              <motion.form
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onSubmit={(e) => { e.preventDefault(); confirmSchool() }}
                className="space-y-4 mt-6"
              >
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">School Name</label>
                  <input
                    className="w-full rounded-lg px-3 py-2 text-zinc-900 bg-white border border-zinc-200 focus:ring-2 focus:ring-[#3b82f6]/30 outline-none"
                    value={schoolData.name}
                    onChange={(e) => setSchoolData((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Address</label>
                  <input
                    className="w-full rounded-lg px-3 py-2 text-zinc-900 bg-white border border-zinc-200 focus:ring-2 focus:ring-[#3b82f6]/30 outline-none"
                    value={schoolData.address}
                    onChange={(e) => setSchoolData((p) => ({ ...p, address: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Website</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 rounded-lg px-3 py-2 text-zinc-900 bg-white border border-zinc-200 focus:ring-2 focus:ring-[#3b82f6]/30 outline-none"
                      placeholder="e.g. schoolname.com, www.schoolname.com, or https://schoolname.com"
                      value={schoolData.website}
                      onChange={(e) => setSchoolData((p) => ({ ...p, website: e.target.value }))}
                    />
                    <button
                      type="button"
                      onClick={handleExtractBrand}
                      disabled={extractingBrand || !schoolData.website.trim()}
                      className="px-3 py-2 rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-100 transition-colors text-xs whitespace-nowrap flex items-center gap-1 disabled:opacity-50"
                    >
                      {extractingBrand ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />}
                      {extractingBrand ? 'Extracting…' : 'Auto-fill'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Logo (optional)</label>
                  <div className="flex items-center gap-3">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                      className="relative w-14 h-14 rounded-lg border-2 border-dashed border-zinc-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-[#3b82f6]/50 transition-colors"
                    >
                      <input ref={fileInputRef} type="file" accept=".svg,.png,.jpg,.jpeg,image/*" onChange={handleFileUpload} className="hidden" />
                      {schoolData.logoUrl ? (
                        <>
                          <img src={schoolData.logoUrl} alt="" className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                          <div className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white" title="Logo added">
                            <Check className="w-2.5 h-2.5" strokeWidth={3} />
                          </div>
                        </>
                      ) : (
                        <Upload className="w-5 h-5 text-zinc-500" />
                      )}
                    </div>
                    <span className="text-xs text-zinc-500">{schoolData.logoUrl ? 'Logo added – click to change' : 'PNG / SVG – click to upload'}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-1">Login page hero image (optional)</label>
                  <input
                    type="url"
                    className="w-full rounded-lg px-3 py-2 text-zinc-900 bg-white border border-zinc-200 focus:ring-2 focus:ring-[#3b82f6]/30 outline-none"
                    placeholder="https://example.com/campus-photo.jpg"
                    value={schoolData.loginHeroImageUrl}
                    onChange={(e) => setSchoolData((p) => ({ ...p, loginHeroImageUrl: e.target.value }))}
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">Shown on your school&apos;s login page. Leave blank for stock image.</p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setManualMode(false)}
                    className="px-4 py-2 text-zinc-600 hover:text-zinc-900"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !schoolData.name.trim()}
                    className="flex-1 py-2.5 rounded-lg font-medium text-white disabled:opacity-50"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Continue'}
                  </button>
                </div>
              </motion.form>
            )}

            {!searchResult && !manualMode && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => setManualMode(true)}
                  className="text-xs text-zinc-500 hover:text-zinc-700"
                >
                  Skip search and enter manually
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* STEP 2: Team */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className={`w-full max-w-lg p-8 ${glassCard}`}
          >
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-4" style={{ backgroundColor: `${PRIMARY}20` }}>
                <Users className="w-6 h-6" style={{ color: PRIMARY }} />
              </div>
              <h1 className="text-2xl font-bold text-zinc-900">Invite your team</h1>
              <p className="text-zinc-600 text-sm mt-1">Operations work better together.</p>
            </div>

            <div className="mb-6 p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center gap-3">
              <LinkIcon className="w-5 h-5 text-zinc-500 shrink-0" />
              <input
                readOnly
                value={`${LIONHEART_URL.replace(/\/+$/, '')}/join/${orgId}`}
                className="flex-1 bg-transparent border-0 text-sm text-zinc-700 focus:ring-0 min-w-0"
              />
              <button
                type="button"
                onClick={copyInviteLink}
                className="px-4 py-2 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-100 text-xs font-medium transition-colors flex items-center gap-2 shrink-0"
              >
                {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {linkCopied ? 'Copied' : 'Copy Link'}
              </button>
            </div>

            <div className="mb-4">
              <input ref={csvInputRef} type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
              <button
                type="button"
                onClick={() => csvInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-300 text-zinc-700 hover:bg-zinc-100 transition-colors text-sm"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {csvMembers.length > 0 ? `${csvMembers.length} from CSV` : 'Upload CSV'}
              </button>
            </div>

            <p className="text-xs text-zinc-600 mb-3">Or enter emails:</p>
            <div className="space-y-3 mb-6">
              {invites.map((inv, idx) => (
                <div key={idx} className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="email"
                      placeholder="colleague@school.edu"
                      className="w-full rounded-xl px-4 py-3 text-zinc-900 placeholder-zinc-400 bg-white border border-zinc-200 focus:ring-2 focus:ring-[#3b82f6]/30 outline-none pr-10"
                      value={inv.email}
                      onChange={(e) => updateInvite(idx, 'email', e.target.value)}
                    />
                    {inv.email.trim().includes('@') && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500">
                        <Check className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  <div className="relative shrink-0 w-[140px]">
                    <select
                      className="w-full rounded-xl pl-3 pr-12 py-3 text-zinc-900 bg-white border border-zinc-200 focus:ring-2 focus:ring-[#3b82f6]/30 outline-none text-sm appearance-none cursor-pointer"
                      value={inv.role}
                      onChange={(e) => updateInvite(idx, 'role', e.target.value)}
                    >
                      <option value="ADMIN">Admin</option>
                      <option value="SITE_SECRETARY">Member</option>
                      <option value="TEACHER">Requester</option>
                      <option value="VIEWER">Viewer (Optional)</option>
                    </select>
                    <ChevronDown className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" style={{ right: 16 }} aria-hidden />
                  </div>
                  {invites.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeInviteRow(idx)}
                      className="p-2.5 text-zinc-500 hover:text-red-500 hover:bg-zinc-100 rounded-xl transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addInviteRow}
                className="text-sm text-[#3b82f6] hover:text-[#60a5fa] font-medium flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add another
              </button>
            </div>

            <button
              onClick={() => handleFinishSetup(false)}
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50 mb-2"
              style={{ backgroundColor: SECONDARY }}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Finish Setup'}
            </button>
            <button
              onClick={() => handleFinishSetup(true)}
              className="w-full py-2 text-zinc-500 text-sm hover:text-zinc-700"
            >
              Skip for now
            </button>
          </motion.div>
        )}

        {/* STEP 3: Celebration */}
        {step === 3 && (
          <motion.div
            key="step3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`w-full max-w-lg p-12 text-center ${glassCard}`}
          >
            <div className="text-6xl mb-6">🎉</div>
            <h1 className="text-2xl font-bold text-zinc-900 mb-2">Welcome home!</h1>
            <p className="text-zinc-600 mb-8">Your campus is ready. Taking you to your dashboard…</p>
            <Loader2 className="w-10 h-10 animate-spin text-[#3b82f6] mx-auto" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress bar: 33% Identity, 66% Team, 100% Complete */}
      <div className="mt-8 w-full max-w-xs mx-auto">
        <div className="flex justify-between text-[10px] font-medium text-zinc-500 mb-1.5">
          <span className={step >= 1 ? 'text-[#3b82f6]' : ''}>Identity</span>
          <span className={step >= 2 ? 'text-[#3b82f6]' : ''}>Team</span>
          <span className={step >= 3 ? 'text-[#3b82f6]' : ''}>Complete</span>
        </div>
        <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: PRIMARY }}
            initial={{ width: '0%' }}
            animate={{ width: `${step === 1 ? 33 : step === 2 ? 66 : 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
    </div>
  )
}

export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center text-zinc-500">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      }
    >
      <SetupContent />
    </Suspense>
  )
}
