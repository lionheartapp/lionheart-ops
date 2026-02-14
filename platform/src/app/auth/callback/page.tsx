'use client'

import { Suspense, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

const AUTH_KEY = 'platform-auth-token'

function AuthCallbackContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const token = searchParams.get('token')
    const next = searchParams.get('next') || '/campus'

    if (token && typeof window !== 'undefined') {
      localStorage.setItem(AUTH_KEY, token)
    }

    router.replace(next)
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <p className="text-zinc-400">Signing you in…</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950 flex items-center justify-center"><p className="text-zinc-400">Loading…</p></div>}>
      <AuthCallbackContent />
    </Suspense>
  )
}
