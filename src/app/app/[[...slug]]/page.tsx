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
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  )
}
