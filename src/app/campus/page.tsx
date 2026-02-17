import { Suspense } from 'react'
import { CampusPageClient } from './CampusPageClient'

export default function CampusMapPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading…</div>}>
      <CampusPageClient />
    </Suspense>
  )
}
