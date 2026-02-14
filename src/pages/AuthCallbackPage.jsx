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

    navigate(next, { replace: true })
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <p className="text-zinc-400">Signing you in…</p>
    </div>
  )
}
