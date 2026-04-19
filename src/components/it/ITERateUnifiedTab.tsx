'use client'

/**
 * ITERateUnifiedTab — the single source of truth for the E-Rate experience.
 *
 * Renders everything a compliance-minded user needs in one place:
 *
 *   1. USAC Data            — BEN connection, sync status, funding-year cards
 *                             (from ERateOnboardingPanel)
 *   2. Compliance Calendar  — procedural task list, Form 470/471/486/BEAR
 *                             deadlines, Seed Calendar, Generate Doc Package
 *                             (from ITERateTab)
 *   3. Document Archive     — retained audit documents (from ITERateTab)
 *   4. Retention footer     — FCC §54.516 reminder
 *
 * This component replaces the older "two E-Rate pages" pattern (standalone
 * /it/erate + separate admin tab). Anywhere an E-Rate entry point is needed
 * (dashboard widget, admin tab, redirect from the old /it/erate route) lands
 * the user here.
 */

import { motion } from 'framer-motion'
import { Database } from 'lucide-react'
import { fadeInUp, staggerContainer } from '@/lib/animations'
import ERateOnboardingPanel, { RetentionFooter } from './ERateOnboardingPanel'
import ITERateTab from './ITERateTab'

interface ITERateUnifiedTabProps {
  canManage: boolean
}

export default function ITERateUnifiedTab({ canManage }: ITERateUnifiedTabProps): JSX.Element {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer(0.06, 0.04)}
      className="space-y-10"
    >
      {/* ── USAC Data section ──────────────────────────────────────────── */}
      <motion.section variants={fadeInUp}>
        <SectionHeading
          icon={<Database className="h-4 w-4" />}
          title="USAC Data"
          subtitle="Billed Entity connection, sync status, and funding-year totals mirrored from USAC Open Data."
        />
        <ERateOnboardingPanel showHeader={false} showFooter={false} />
      </motion.section>

      {/* ── Compliance calendar + document archive ─────────────────────── */}
      <motion.section variants={fadeInUp}>
        <ITERateTab canManage={canManage} />
      </motion.section>

      {/* ── Retention footer ───────────────────────────────────────────── */}
      <motion.section variants={fadeInUp}>
        <RetentionFooter />
      </motion.section>
    </motion.div>
  )
}

interface SectionHeadingProps {
  icon: React.ReactNode
  title: string
  subtitle: string
}

function SectionHeading({ icon, title, subtitle }: SectionHeadingProps): JSX.Element {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <span className="text-slate-500">{icon}</span>
        {title}
      </div>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  )
}
