'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AppPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard')
  }, [router])
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-zinc-500">Redirecting…</p>
    </div>
  )
}
