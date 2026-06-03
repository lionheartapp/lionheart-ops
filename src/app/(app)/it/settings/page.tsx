'use client'

import { Suspense } from 'react'
import PagePadding from '@/components/PagePadding'
import ITPageShell from '@/components/it/ITPageShell'
import ITSettingsContent from '@/components/it/ITSettingsContent'

export default function ITSettingsPage() {
  return (
    <PagePadding>
      <ITPageShell>
        <Suspense fallback={null}>
          <ITSettingsContent />
        </Suspense>
      </ITPageShell>
    </PagePadding>
  )
}
