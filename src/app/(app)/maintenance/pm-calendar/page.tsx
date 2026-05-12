'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Redirect to the Maintenance Hub's PM Calendar tab.
 * The standalone PM Calendar page was consolidated into the hub.
 */
export default function PmCalendarRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/maintenance?tab=pm-calendar')
  }, [router])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
    </div>
  )
}
