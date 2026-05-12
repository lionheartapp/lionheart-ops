'use client'

import { useState } from 'react'
import { motion, MotionConfig, AnimatePresence } from 'framer-motion'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { useActiveSchool } from '@/lib/hooks/useActiveSchool'
import PagePadding from '@/components/PagePadding'
import { fadeInUp, staggerContainer } from '@/lib/animations'

import ReviewQueueTable from '@/components/submission-review/ReviewQueueTable'
import SubmissionDetailDrawer from '@/components/submission-review/SubmissionDetailDrawer'
import PolicyConfigPanel from '@/components/submission-review/PolicyConfigPanel'
import AssignmentListPanel from '@/components/submission-review/AssignmentListPanel'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useAnimatedTabIndicator } from '@/lib/hooks/useAnimatedTabIndicator'
import TabIndicator from '@/components/ui/TabIndicator'
import {
  ClipboardCheck,
  FileSearch,
  Shield,
  BookOpen,
} from 'lucide-react'

type SRTab = 'queue' | 'assignments' | 'policies'

const TABS: { key: SRTab; label: string; icon: typeof ClipboardCheck }[] = [
  { key: 'queue', label: 'Review Queue', icon: FileSearch },
  { key: 'assignments', label: 'Assignments', icon: BookOpen },
  { key: 'policies', label: 'AI Policies', icon: Shield },
]

export default function SubmissionReviewPage() {
  const [activeTab, setActiveTab] = useState<SRTab>('queue')
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null)
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null)

  const { permissions, loading: permLoading } = usePermissions()
  const { activeSchoolId } = useActiveSchool()
  const { indicatorStyle, tabRefs } = useAnimatedTabIndicator(activeTab, TABS.map(t => t.key))

  usePageTitle('Submission Review')

  const canManagePolicy = permissions.includes('submissions:policy:manage') || permissions.includes('*:*')
  const canReview = permissions.includes('submissions:review:read') || permissions.includes('*:*')

  if (permLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-64 bg-slate-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <PagePadding>
    <>
      <MotionConfig transition={{ ease: [0.25, 0.1, 0.25, 1], duration: 0.3 }}>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="p-6 max-w-[1400px] mx-auto"
        >
          {/* Header */}
          <motion.div variants={fadeInUp} className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-900">
              Submission Review
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Review student submissions, manage assignments, and configure AI policies
            </p>
          </motion.div>

          {/* Tab Bar */}
          <motion.div variants={fadeInUp} className="mb-6">
            <div className="relative flex gap-1 border-b border-slate-200">
              <TabIndicator style={indicatorStyle} />
              {TABS.map((tab, idx) => {
                // Hide policy tab if user can't manage policies
                if (tab.key === 'policies' && !canManagePolicy) return null
                const Icon = tab.icon
                const isActive = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    ref={(el) => { tabRefs.current[idx] = el }}
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors duration-200 cursor-pointer ${
                      isActive
                        ? 'text-slate-900'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </motion.div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {activeTab === 'queue' && (
              <motion.div
                key="queue"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <ReviewQueueTable
                  onSubmissionClick={setSelectedSubmissionId}
                  filters={{
                    schoolId: activeSchoolId || undefined,
                    assignmentId: selectedAssignmentId || undefined,
                  }}
                />
              </motion.div>
            )}

            {activeTab === 'assignments' && (
              <motion.div
                key="assignments"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <AssignmentListPanel
                  onAssignmentSelect={(id) => {
                    setSelectedAssignmentId(id)
                    setActiveTab('queue')
                  }}
                />
              </motion.div>
            )}

            {activeTab === 'policies' && canManagePolicy && (
              <motion.div
                key="policies"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <PolicyConfigPanel schoolId={activeSchoolId || undefined} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </MotionConfig>

      {/* Submission Detail Drawer */}
      <SubmissionDetailDrawer
        submissionId={selectedSubmissionId}
        onClose={() => setSelectedSubmissionId(null)}
      />
    </>
    </PagePadding>
  )
}
