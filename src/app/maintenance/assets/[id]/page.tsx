'use client'

import { Suspense, useEffect, useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import AssetDetailPage from '@/components/maintenance/AssetDetailPage'
import { useDashboardLayoutProps } from '@/lib/hooks/useDashboardLayoutProps'

function AssetDetailContent({ assetId }: { assetId: string }) {
  const { layoutProps, isReady, orgId } = useDashboardLayoutProps()

  if (!isReady || !orgId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    )
  }

  return (
    <DashboardLayout {...layoutProps}>
      <AssetDetailPage assetId={assetId} />
    </DashboardLayout>
  )
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function AssetDetailRoute({ params }: PageProps) {
  const [assetId, setAssetId] = useState<string | null>(null)

  useEffect(() => {
    params.then(({ id }) => setAssetId(id))
  }, [params])

  if (!assetId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    )
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    }>
      <AssetDetailContent assetId={assetId} />
    </Suspense>
  )
}
