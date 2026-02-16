import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { PLATFORM_URL } from '../services/platformApi'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

const CHECK_DEBOUNCE_MS = 400
const GOOGLE_SIGNUP_URL = `${PLATFORM_URL}/api/auth/google?from=lionheart&intent=signup`

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
        <Link to="/" className="flex flex-col items-center gap-3 mb-8">
          <img src="/lionheart-logo.svg" alt="Lionheart" className="h-10 w-auto" />
          <span className="text-sm text-zinc-600 hover:text-primary-600">← Back to home</span>
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Create your school</h1>
        <p className="text-zinc-600 text-sm mb-6">
          Get started in minutes. Use Google or enter your details below.
        </p>

        <a
          href={GOOGLE_SIGNUP_URL}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border-2 border-zinc-200 text-zinc-900 font-semibold hover:bg-zinc-50 hover:border-zinc-300 transition-colors mb-4"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign up with Google
        </a>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200" /></div>
          <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-zinc-500">or</span></div>
        </div>

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
              type="text"
              value={schoolWebsite}
              onChange={(e) => setSchoolWebsite(e.target.value)}
              placeholder="e.g. linfield.com, www.linfield.com, or https://linfield.com"
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
