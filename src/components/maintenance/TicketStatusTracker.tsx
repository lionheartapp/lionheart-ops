'use client'

import { Check, Clock, Pause, Calendar, XCircle } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type MaintenanceStatus =
  | 'BACKLOG'
  | 'TODO'
  | 'IN_PROGRESS'
  | 'QA'
  | 'DONE'
  | 'ON_HOLD'
  | 'SCHEDULED'
  | 'CANCELLED'

type HoldReason = 'PARTS' | 'VENDOR' | 'ACCESS' | 'OTHER'

interface TicketStatusTrackerProps {
  currentStatus: MaintenanceStatus
  holdReason?: HoldReason | null
  scheduledDate?: string | null
}

// ─── Primary Linear Path ──────────────────────────────────────────────────────

const PRIMARY_STEPS: { status: MaintenanceStatus; label: string; shortLabel: string }[] = [
  { status: 'BACKLOG', label: 'Backlog', shortLabel: 'Backlog' },
  { status: 'TODO', label: 'To Do', shortLabel: 'To Do' },
  { status: 'IN_PROGRESS', label: 'In Progress', shortLabel: 'In Progress' },
  { status: 'QA', label: 'QA Review', shortLabel: 'QA' },
  { status: 'DONE', label: 'Done', shortLabel: 'Done' },
]

const HOLD_REASON_LABELS: Record<HoldReason, string> = {
  PARTS: 'Waiting for Parts',
  VENDOR: 'Waiting for Vendor',
  ACCESS: 'Access Required',
  OTHER: 'On Hold',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TicketStatusTracker({
  currentStatus,
  holdReason,
  scheduledDate,
}: TicketStatusTrackerProps) {
  // Map branch statuses to their "parent" step on the primary path
  const effectivePrimaryStatus =
    currentStatus === 'ON_HOLD' ? 'IN_PROGRESS'
    : currentStatus === 'SCHEDULED' ? 'BACKLOG'
    : currentStatus

  const isCancelled = currentStatus === 'CANCELLED'
  const isOnHold = currentStatus === 'ON_HOLD'
  const isScheduled = currentStatus === 'SCHEDULED'

  const currentStepIndex = PRIMARY_STEPS.findIndex((s) => s.status === effectivePrimaryStatus)

  return (
    <div className="space-y-2.5">
      {/* Branch state badges */}
      {isOnHold && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
          <Pause className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-amber-800">
              {holdReason ? HOLD_REASON_LABELS[holdReason] : 'On Hold'}
            </p>
            <p className="text-xs text-amber-600">Work paused — ticket will return to In Progress when resumed</p>
          </div>
        </div>
      )}

      {isScheduled && (
        <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-xl">
          <Calendar className="w-4 h-4 text-purple-600 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-purple-800">
              Scheduled{scheduledDate ? ` for ${formatDate(scheduledDate)}` : ''}
            </p>
            <p className="text-xs text-purple-600">Will move to Backlog on the scheduled date</p>
          </div>
        </div>
      )}

      {isCancelled && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
          <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-xs font-semibold text-red-800">Cancelled</p>
            <p className="text-xs text-red-600">This ticket has been cancelled</p>
          </div>
        </div>
      )}

      {/* Primary linear tracker */}
      <div className="relative">
        {/* Steps row */}
        <div className="flex items-center gap-0">
          {PRIMARY_STEPS.map((step, index) => {
            const isCompleted =
              !isCancelled && index < currentStepIndex
            const isCurrent =
              !isCancelled && step.status === effectivePrimaryStatus
            const isFuture =
              !isCancelled && index > currentStepIndex
            const isCancelledStep = isCancelled && index > 0

            // On-hold: the IN_PROGRESS step gets amber "paused" state
            const isPaused = isOnHold && step.status === 'IN_PROGRESS'
            // Scheduled: the BACKLOG step gets purple "waiting" state
            const isWaiting = isScheduled && step.status === 'BACKLOG'

            return (
              <div key={step.status} className="flex items-center flex-1 min-w-0">
                {/* Step circle + label */}
                <div className="flex flex-col items-center flex-shrink-0 relative z-10">
                  {/* Circle */}
                  <div
                    className={`
                      w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all duration-300
                      ${isCompleted
                        ? 'bg-emerald-500 border-emerald-500'
                        : isCurrent && !isPaused && !isWaiting
                          ? 'bg-emerald-500 border-emerald-500 ring-2 ring-emerald-200 ring-offset-1'
                          : isPaused
                            ? 'bg-amber-400 border-amber-400 ring-2 ring-amber-200 ring-offset-1'
                            : isWaiting
                              ? 'bg-purple-400 border-purple-400 ring-2 ring-purple-200 ring-offset-1'
                              : isCancelledStep
                                ? 'bg-gray-100 border-gray-200'
                                : isFuture
                                  ? 'bg-white border-gray-200'
                                  : 'bg-white border-gray-200'
                      }
                    `}
                  >
                    {isCompleted ? (
                      <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                    ) : isCurrent && !isPaused && !isWaiting ? (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    ) : isPaused ? (
                      <Pause className="w-3 h-3 text-white" />
                    ) : isWaiting ? (
                      <Clock className="w-3 h-3 text-white" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-gray-200" />
                    )}
                  </div>

                  {/* Step label (hidden on very small screens) */}
                  <span
                    className={`
                      hidden sm:block text-center mt-1.5 leading-tight transition-colors duration-300
                      text-[10px] font-medium whitespace-nowrap
                      ${isCompleted
                        ? 'text-emerald-600'
                        : isCurrent && !isPaused && !isWaiting
                          ? 'text-emerald-700 font-semibold'
                          : isPaused
                            ? 'text-amber-600 font-semibold'
                            : isWaiting
                              ? 'text-purple-600 font-semibold'
                              : isCancelledStep
                                ? 'text-gray-300'
                                : 'text-gray-400'
                      }
                    `}
                  >
                    {step.shortLabel}
                  </span>
                </div>

                {/* Connector line (after each step except the last) */}
                {index < PRIMARY_STEPS.length - 1 && (
                  <div
                    className={`
                      flex-1 h-0.5 mx-1 transition-colors duration-300
                      ${isCompleted
                        ? 'bg-emerald-400'
                        : isCancelledStep || (isCancelled && index === 0)
                          ? 'bg-gray-100'
                          : 'border-t border-dashed border-gray-200'
                      }
                    `}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
