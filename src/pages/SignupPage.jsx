import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { PLATFORM_URL } from '../services/platformApi'
import { AlertCircle } from 'lucide-react'

const CHECK_DEBOUNCE_MS = 400

export default function SignupPage() {
  const [schoolName, setSchoolName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [duplicateSchool, setDuplicateSchool] = useState(false)
  const [checkingSchool, setCheckingSchool] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    const q = schoolName.trim()
    if (q.length < 3) {
      setDuplicateSchool(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      debounceRef.current = null
      setCheckingSchool(true)
      try {
        const res = await fetch(
          `${PLATFORM_URL}/api/auth/check-school?name=${encodeURIComponent(q)}`
        )
        const data = await res.json()
        setDuplicateSchool(data.exists === true)
      } catch {
        setDuplicateSchool(false)
      } finally {
        setCheckingSchool(false)
      }
    }, CHECK_DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [schoolName])

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
      const { orgId, orgName, userName } = data
      const params = new URLSearchParams({ orgId })
      if (orgName) params.set('orgName', orgName)
      if (userName) params.set('userName', userName)
      const setupUrl = `${PLATFORM_URL}/setup?${params}`
      // Optional: log in immediately by calling login API and storing token
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
            <input
              type="text"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="e.g. Lincoln Academy"
              className={`w-full px-4 py-3 rounded-lg bg-white border-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                duplicateSchool ? 'border-amber-500 focus:ring-amber-500' : 'border-zinc-200'
              }`}
              required
            />
            {checkingSchool && (
              <p className="mt-1.5 text-xs text-zinc-500">Checking for existing school…</p>
            )}
            {duplicateSchool && !checkingSchool && (
              <div className="mt-1.5 flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>This school already has an account. <Link to="/login" className="font-medium underline hover:no-underline">Sign in</Link> or contact your administrator.</p>
              </div>
            )}
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
