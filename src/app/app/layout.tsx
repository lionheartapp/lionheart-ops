import type { Metadata } from 'next'
import '@/index.css'

export const metadata: Metadata = {
  title: 'Dashboard | Lionheart Operations',
  description: 'Operations & event management',
}

export default function AppDashboardLayout({
  children,
}: { children: React.ReactNode }) {
  return <>{children}</>
}
