'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bus,
  Home,
  Users,
  Activity,
  HeartPulse,
  Printer,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react'
import { tabContent, staggerContainer, fadeInUp } from '@/lib/animations'
import { usePermissions } from '@/lib/hooks/usePermissions'
import { useGroups } from '@/lib/hooks/useEventGroups'
import GroupDragBoard from './groups/GroupDragBoard'
import ActivityManager from './groups/ActivityManager'
import DietaryMedicalReport from './groups/DietaryMedicalReport'
import EventPDFGenerator from './groups/EventPDFGenerator'
import type { EventProject } from '@/lib/hooks/useEventProject'
import type { AIGroupAssignmentResult, AIConflictReport } from '@/lib/types/event-ai'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface EventLogisticsTabProps {
  eventProjectId: string
  project?: EventProject
}

type LogisticsTab = 'buses' | 'cabins' | 'small-groups' | 'activities' | 'dietary' | 'print'

// ─── Tab definitions ─────────────────────────────────────────────────────────────

const LOGISTICS_TABS: Array<{
  id: LogisticsTab
  label: string
  icon: React.ElementType
  medical?: boolean
}> = [
  { id: 'buses', label: 'Buses', icon: Bus },
  { id: 'cabins', label: 'Cabins', icon: Home },
  { id: 'small-groups', label: 'Small Groups', icon: Users },
  { id: 'activities', label: 'Activities', icon: Activity },
  { id: 'dietary', label: 'Dietary/Medical', icon: HeartPulse, medical: true },
  { id: 'print', label: 'Print', icon: Printer },
]

// ─── Quick Stats ─────────────────────────────────────────────────────────────────

function QuickStats({ eventProjectId }: { eventProjectId: string }) {
  const { data: busGroups = [] } = useGroups(eventProjectId, 'BUS')
  const { data: cabinGroups = [] } = useGroups(eventProjectId, 'CABIN')
  const { data: smallGroups = [] } = useGroups(eventProjectId, 'SMALL_GROUP')

  const totalGroups = busGroups.length + cabinGroups.length + smallGroups.length
  const totalAssigned = [
    ...busGroups,
    ...cabinGroups,
    ...smallGroups,
  ].reduce((sum, g) => sum + g.assignmentCount, 0)

  return (
    <div className="flex items-center gap-4 text-xs text-slate-500">
      <span>
        <strong className="text-slate-800 font-semibold">{totalGroups}</strong> groups
      </span>
      <span className="text-slate-300">·</span>
      <span>
        <strong className="text-slate-800 font-semibold">{totalAssigned}</strong> assigned
      </span>
    </div>
  )
}

// ─── AI Assignments Preview Modal ─────────────────────────────────────────────────

interface AIAssignmentsModalProps {
  result: AIGroupAssignmentResult
  onApply: () => void
  onDismiss: () => void
}

function AIAssignmentsModal({ result, onApply, onDismiss }: AIAssignmentsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onDismiss} />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="relative bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg max-h-[80vh] flex flex-col z-10"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <h3 className="text-base font-semibold text-slate-900">AI Group Assignments</h3>
          </div>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5">
              <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Warnings
              </p>
              {result.warnings.map((warning, i) => (
                <p key={i} className="text-xs text-amber-700">{warning}</p>
              ))}
            </div>
          )}

          {/* Assignment preview — count by group */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-3">
              {result.assignments.length} participant{result.assignments.length === 1 ? '' : 's'} assigned
            </p>
            {/* Group by groupId */}
            {(() => {
              const byGroup: Record<string, typeof result.assignments> = {}
              for (const a of result.assignments) {
                if (!byGroup[a.groupId]) byGroup[a.groupId] = []
                byGroup[a.groupId].push(a)
              }
              return Object.entries(byGroup).map(([groupId, assignments]) => (
                <div key={groupId} className="bg-slate-50 rounded-xl p-3 mb-2">
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">
                    Group {groupId.slice(-6)} — {assignments.length} participants
                  </p>
                  <div className="space-y-0.5">
                    {assignments.slice(0, 3).map((a) => (
                      <p key={a.participantId} className="text-xs text-slate-500">
                        {a.reasoning ? `• ${a.reasoning}` : `• Participant ${a.participantId.slice(-6)}`}
                      </p>
                    ))}
                    {assignments.length > 3 && (
                      <p className="text-xs text-slate-400">
                        + {assignments.length - 3} more...
                      </p>
                    )}
                  </div>
                </div>
              ))
            })()}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onDismiss}
            className="px-4 py-2 rounded-full text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onApply}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 active:scale-[0.97] transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Apply Suggestions
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Conflict Alert Panel ────────────────────────────────────────────────────────

