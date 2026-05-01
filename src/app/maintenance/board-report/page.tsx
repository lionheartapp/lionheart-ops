'use client'

import { Suspense } from 'react'
import { MotionConfig } from 'framer-motion'
import DashboardLayout from '@/components/DashboardLayout'
import { BoardReportPage } from '@/components/maintenance/board-report/BoardReportPage'
import { useDashboardLayoutProps } from '@/lib/hooks/useDashboardLayoutProps'

function BoardReportContent() {
  const { layoutProps, isReady, orgId } = useDashboardLayoutProps()

  if (!isReady || !orgId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    )
  }

  return (
    <DashboardLayout {...layoutProps}>
      <MotionConfig reducedMotion="user">
        <BoardReportPage />
      </MotionConfig>
    </DashboardLayout>
  )
}

export default function BoardReportPageRoute() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    }>
      <BoardReportContent />
    </Suspense>
  )
}
