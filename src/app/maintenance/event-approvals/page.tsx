'use client'

import DashboardLayout from '@/components/DashboardLayout'
import TeamApprovalQueue from '@/components/events/TeamApprovalQueue'

export default function FacilitiesEventApprovalsPage() {
  return (
    <DashboardLayout>
      <div className="min-h-screen space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Event Approvals</h1>
          <p className="text-sm text-gray-500 mt-1">
            Events requesting Facilities resources that need your review
          </p>
        </div>
        <TeamApprovalQueue gateType="facilities" teamLabel="Facilities" />
      </div>
    </DashboardLayout>
  )
}
