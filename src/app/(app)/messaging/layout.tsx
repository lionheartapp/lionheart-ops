'use client'

import type { ReactNode } from 'react'

// RealtimeProvider disabled for local dev — Supabase Realtime needs
// proper JWT auth config. Re-enable when deploying to production:
// import { RealtimeProvider } from '@/components/messaging/RealtimeProvider'
// return <RealtimeProvider>{children}</RealtimeProvider>

export default function MessagingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
