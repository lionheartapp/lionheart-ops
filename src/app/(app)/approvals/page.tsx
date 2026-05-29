'use client'

import { usePageTitle } from '@/hooks/usePageTitle'
import PagePadding from '@/components/PagePadding'
import TeamApprovalQueue from '@/components/events/TeamApprovalQueue'

export default function ApprovalsPage() {
  usePageTitle('Approvals')

  return (
    <PagePadding>
      <div className="min-h-screen space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Approvals</h1>
          <p className="text-sm text-slate-500 mt-1">Events requesting resources that need your review</p>
        </div>
        <TeamApprovalQueue gateType="facilities" teamLabel="Facilities" />
        <TeamApprovalQueue gateType="av" teamLabel="A/V Production" />
      </div>
    </PagePadding>
  )
}
