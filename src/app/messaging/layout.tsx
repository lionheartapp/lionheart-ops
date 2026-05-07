'use client'

import { RealtimeProvider } from '@/components/messaging/RealtimeProvider'
import type { ReactNode } from 'react'

export default function MessagingLayout({ children }: { children: ReactNode }) {
  return <RealtimeProvider>{children}</RealtimeProvider>
}
