'use client'

import ApprovalRulesBuilder from '@/components/settings/ApprovalRulesBuilder'
import PagePadding from '@/components/PagePadding'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function ApprovalRulesPage() {
  usePageTitle('Approval Rules')

  return (
    <PagePadding>
      <ApprovalRulesBuilder />
    </PagePadding>
  )
}
