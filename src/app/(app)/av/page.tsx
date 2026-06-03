'use client'

import PagePadding from '@/components/PagePadding'
import AVCommandCenter from '@/components/av/AVCommandCenter'
import { isOnTeam, usePermissions } from '@/lib/hooks/usePermissions'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Radio } from 'lucide-react'

export default function AVPage() {
  usePageTitle('A/V RF Command Center')
  const { data: perms, isLoading } = usePermissions()
  const canUseAV =
    perms?.isSuperAdmin ||
    perms?.canReadAV ||
    perms?.canManageWorkspace ||
    isOnTeam(perms, 'av-production')

  return (
    <PagePadding>
      <div className="min-h-screen space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500">
              <Radio className="h-3.5 w-3.5 text-primary-500" />
              Advisor Mode
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">A/V RF Command Center</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Plan wireless channels, import scans, catch intermod risk, and build day-of tech packets.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-24 rounded-xl bg-slate-100" />
            <div className="h-96 rounded-xl bg-slate-100" />
          </div>
        ) : canUseAV ? (
          <AVCommandCenter />
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <h2 className="text-sm font-semibold text-slate-900">A/V access required</h2>
            <p className="mt-1 text-sm text-slate-500">Ask an administrator to add you to the A/V Production team.</p>
          </div>
        )}
      </div>
    </PagePadding>
  )
}

