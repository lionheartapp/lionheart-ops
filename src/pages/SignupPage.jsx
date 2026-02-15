import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { PLATFORM_URL } from '../services/platformApi'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

const CHECK_DEBOUNCE_MS = 400

export default function SignupPage() {
  const [schoolName, setSchoolName] = useState('')
  const [schoolWebsite, setSchoolWebsite] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [schoolMatches, setSchoolMatches] = useState([])
  const [dismissedMatches, setDismissedMatches] = useState(false)
  const duplicateSchool = schoolMatches.length > 0 && !dismissedMatches
  const [checkingSchool, setCheckingSchool] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    const q = schoolName.trim()
    if (q.length < 3) {
      setSchoolMatches([])
      setDismissedMatches(false)
      return
    }
    setDismissedMatches(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      debounceRef.current = null
      setCheckingSchool(true)
      try {
        let url = `${PLATFORM_URL}/api/auth/check-school?name=${encodeURIComponent(q)}`
        if (schoolWebsite.trim()) {
          url += `&website=${encodeURIComponent(schoolWebsite.trim())}`
        }
        const res = await fetch(url)
        const data = await res.json()
        const matches = data.matches || []
        setSchoolMatches(matches)
      } catch {
        setSchoolMatches([])
      } finally {
        setCheckingSchool(false)
      }
    }, CHECK_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [schoolName, schoolWebsite])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (duplicateSchool) return
    if (!schoolName.trim() || !name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${PLATFORM_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: schoolName.trim(),
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Signup failed')
      }
      const { orgId, orgName, userName, userEmail } = data
      const params = new URLSearchParams({ orgId })
      if (orgName) params.set('orgName', orgName)
      if (userName) params.set('userName', userName)
      if (userEmail) params.set('userEmail', userEmail)
      let setupUrl = `${PLATFORM_URL}/setup?${params}`
      // Log in immediately so setup can save branding; pass token in hash for setup page
      try {
        const loginRes = await fetch(`${PLATFORM_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        })
        const loginData = await loginRes.json()
        if (loginRes.ok && loginData.token) {
          const { setAuthToken } = await import('../services/platformApi')
          setAuthToken(loginData.token)
          // Pass token in hash so setup page can use it (hash not sent to server)
          setupUrl += '#token=' + encodeURIComponent(loginData.token)
          window.location.href = setupUrl
          return
        }
      } catch {}
      window.location.href = setupUrl
    } catch (err) {
      setError(err?.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-6" aria-label="Create account">
      <div className="w-full max-w-md">
        <Link to="/" className="text-sm text-zinc-600 hover:text-primary-600 mb-8 block">
          ← Back to home
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Create your school</h1>
        <p className="text-zinc-600 text-sm mb-6">
          Get started in minutes. Enter your school name and account details below.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">School name</label>
            <div className="relative">
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="e.g. Lincoln Academy"
                className={`w-full px-4 py-3 rounded-lg bg-white border-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                  schoolName.trim().length >= 3 && !checkingSchool && !duplicateSchool
                    ? 'border-emerald-500 focus:ring-emerald-500 focus:border-emerald-500 pr-11'
                    : duplicateSchool
                      ? 'border-amber-500 focus:ring-amber-500'
                      : 'border-zinc-200'
                }`}
                required
              />
              {schoolName.trim().length >= 3 && !checkingSchool && !duplicateSchool && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" aria-hidden />
                </div>
              )}
            </div>
            {checkingSchool && (
              <p className="mt-1.5 text-xs text-zinc-500">Checking for existing school…</p>
            )}
            {duplicateSchool && !checkingSchool && (
              <div className="mt-2 space-y-2">
                <p className="text-sm font-medium text-amber-800">Is yours one of these?</p>
                <ul className="space-y-1.5">
                  {schoolMatches.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 text-sm bg-white rounded-lg border border-amber-200 px-3 py-2">
                      <span className="text-zinc-800">
                        {m.name}
                        {m.domain && <span className="text-zinc-500 ml-1">({m.domain})</span>}
                      </span>
                      <Link
                        to="/login"
                        className="shrink-0 text-primary-600 hover:underline font-medium"
                      >
                        Sign in
                      </Link>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setDismissedMatches(true)}
                  className="text-sm text-amber-700 hover:text-amber-900 font-medium underline"
                >
                  No, create new school
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              School website <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <input
              type="url"
              value={schoolWebsite}
              onChange={(e) => setSchoolWebsite(e.target.value)}
              placeholder="e.g. linfield.com or https://linfield.com"
              className="w-full px-4 py-3 rounded-lg bg-white border-2 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Your name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="w-full px-4 py-3 rounded-lg bg-white border-2 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.org"
              className="w-full px-4 py-3 rounded-lg bg-white border-2 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-4 py-3 rounded-lg bg-white border-2 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
              minLength={8}
            />
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || duplicateSchool}
            className="w-full py-3 rounded-lg bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Get started with email'}
          </button>
        </form>
        <p className="mt-6 text-sm text-zinc-600 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
