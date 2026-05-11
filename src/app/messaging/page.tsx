'use client'

import DashboardLayout from '@/components/DashboardLayout'
import MessagingShell from '@/components/messaging/MessagingShell'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function MessagingPage() {
  usePageTitle('Messaging')
  return (
    <DashboardLayout noPadding>
      <MessagingShell />
    </DashboardLayout>
  )
}
