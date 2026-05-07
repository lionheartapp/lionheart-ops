'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Redirect to dashboard with the tasks drawer open.
 * Keeps old bookmarks and links working.
 */
export default function MyTasksRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard?openTasks=true')
  }, [router])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
    </div>
  )
}
