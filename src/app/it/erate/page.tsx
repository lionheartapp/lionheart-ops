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
 */
export default function ERateRedirectPage(): null {
  const router = useRouter()

  useEffect(() => {
    router.replace('/it/admin?tab=erate')
  }, [router])

  return null
}
