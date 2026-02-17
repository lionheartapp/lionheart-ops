import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { setAuthToken } from '../services/platformApi'

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const token = searchParams.get('token')
    const next = searchParams.get('next') || '/app'

    if (token) {
      setAuthToken(token)
    }

    // Handle external redirects (e.g. Platform Setup when new user created school via Google)
    if (next.startsWith('http://') || next.startsWith('https://')) {
      window.location.href = next
      return
    }
    navigate(next, { replace: true })
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
      <div className="w-8 h-8 border-2 border-zinc-700 border-t-emerald-500 rounded-full animate-spin mb-4" />
      <p className="text-zinc-400 text-sm">Signing you in…</p>
    </div>
  )
}
