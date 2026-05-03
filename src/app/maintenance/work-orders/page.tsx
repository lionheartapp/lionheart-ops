'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, MotionConfig } from 'framer-motion'
import { useCampusFilter } from '@/lib/hooks/useCampusFilter'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import DashboardLayout from '@/components/DashboardLayout'
import CampusFilterChip from '@/components/maintenance/CampusFilterChip'
import WorkOrdersView from '@/components/maintenance/WorkOrdersView'
import { useDashboardLayoutProps } from '@/lib/hooks/useDashboardLayoutProps'
import { usePageTitle } from '@/hooks/usePageTitle'

function WorkOrdersContent() {
  const searchParams = useSearchParams()
  const { layoutProps, isReady, orgId } = useDashboardLayoutProps()
  const campusFilter = useCampusFilter()

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
        <div>
            {/* Page header */}
            <motion.div
              className="mb-6"
              initial="hidden"
              animate="visible"
              variants={staggerContainer(0.08, 0.05)}
            >
              <motion.div variants={fadeInUp} className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-semibold text-slate-900">
                  Work Orders
                </h1>
                <CampusFilterChip campusFilter={campusFilter} />
              </motion.div>
              <motion.p variants={fadeInUp} className="text-sm text-slate-500 mt-1">
                {campusFilter.selectedCampusName === 'All Campuses'
                  ? 'Manage and track maintenance work orders'
                  : campusFilter.selectedCampusName}
              </motion.p>
            </motion.div>

            {/* Work Orders content */}
            <WorkOrdersView
              schoolIdFilter={campusFilter.selectedCampusId}
              initialStatus={searchParams.get('status') || undefined}
              initialPriority={searchParams.get('priority') || undefined}
              initialUnassigned={searchParams.get('unassigned') === 'true'}
              initialSchoolId={searchParams.get('schoolId') || undefined}
              initialCategory={searchParams.get('category') || undefined}
              initialSearch={searchParams.get('q') || undefined}
            />
        </div>
      </MotionConfig>
    </DashboardLayout>
  )
}

export default function WorkOrdersPage() {
  usePageTitle('Work Orders')
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    }>
      <WorkOrdersContent />
    </Suspense>
  )
}
