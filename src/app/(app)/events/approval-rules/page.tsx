'use client'

import dynamic from 'next/dynamic'

const ApprovalRulesBuilder = dynamic(() => import('@/components/settings/ApprovalRulesBuilder'), { ssr: false })
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
