'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Legacy redirect.
 *
 * The standalone /it/erate page has been retired. The complete E-Rate
 * experience (BEN onboarding, USAC sync, funding-year cards, compliance
 * calendar, document archive, retention notice) now lives in a single tab
 * inside Reports & Admin. Anyone landing here is bounced straight to that
 * tab so old bookmarks, dashboard widget links, and email links continue
 * to work without a 404.
 *
 * F-004: previously returned `null` during the redirect, which Next.js
 * rendered as a fully blank page (no app shell, no skeleton). Now we render
 * a minimal "Redirecting..." panel inside a flex container so the user has
 * SOMETHING on screen during the navigation tick. The redirect is still
 * effectively instant.
 */
export default function ERateRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/it/admin?tab=erate')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 mx-auto rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
        <p className="text-sm text-slate-500">Redirecting to E-Rate…</p>
      </div>
    </div>
  )
}