interface ConflictAlertProps {
  report: AIConflictReport
  onDismiss: () => void
}

function ConflictAlert({ report, onDismiss }: ConflictAlertProps) {
  const { conflicts } = report

  if (conflicts.length === 0) {
    return (
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800"
      >
        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
        <span className="flex-1 font-medium">No scheduling conflicts detected</span>
        <button
          onClick={onDismiss}
          className="text-green-500 hover:text-green-700 cursor-pointer flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    )
  }

  const severityConfig = {
    high: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', badge: 'bg-red-100 text-red-700' },
    medium: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-700' },
    low: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700' },
  }

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="space-y-2"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          {conflicts.length} scheduling conflict{conflicts.length === 1 ? '' : 's'} found
        </p>
        <button
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {conflicts.map((conflict, i) => {
        const cfg = severityConfig[conflict.severity]
        return (
          <div
            key={i}
            className={`px-4 py-3 rounded-xl border ${cfg.bg} ${cfg.border}`}
          >
            <div className="flex items-start gap-2">
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${cfg.badge}`}>
                {conflict.severity.toUpperCase()}
              </span>
              <div className="min-w-0">
                <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.text} mr-2`}>
                  {conflict.type.replace('_', ' ')}
                </span>
                <span className={`text-xs ${cfg.text}`}>{conflict.description}</span>
                {conflict.conflictingEventTitle && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Conflicts with: <span className="font-medium">{conflict.conflictingEventTitle}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </motion.div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────────

export function EventLogisticsTab({ eventProjectId, project }: EventLogisticsTabProps) {
  const [activeTab, setActiveTab] = useState<LogisticsTab>('buses')
  const { data: perms } = usePermissions()

  // AI state
  const [suggestingAssignments, setSuggestingAssignments] = useState(false)
  const [assignmentResult, setAssignmentResult] = useState<AIGroupAssignmentResult | null>(null)
  const [checkingConflicts, setCheckingConflicts] = useState(false)
  const [conflictReport, setConflictReport] = useState<AIConflictReport | null>(null)
  const [aiError, setAIError] = useState<string | null>(null)

  const canViewMedical =
    perms?.legacyRole === 'super-admin' || perms?.legacyRole === 'admin'

  // Event info for PDFs
  const eventName = project?.title ?? 'Event'
  const eventDate = project?.startsAt
    ? new Date(project.startsAt).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : ''

  async function handleSuggestAssignments() {
    setSuggestingAssignments(true)
    setAIError(null)
    try {
      const res = await fetch('/api/events/ai/generate-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventProjectId }),
      })
      const json = await res.json()
      if (json.ok) {
        setAssignmentResult(json.data)
      } else {
        setAIError(json.error?.message ?? 'Failed to generate group assignments')
      }
    } catch {
      setAIError('Network error — please try again')
    } finally {
      setSuggestingAssignments(false)
    }
  }

  async function handleCheckConflicts() {
    setCheckingConflicts(true)
    setAIError(null)
    try {
      const res = await fetch('/api/events/ai/detect-conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventProjectId }),
      })
      const json = await res.json()
      if (json.ok) {
        setConflictReport(json.data)
      } else {
        setAIError(json.error?.message ?? 'Failed to check conflicts')
      }
    } catch {
      setAIError('Network error — please try again')
    } finally {
      setCheckingConflicts(false)
    }
  }

  function handleApplyAssignments() {
    // TODO: Wire to existing group assignment mutations when implemented
    // For now, dismiss the modal — the plan phase that implements assignment writing is separate
    setAssignmentResult(null)
  }

  function renderTabContent() {
    switch (activeTab) {
      case 'buses':
        return (
          <GroupDragBoard
            key="buses"
            eventProjectId={eventProjectId}
            groupType="BUS"
          />
        )
      case 'cabins':
        return (
          <GroupDragBoard
            key="cabins"
            eventProjectId={eventProjectId}
            groupType="CABIN"
          />
        )
      case 'small-groups':
        return (
          <GroupDragBoard
            key="small-groups"
            eventProjectId={eventProjectId}
            groupType="SMALL_GROUP"
          />
        )
      case 'activities':
        return <ActivityManager eventProjectId={eventProjectId} />
      case 'dietary':
        return (
          <DietaryMedicalReport
            eventProjectId={eventProjectId}
            canViewMedical={canViewMedical}
          />
        )
      case 'print':
        return (
          <EventPDFGenerator
            eventProjectId={eventProjectId}
            eventName={eventName}
            eventDate={eventDate}
            canViewMedical={canViewMedical}
          />
        )
      default:
        return null
    }
  }

  const isGroupTab = ['buses', 'cabins', 'small-groups'].includes(activeTab)

  return (
    <>
      <motion.div
        variants={staggerContainer()}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Header row */}
        <motion.div variants={fadeInUp} className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <QuickStats eventProjectId={eventProjectId} />
          </div>

          {/* AI action buttons — shown when on a group-type tab */}
          {isGroupTab && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleCheckConflicts}
                disabled={checkingConflicts}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-xs font-medium hover:bg-amber-100 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {checkingConflicts ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5" />
                )}
                {checkingConflicts ? 'Checking...' : 'Check Conflicts'}
              </button>
              <button
                onClick={handleSuggestAssignments}
                disabled={suggestingAssignments}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-medium hover:bg-indigo-100 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {suggestingAssignments ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {suggestingAssignments ? 'Analyzing...' : 'AI Suggest Assignments'}
              </button>
            </div>
          )}
        </motion.div>

        {/* AI error */}
        {aiError && (
          <motion.div variants={fadeInUp}>
            <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <X className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{aiError}</span>
              <button
                onClick={() => setAIError(null)}
                className="text-red-400 hover:text-red-600 cursor-pointer flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Conflict report panel */}
        <AnimatePresence>
          {conflictReport && (
            <motion.div variants={fadeInUp} initial="hidden" animate="visible">
              <ConflictAlert
                report={conflictReport}
                onDismiss={() => setConflictReport(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sub-tabs */}
        <motion.div variants={fadeInUp} className="border-b border-slate-200">
          <nav className="flex overflow-x-auto scrollbar-none -mb-px gap-1" style={{ scrollbarWidth: 'none' }}>
            {LOGISTICS_TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = tab.id === activeTab
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap
                    border-b-2 transition-colors cursor-pointer flex-shrink-0
                    ${
                      isActive
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }
                  `}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-indigo-500' : 'text-slate-400'
                    }`}
                  />
                  {tab.label}
                  {tab.medical && !canViewMedical && (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 ml-0.5" />
                  )}
                </button>
              )
            })}
          </nav>
        </motion.div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={tabContent}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* AI Assignments preview modal */}
      <AnimatePresence>
        {assignmentResult && (
          <AIAssignmentsModal
            result={assignmentResult}
            onApply={handleApplyAssignments}
            onDismiss={() => setAssignmentResult(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
