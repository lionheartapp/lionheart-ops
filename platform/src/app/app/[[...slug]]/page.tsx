'use client'

import { Suspense } from 'react'
import { ThemeProvider } from '@/lionheart/context/ThemeContext'
import { OrgModulesProvider } from '@/lionheart/context/OrgModulesContext'
import DashboardApp from '@/lionheart/App'
import GlobalErrorBoundary from '@/lionheart/components/GlobalErrorBoundary'

function DashboardContent() {
  return (
    <ThemeProvider>
      <GlobalErrorBoundary>
        <OrgModulesProvider>
          <DashboardApp />
        </OrgModulesProvider>
      </GlobalErrorBoundary>
    </ThemeProvider>
  )
}

export default function AppDashboardSlugPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
          <p className="text-zinc-500">Loading…</p>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  )
}
