'use client'

import TeamApprovalQueue from '@/components/events/TeamApprovalQueue'
import PagePadding from '@/components/PagePadding'

export default function AVEventApprovalsPage() {
  return (
    <PagePadding>
      <div className="min-h-screen space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Event Approvals</h1>
          <p className="text-sm text-slate-500 mt-1">
            Events requesting A/V resources that need your review
          </p>
        </div>
        <TeamApprovalQueue gateType="av" teamLabel="A/V Production" />
      </div>
    </PagePadding>
  )
}
