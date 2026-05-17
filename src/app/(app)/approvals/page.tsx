'use client'

import { usePageTitle } from '@/hooks/usePageTitle'
import TeamApprovalQueue from '@/components/events/TeamApprovalQueue'

export default function ApprovalsPage() {
  usePageTitle('Approvals')

  return (
    <div className="space-y-6 pb-4">
      <TeamApprovalQueue />
    </div>
  )
}
