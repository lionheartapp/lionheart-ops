'use client'

import { Suspense } from 'react'
import { motion, MotionConfig } from 'framer-motion'
import dynamic from 'next/dynamic'

const AnalyticsDashboard = dynamic(
  () => import('@/components/maintenance/AnalyticsDashboard'),
  { ssr: false, loading: () => <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-48 bg-slate-100 rounded-xl animate-pulse" />)}</div> }
)
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { useDashboardLayoutProps } from '@/lib/hooks/useDashboardLayoutProps'
import PagePadding from '@/components/PagePadding'

function AnalyticsContent() {
  const { isReady, orgId } = useDashboardLayoutProps()

  if (!isReady || !orgId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
      </div>
    )
  }

  return (
    <PagePadding>
    <MotionConfig reducedMotion="user">
        <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer(0.08, 0.05)}
          >
            <motion.div variants={fadeInUp} className="mb-6">
              <h1 className="text-2xl font-semibold text-slate-900">Maintenance Analytics</h1>
              <p className="text-sm text-slate-500">
                Operational metrics — ticket volume, resolution time, technician workload, and more
              </p>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <AnalyticsDashboard />
            </motion.div>
        </motion.div>
    </MotionConfig>
    </PagePadding>
  )
}

export default function MaintenanceAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-primary-500 animate-spin" />
        </div>
      }
    >
      <AnalyticsContent />
    </Suspense>
  )
}
