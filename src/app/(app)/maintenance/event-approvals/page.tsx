'use client'

import TeamApprovalQueue from '@/components/events/TeamApprovalQueue'
import PagePadding from '@/components/PagePadding'
import { usePermissions, isOnTeam } from '@/lib/hooks/usePermissions'

export default function FacilitiesEventApprovalsPage() {
  const { data: perms, isLoading } = usePermissions()
  const canReviewFacilities =
    perms?.isSuperAdmin ||
    perms?.canManageWorkspace ||
    perms?.canManageMaintenance ||
    perms?.canClaimMaintenance ||
    isOnTeam(perms, 'maintenance')

  return (
    <PagePadding>
      <div className="min-h-screen space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Event Approvals</h1>
          <p className="text-sm text-slate-500 mt-1">
            Events requesting Facilities resources that need your review
          </p>
        </div>
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-36 rounded-2xl bg-slate-100" />
            <div className="h-36 rounded-2xl bg-slate-100" />
          </div>
        ) : canReviewFacilities ? (
          <TeamApprovalQueue gateType="facilities" teamLabel="Facilities" />
        ) : (
          <div className="ui-glass p-6 text-center">
            <h2 className="text-sm font-semibold text-slate-900">You do not have access to facilities approvals.</h2>
            <p className="mt-1 text-sm text-slate-500">Ask an administrator if this is part of your job.</p>
          </div>
        )}
      </div>
    </PagePadding>
  )
}
