'use client'

import { ReactNode } from 'react'
import DashboardLayout from '@/components/DashboardLayout'

export default function AppLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>
}
