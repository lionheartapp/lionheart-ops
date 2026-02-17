'use client'

import { Suspense } from 'react'
import { ThemeProvider } from '@/context/ThemeContext'
import { OrgModulesProvider } from '@/context/OrgModulesContext'
import { SubdomainResolver } from '@/components/SubdomainResolver'
import DashboardApp from '@/App'
import GlobalErrorBoundary from '@/components/GlobalErrorBoundary'

function DashboardContent() {
  return (
    <SubdomainResolver>
      <ThemeProvider>
        <GlobalErrorBoundary>
          <OrgModulesProvider>
            <DashboardApp />
          </OrgModulesProvider>
        </GlobalErrorBoundary>
      </ThemeProvider>
    </SubdomainResolver>
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
