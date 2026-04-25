'use client'

import DashboardLayout from '@/components/DashboardLayout'
import ApprovalRulesBuilder from '@/components/settings/ApprovalRulesBuilder'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function ApprovalRulesPage() {
  usePageTitle('Approval Rules')

  return (
    <DashboardLayout>
      <ApprovalRulesBuilder />
    </DashboardLayout>
  )
}
