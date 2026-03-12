'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ListChecks, Check, X, Loader2, AlertCircle, Circle } from 'lucide-react'
import type { WorkflowPlan, WorkflowStep } from '@/lib/types/assistant'

interface WorkflowPlanCardProps {
  plan: WorkflowPlan
  /** Live step statuses during execution (keyed by stepNumber) */
  stepStatuses?: Record<number, WorkflowStep['status']>
  /** Error message for a failed step */
  stepErrors?: Record<number, string>
  /** Whether the workflow is currently executing */
  isExecuting?: boolean
  onApprove: () => void
  onCancel: () => void
}

const STATUS_ICON = {
  pending: Circle,
  running: Loader2,
  done: Check,
  failed: AlertCircle,
} as const

const STATUS_STYLE = {
  pending: 'text-gray-400 bg-gray-50 border-gray-200',
  running: 'text-blue-500 bg-blue-50 border-blue-200',
  done: 'text-green-600 bg-green-50 border-green-200',
  failed: 'text-red-500 bg-red-50 border-red-200',
} as const

/**
 * Workflow plan approval card for multi-step AI operations.
 * Shows numbered steps with live progress during execution.
 */
export default function WorkflowPlanCard({
  plan,
  stepStatuses = {},
  stepErrors = {},
  isExecuting = false,
  onApprove,
  onCancel,
}: WorkflowPlanCardProps) {
  return (
    <AnimatePresence>
      <motion.div
        className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 rounded-2xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={isExecuting ? undefined : onCancel}
      >
        <motion.div
          className="mx-4 w-full max-w-sm rounded-xl bg-white border border-gray-200 shadow-lg overflow-hidden"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 pt-4 pb-2 border-b border-gray-100">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50">
              <ListChecks className="h-4 w-4 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Workflow Plan
              </span>
            </div>
            <span className="text-xs text-gray-400">
              {plan.stepCount} steps
            </span>
          </div>

          {/* Title */}
          <div className="px-4 pt-3 pb-1">
            <p className="text-sm font-semibold text-gray-900">{plan.title}</p>
          </div>

          {/* Steps */}
          <div className="px-4 py-2 space-y-1.5 max-h-[200px] overflow-y-auto leo-scrollbar">
            {plan.steps.map((step) => {
              const status = stepStatuses[step.stepNumber] || step.status
              const Icon = STATUS_ICON[status]
              const style = STATUS_STYLE[status]
              const error = stepErrors[step.stepNumber]

              return (
                <motion.div
                  key={step.stepNumber}
                  className="flex items-start gap-2.5"
                  layout
                >
                  {/* Step indicator */}
                  <div
                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border ${style} mt-0.5`}
                  >
                    <Icon
                      className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`}
                    />
                  </div>

                  {/* Step description */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs leading-relaxed ${status === 'done' ? 'text-gray-500' : 'text-gray-700'}`}>
                      <span className="font-medium text-gray-900">
                        {step.stepNumber}.
                      </span>{' '}
                      {step.description}
                    </p>
                    {error && (
                      <p className="text-xs text-red-500 mt-0.5">{error}</p>
                    )}
                    {status === 'done' && step.result && (
                      <p className="text-xs text-green-600 mt-0.5">{step.result}</p>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Buttons */}
          <div className="flex gap-2 px-4 pb-4 pt-2">
            <button
              onClick={onCancel}
              disabled={isExecuting}
              className="flex-1 px-5 py-2.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '44px' }}
            >
              {isExecuting ? 'Running...' : 'Cancel'}
            </button>
            <button
              onClick={onApprove}
              disabled={isExecuting}
              className="flex-1 flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '44px' }}
            >
              {isExecuting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Approve &amp; Execute
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
