'use client'

import TeamApprovalQueue from '@/components/events/TeamApprovalQueue'
import PagePadding from '@/components/PagePadding'
import { usePermissions, isOnTeam } from '@/lib/hooks/usePermissions'

export default function AVEventApprovalsPage() {
  const { data: perms, isLoading } = usePermissions()
  const canReviewAV =
    perms?.isSuperAdmin ||
    perms?.canManageWorkspace ||
    isOnTeam(perms, 'av-production')

  return (
    <PagePadding>
      <div className="min-h-screen space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Event Approvals</h1>
          <p className="text-sm text-slate-500 mt-1">
            Events requesting A/V resources that need your review
          </p>
        </div>
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-36 rounded-2xl bg-slate-100" />
            <div className="h-36 rounded-2xl bg-slate-100" />
          </div>
        ) : canReviewAV ? (
          <TeamApprovalQueue gateType="av" teamLabel="A/V Production" />
        ) : (
          <div className="ui-glass p-6 text-center">
            <h2 className="text-sm font-semibold text-slate-900">You do not have access to A/V approvals.</h2>
            <p className="mt-1 text-sm text-slate-500">Ask an administrator if this is part of your job.</p>
          </div>
        )}
      </div>
    </PagePadding>
  )
}
