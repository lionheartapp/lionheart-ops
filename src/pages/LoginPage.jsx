import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PLATFORM_URL, setAuthToken } from '../services/platformApi'
import { getSubdomain, getAppBaseUrl } from '../utils/subdomain'

const GOOGLE_AUTH_URL = `${PLATFORM_URL}/api/auth/google?from=lionheart&intent=login`

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const subdomain = getSubdomain()
  const [branding, setBranding] = useState(null)
  const [brandingLoading, setBrandingLoading] = useState(!!subdomain)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Fetch school branding when subdomain is present
  useEffect(() => {
    if (!subdomain) {
      setBrandingLoading(false)
      return
    }
    let cancelled = false
    fetch(`${PLATFORM_URL}/api/public/org-branding?subdomain=${encodeURIComponent(subdomain)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.found) setBranding(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBrandingLoading(false)
      })
    return () => { cancelled = true }
  }, [subdomain])

  useEffect(() => {
    const err = searchParams.get('error')
    if (err === 'account_not_found') {
      setError('No account found for this Google email. Sign up first, or sign in with the email and password you used to create your account.')
    } else if (err === 'oauth_failed') setError('Google sign-in failed. Please try again or use email.')
    else if (err === 'access_denied') setError('Sign-in was cancelled.')
    else if (err === 'email_not_verified') setError('Google email could not be verified.')
    else if (err) setError('Something went wrong. Please try again.')
  }, [searchParams])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Please enter email and password.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${PLATFORM_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Login failed')
      }
      setAuthToken(data.token)
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err?.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const primaryColor = branding?.primaryColor || '#1a365d'
  const secondaryColor = branding?.secondaryColor || '#3182ce'
  const heroImage = branding?.loginHeroImageUrl
  const isBranded = branding && !brandingLoading

  const formContent = (
    <div className="w-full max-w-md">
      <a
        href={subdomain ? getAppBaseUrl() + '/' : '/'}
        className={`flex flex-col items-center gap-3 mb-8 ${isBranded ? 'text-white/90' : ''}`}
      >
        {branding?.logoUrl ? (
          <img src={branding.logoUrl} alt={branding.name} className="h-12 w-auto max-w-[200px] object-contain" />
        ) : (
          <img
            src="/lionheart-logo.svg"
            alt="Lionheart"
            className={`h-10 w-auto ${isBranded ? 'brightness-0 invert opacity-90' : ''}`}
          />
        )}
        <span className={`text-sm hover:opacity-80 ${isBranded ? 'text-white/80' : 'text-zinc-600 hover:text-primary-600'}`}>
          ← Back to home
        </span>
      </a>
      <h1 className={`text-2xl font-bold mb-2 ${isBranded ? 'text-white' : 'text-zinc-900'}`}>
        {branding?.name ? `Sign in to ${branding.name}` : 'Sign in'}
      </h1>
      <p className={`text-sm mb-6 ${isBranded ? 'text-white/80' : 'text-zinc-600'}`}>
        Use your school Google Workspace account or standard credentials.
      </p>

      <a
        href={GOOGLE_AUTH_URL}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border-2 text-zinc-900 font-semibold mb-4 bg-white hover:bg-zinc-50 border-zinc-200 hover:border-zinc-300 transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Sign in with Google
      </a>
      <p className={`text-xs text-center mb-4 ${isBranded ? 'text-white/60' : 'text-zinc-500'}`}>
        Recommended for schools using Google Workspace
      </p>

      <div className="relative my-4">
        <div className={`absolute inset-0 flex items-center`}>
          <div className={`w-full border-t ${isBranded ? 'border-white/30' : 'border-zinc-200'}`} />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className={`px-2 ${isBranded ? 'bg-transparent text-white/60' : 'bg-white text-zinc-500'}`}>or sign in with email</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={`block text-sm font-medium mb-1.5 ${isBranded ? 'text-white/90' : 'text-zinc-700'}`}>Email</label>
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
          <label className={`block text-sm font-medium mb-1.5 ${isBranded ? 'text-white/90' : 'text-zinc-700'}`}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-3 rounded-lg bg-white border-2 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            required
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg text-white font-semibold disabled:opacity-60 transition-colors"
          style={{ backgroundColor: primaryColor }}
        >
          {loading ? 'Signing in…' : 'Sign in with email'}
        </button>
      </form>
      <p className={`mt-6 text-sm text-center ${isBranded ? 'text-white/80' : 'text-zinc-600'}`}>
        Don&apos;t have an account?{' '}
        <Link
          to="/signup"
          className="font-medium hover:underline"
          style={{ color: isBranded ? secondaryColor : undefined }}
        >
          Sign up
        </Link>
      </p>
    </div>
  )

  // Branded layout: hero image on left, form on right
  if (isBranded && heroImage) {
    return (
      <main className="min-h-screen flex" aria-label="Sign in">
        <div
          className="hidden lg:flex lg:w-1/2 min-h-screen bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="w-full h-full bg-gradient-to-r from-black/60 to-transparent" />
        </div>
        <div
          className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:py-0 min-h-screen"
          style={{ backgroundColor: primaryColor }}
        >
          {formContent}
        </div>
      </main>
    )
  }

  // Branded but no hero: solid color background
  if (isBranded) {
    return (
      <main
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ backgroundColor: primaryColor }}
        aria-label="Sign in"
      >
        {formContent}
      </main>
    )
  }

  // Default: no subdomain or school not found
  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-6" aria-label="Sign in">
      {brandingLoading ? (
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-zinc-300 border-t-primary-500 rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Loading…</p>
        </div>
      ) : (
        formContent
      )}
    </main>
  )
}
