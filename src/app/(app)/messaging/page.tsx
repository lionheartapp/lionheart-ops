'use client'

import MessagingShell from '@/components/messaging/MessagingShell'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function MessagingPage() {
  usePageTitle('Messaging')
  return (
    <MessagingShell />
  )
}
