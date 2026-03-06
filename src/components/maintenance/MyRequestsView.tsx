'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wrench, ArrowLeft } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { staggerContainer, fadeInUp, tabContent } from '@/lib/animations'
import SubmitRequestWizard from './SubmitRequestWizard'
import MyRequestsGrid from './MyRequestsGrid'

export default function MyRequestsView() {
  const [showWizard, setShowWizard] = useState(false)
  const queryClient = useQueryClient()

  const handleComplete = () => {
    // Invalidate cache so grid refreshes
    queryClient.invalidateQueries({ queryKey: ['maintenance-my-tickets'] })
    setShowWizard(false)
  }

  const handleCancel = () => {
    setShowWizard(false)
  }

  return (
    <motion.div
      className="space-y-6"
      initial="hidden"
      animate="visible"
      variants={staggerContainer(0.08, 0.05)}
    >
      {/* Header row */}
      <motion.div variants={fadeInUp} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showWizard && (
            <button
              type="button"
              onClick={handleCancel}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              title="Back to My Requests"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {showWizard ? 'New Maintenance Request' : 'My Maintenance Requests'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {showWizard
                ? 'Complete all steps to submit your request'
                : 'Track and manage your submitted requests'}
            </p>
          </div>
        </div>

        {!showWizard && (
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 active:scale-[0.97] transition-all cursor-pointer shadow-sm shadow-emerald-200"
          >
            <Wrench className="w-4 h-4" />
            Submit Request
          </button>
        )}
      </motion.div>

      {/* Content — wizard or grid */}
      <AnimatePresence mode="wait">
        {showWizard ? (
          <motion.div
            key="wizard"
            variants={tabContent}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="ui-glass-overlay rounded-2xl p-6 min-h-[520px]"
          >
            <SubmitRequestWizard
              onComplete={handleComplete}
              onCancel={handleCancel}
            />
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            variants={tabContent}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <MyRequestsGrid onSubmitRequest={() => setShowWizard(true)} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
