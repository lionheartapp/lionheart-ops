'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, Search, MapPin, Users, FileSpreadsheet, Globe, Upload } from 'lucide-react'
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
  const orgId = searchParams.get('orgId')
  const orgNameFromUrl = searchParams.get('orgName')

  if (!orgId) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="text-center text-zinc-400">
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
      orgNameFromUrl={orgNameFromUrl}
      searchParams={searchParams}
    />
  )
}

function SetupWizard({
  orgId,
  orgNameFromUrl,
  searchParams,
}: {
  orgId: string
  orgNameFromUrl: string | null
  searchParams: URLSearchParams
}) {
  const [step, setStep] = useState(orgNameFromUrl ? 2 : 1)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [schoolData, setSchoolData] = useState({
    name: orgNameFromUrl || '',
    address: '',
    website: '',
    logoUrl: '',
  })

  useEffect(() => {
    if (orgNameFromUrl) setSchoolData((p) => ({ ...p, name: orgNameFromUrl }))
  }, [orgNameFromUrl])
  const [invites, setInvites] = useState(['', '', ''])
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

  const saveSchoolAndCreateFacilities = useCallback(async (data: { name: string; address: string; website?: string; logoUrl?: string }) => {
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
        colors: { primary: PRIMARY, secondary: SECONDARY },
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
        })
      } else {
        setManualMode(true)
      }
    } finally {
      setLoading(false)
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

  const handleFinishSetup = async (skipInvites = false) => {
    setLoading(true)
    fireConfetti()
    setStep(3)
    if (token && !skipInvites) {
      const hasCsv = csvMembers.length > 0
      const manualEmails = invites.filter((e) => e.trim().includes('@'))
      try {
        if (hasCsv) {
          await fetch('/api/setup/invite-members', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ orgId, members: csvMembers }),
          })
        } else if (manualEmails.length > 0) {
          await fetch('/api/setup/invite-members', {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ orgId, emails: manualEmails }),
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
    if (searchParams.get('userName')) params.set('userName', searchParams.get('userName')!)
    if (searchParams.get('userEmail')) params.set('userEmail', searchParams.get('userEmail')!)
    if (schoolData.name) params.set('orgName', schoolData.name)
    const qs = params.toString()
    setTimeout(() => {
      window.location.href = `${LIONHEART_URL}/app${qs ? '?' + qs : ''}`
    }, 2000)
  }

  const glassCard = 'rounded-2xl border border-white/10 bg-zinc-900/80 backdrop-blur-xl shadow-2xl'

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%), radial-gradient(ellipse at top, rgba(59, 130, 246, 0.08) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(245, 158, 11, 0.06) 0%, transparent 50%)',
      }}
    >
      <div className="absolute top-6 left-6 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: PRIMARY }}>
          L
        </div>
        <span className="font-bold text-xl text-white tracking-tight">Lionheart</span>
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
              <h1 className="text-2xl font-bold text-white">Find your school</h1>
              <p className="text-zinc-400 text-sm mt-2">
                We&apos;ll auto-fill your logo, address, and campus map.
              </p>
            </div>

            {!searchResult && !manualMode && (
              <form onSubmit={handleSearch} className="relative">
                <input
                  type="text"
                  placeholder="e.g. Linfield Christian School"
                  className="w-full rounded-xl pl-4 pr-24 py-3.5 text-white placeholder-zinc-500 bg-zinc-900/80 border border-zinc-700 focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6] outline-none transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading || !searchQuery.trim()}
                  className="absolute right-2 top-2 bottom-2 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  style={{ backgroundColor: `${PRIMARY}40`, color: 'white' }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                </button>
              </form>
            )}

            {searchResult && !manualMode && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900/60"
              >
                <div className="h-0.5 bg-gradient-to-r from-[#3b82f6] to-[#f59e0b]" />
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-white rounded-lg p-2 shrink-0">
                      {searchResult.logo ? (
                        <img src={searchResult.logo} alt="" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                      ) : (
                        <div className="w-full h-full rounded bg-zinc-200 flex items-center justify-center text-zinc-500 text-xs">Logo</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-white">{searchResult.name}</h3>
                      {searchResult.address && (
                        <div className="flex items-center gap-1.5 text-sm text-zinc-400 mt-1">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          {searchResult.address}
                        </div>
                      )}
                      {searchResult.domain && (
                        <div className="flex items-center gap-1.5 text-sm text-zinc-400 mt-0.5">
                          <Globe className="w-3.5 h-3.5 shrink-0" />
                          {searchResult.domain}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={confirmSchool}
                      disabled={loading}
                      className="flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-white"
                      style={{ backgroundColor: PRIMARY }}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Yes, this is us <Check className="w-4 h-4" /></>}
                    </button>
                    <button
                      onClick={() => { setSearchResult(null); setManualMode(true) }}
                      className="px-4 py-2.5 rounded-lg border border-zinc-600 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
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
                  <label className="block text-xs font-medium text-zinc-500 mb-1">School Name</label>
                  <input
                    className="w-full rounded-lg px-3 py-2 text-white bg-zinc-900/80 border border-zinc-700 focus:ring-2 focus:ring-[#3b82f6]/50 outline-none"
                    value={schoolData.name}
                    onChange={(e) => setSchoolData((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Address</label>
                  <input
                    className="w-full rounded-lg px-3 py-2 text-white bg-zinc-900/80 border border-zinc-700 focus:ring-2 focus:ring-[#3b82f6]/50 outline-none"
                    value={schoolData.address}
                    onChange={(e) => setSchoolData((p) => ({ ...p, address: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Website</label>
                  <input
                    type="url"
                    className="w-full rounded-lg px-3 py-2 text-white bg-zinc-900/80 border border-zinc-700 focus:ring-2 focus:ring-[#3b82f6]/50 outline-none"
                    placeholder="https://..."
                    value={schoolData.website}
                    onChange={(e) => setSchoolData((p) => ({ ...p, website: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">Logo (optional)</label>
                  <div className="flex items-center gap-3">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                      className="w-14 h-14 rounded-lg border-2 border-dashed border-zinc-600 flex items-center justify-center overflow-hidden cursor-pointer hover:border-[#3b82f6]/50 transition-colors"
                    >
                      <input ref={fileInputRef} type="file" accept=".svg,.png,.jpg,.jpeg,image/*" onChange={handleFileUpload} className="hidden" />
                      {schoolData.logoUrl ? (
                        <img src={schoolData.logoUrl} alt="" className="w-full h-full object-contain p-1" />
                      ) : (
                        <Upload className="w-5 h-5 text-zinc-500" />
                      )}
                    </div>
                    <span className="text-xs text-zinc-500">PNG / SVG</span>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setManualMode(false)}
                    className="px-4 py-2 text-zinc-400 hover:text-white"
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
                  className="text-xs text-zinc-500 hover:text-zinc-400"
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
              <h1 className="text-2xl font-bold text-white">Invite your team</h1>
              <p className="text-zinc-400 text-sm mt-1">Operations work better together.</p>
            </div>

            <div className="mb-6">
              <input ref={csvInputRef} type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
              <button
                type="button"
                onClick={() => csvInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-600 text-zinc-300 hover:bg-zinc-800/50 transition-colors text-sm"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {csvMembers.length > 0 ? `${csvMembers.length} from CSV` : 'Upload CSV'}
              </button>
            </div>

            <p className="text-xs text-zinc-500 mb-3">Or enter emails:</p>
            <div className="space-y-3 mb-6">
              {invites.map((email, idx) => (
                <div key={idx} className="relative">
                  <input
                    type="email"
                    placeholder="colleague@school.edu"
                    className="w-full rounded-xl px-4 py-3 text-white placeholder-zinc-500 bg-zinc-900/80 border border-zinc-700 focus:ring-2 focus:ring-[#3b82f6]/50 outline-none"
                    value={email}
                    onChange={(e) => {
                      const n = [...invites]
                      n[idx] = e.target.value
                      setInvites(n)
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
              className="w-full py-3.5 rounded-xl font-bold text-zinc-900 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 mb-2"
              style={{ backgroundColor: SECONDARY }}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Finish Setup'}
            </button>
            <button
              onClick={() => handleFinishSetup(true)}
              className="w-full py-2 text-zinc-500 text-sm hover:text-zinc-300"
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
            <h1 className="text-2xl font-bold text-white mb-2">Welcome home!</h1>
            <p className="text-zinc-400 mb-8">Your campus is ready. Taking you to your dashboard…</p>
            <Loader2 className="w-10 h-10 animate-spin text-[#3b82f6] mx-auto" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stepper */}
      <div className="mt-8 flex items-center gap-2">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${step >= n ? '' : 'bg-zinc-700'}`}
            style={step >= n ? { backgroundColor: PRIMARY } : {}}
          />
        ))}
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
