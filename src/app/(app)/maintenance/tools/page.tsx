'use client'

import { motion } from 'framer-motion'
import PagePadding from '@/components/PagePadding'
import MaintenanceToolsWorkspace from '@/components/maintenance/tools/MaintenanceToolsWorkspace'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function MaintenanceToolsPage() {
  usePageTitle('Maintenance Tools')

  return (
    <PagePadding>
      <motion.div
        variants={staggerContainer(0.08, 0.02)}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        <motion.div variants={fadeInUp}>
          <MaintenanceToolsWorkspace />
        </motion.div>
      </motion.div>
    </PagePadding>
  )
}
