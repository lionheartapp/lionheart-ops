'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Trash2, ClipboardCheck, ChevronRight, Shield, GripVertical,
  Layers, ArrowDown, Users, Sparkles, Search,
} from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { useActiveSchool } from '@/lib/hooks/useActiveSchool'
import AIWorkflowCreator from './AIWorkflowCreator'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'

// ─── Types ──────────────────────────────────────────────────────────────────

interface StepEntry {
  id: string
  teamId: string
  mode: string
  trigger: string
  resourceType: string | null
  escalationHours: number
  sortOrder: number
  team: { id: string; name: string; slug: string }
  assignedUser: { id: string; firstName: string | null; lastName: string | null; email: string; avatar?: string | null } | null
}

interface RuleData {
  id: string
  name: string
  description: string | null
  schoolId: string | null
  campusId: string | null
  eventCategory: string | null
  minAttendance: number | null
  requiresResource: string | null
  isOffCampus: boolean | null
  isDefault: boolean
  isFinalApprover: boolean
  executionMode: string
  isActive: boolean
  sortOrder: number
  school: { id: string; name: string; color: string } | null
  campus: { id: string; name: string } | null
  steps: StepEntry[]
}

interface SchoolData { id: string; name: string; institutionType: string; color: string }
interface CampusData { id: string; name: string; schoolId: string | null }
interface CategoryData { id: string; name: string; color: string }
interface TeamData { id: string; name: string; slug: string; members: { id: string; name: string; email: string; avatar?: string | null }[] }

async function fetchRules() {
  return fetchApi('/api/settings/approval-rules') as Promise<{
    rules: RuleData[]; schools: SchoolData[]; campuses: CampusData[]; categories: CategoryData[]; teams: TeamData[]
  }>
}

// ─── Sortable Step Row ──────────────────────────────────────────────────────

function SortableStepRow({
  step,
  idx,
  ruleId,
  executionMode,
  updateStep,
  removeStep,
}: {
  step: StepEntry
  idx: number
  ruleId: string
  executionMode: string
  updateStep: (ruleId: string, stepId: string, data: Record<string, unknown>) => void
  removeStep: (ruleId: string, stepId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
    opacity: isDragging ? 0.8 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`px-6 py-4 flex items-center gap-3 hover:bg-slate-50/50 transition-colors ${isDragging ? 'bg-blue-50/50 shadow-lg rounded-xl' : ''}`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 cursor-grab active:cursor-grabbing hover:bg-slate-100 rounded transition-colors flex-shrink-0"
        tabIndex={-1}
      >
        <GripVertical className="w-3.5 h-3.5 text-slate-300" />
      </button>

      {/* Step avatar / number */}
      {step.assignedUser?.avatar ? (
        <img src={step.assignedUser.avatar} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-600 flex-shrink-0">
          {executionMode === 'PARALLEL' ? '∥' : idx + 1}
        </div>
      )}

      {/* Step info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800">
          {step.assignedUser
            ? `${step.assignedUser.firstName || ''} ${step.assignedUser.lastName || ''}`.trim() || step.assignedUser.email
            : step.team.name}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {step.assignedUser && <>{step.team.name} · </>}
          {step.trigger === 'ALWAYS' ? 'Every event' : 'When resource needed'}
        </p>
      </div>

      {/* Mode toggle with sliding pill */}
      <div className="relative inline-flex items-center gap-0.5 p-0.5 rounded-full bg-slate-100 flex-shrink-0">
        {step.mode === 'REQUIRED' && (
          <motion.div
            layoutId={`mode-pill-${step.id}`}
            className="absolute top-0.5 bottom-0.5 rounded-full bg-white shadow-sm"
            style={{ left: '2px', width: 'calc(55% - 2px)' }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}
        {step.mode === 'NOTIFICATION' && (
          <motion.div
            layoutId={`mode-pill-${step.id}`}
            className="absolute top-0.5 bottom-0.5 rounded-full bg-white shadow-sm"
            style={{ right: '2px', width: 'calc(50% - 2px)' }}
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}
        <button
          onClick={() => updateStep(ruleId, step.id, { mode: 'REQUIRED' })}
          className={`relative z-10 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            step.mode === 'REQUIRED' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Must Approve
        </button>
        <button
          onClick={() => updateStep(ruleId, step.id, { mode: 'NOTIFICATION' })}
          className={`relative z-10 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            step.mode === 'NOTIFICATION' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Notify Only
        </button>
      </div>

      {/* Trigger toggle */}
      <select
        value={step.trigger}
        onChange={(e) => updateStep(ruleId, step.id, { trigger: e.target.value })}
        className="text-[10px] bg-white border border-slate-200 rounded-md px-1.5 py-1 focus:border-slate-900 outline-none flex-shrink-0"
      >
        <option value="ALWAYS">Always</option>
        <option value="WHEN_RESOURCE_REQUESTED">If needed</option>
      </select>

      {/* Escalation timer */}
      {step.mode === 'REQUIRED' && (
        <select
          value={step.escalationHours}
          onChange={(e) => updateStep(ruleId, step.id, { escalationHours: Number(e.target.value) })}
          title="Reminder if no response"
          className="text-[10px] bg-white border border-slate-200 rounded-md px-1.5 py-1 focus:border-slate-900 outline-none flex-shrink-0"
        >
          <option value={24}>24h</option>
          <option value={48}>48h</option>
          <option value={72}>72h</option>
          <option value={96}>4 days</option>
          <option value={168}>1 week</option>
        </select>
      )}

      {/* Remove */}
      <button
        onClick={() => removeStep(ruleId, step.id)}
        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0 cursor-pointer"
      >
        <X className="w-3.5 h-3.5 text-slate-300 hover:text-red-500" />
      </button>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ApprovalRulesBuilder() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['approval-rules'], queryFn: fetchRules })
  const { activeSchoolId } = useActiveSchool()
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)
  const [ruleSearch, setRuleSearch] = useState('')
  const [addStepTeamId, setAddStepTeamId] = useState('')
  const [addStepType, setAddStepType] = useState<'team' | 'person'>('team')
  const [addStepPersonId, setAddStepPersonId] = useState('')
  const [showAddStep, setShowAddStep] = useState(false)
  const [showAICreator, setShowAICreator] = useState(false)
  const [showAIDisclaimer, setShowAIDisclaimer] = useState(false)

  const allRules = data?.rules ?? []
  const schools = data?.schools ?? []
  const campuses = data?.campuses ?? []
  const categories = data?.categories ?? []
  const teams = data?.teams ?? []

  // Filter rules by the active campus selection. When a campus is selected,
  // show rules that match that campus, its parent school, or are global (no
  // school/campus condition). When "All Schools", show everything.
  const rules = useMemo(() => {
    if (!activeSchoolId) return allRules
    const selectedCampus = campuses.find(c => c.id === activeSchoolId)
    const selectedSchoolId = selectedCampus?.schoolId ?? null
    return allRules.filter(r => {
      // Always show catch-all and always-required rules
      if (r.isDefault || r.isFinalApprover) return true
      // Show rules with no conditions (global)
      if (!r.schoolId && !r.campusId) return true
      // Show rules matching this campus
      if (r.campusId === activeSchoolId) return true
      // Show rules matching this campus's school
      if (r.schoolId && r.schoolId === selectedSchoolId && !r.campusId) return true
      return false
    })
  }, [allRules, activeSchoolId, campuses])

  // Flat list: all specific rules, then default catch-all at the bottom
  const allSpecificRules = rules.filter(r => !r.isDefault)
  const defaultRule = rules.find(r => r.isDefault)

  // Search filter
  const searchLower = ruleSearch.toLowerCase().trim()
  const specificRules = searchLower
    ? allSpecificRules.filter(r => r.name.toLowerCase().includes(searchLower))
    : allSpecificRules
  const selectedRule = rules.find(r => r.id === selectedRuleId) ?? null

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const mutate = useMutation({
    mutationFn: async (action: { method: string; url: string; body?: Record<string, unknown> }) => {
      return fetchApi(action.url, {
        method: action.method,
        body: action.body ? JSON.stringify(action.body) : undefined,
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approval-rules'] }),
  })

  const addRule = (opts: { schoolId?: string; isDefault?: boolean; isFinalApprover?: boolean }) => {
    const name = opts.isDefault
      ? 'All Other Events'
      : 'New Rule'
    mutate.mutate({
      method: 'POST', url: '/api/settings/approval-rules',
      body: { name, ...opts },
    })
  }

  const deleteRule = (id: string) => {
    if (selectedRuleId === id) setSelectedRuleId(null)
    mutate.mutate({ method: 'DELETE', url: `/api/settings/approval-rules/${id}` })
  }

  const updateRule = (id: string, updates: Record<string, unknown>) => {
    // Optimistic cache update — instant visual feedback
    queryClient.setQueryData(['approval-rules'], (old: { rules: RuleData[] } | undefined) => {
      if (!old) return old
      return { ...old, rules: old.rules.map(r => r.id === id ? { ...r, ...updates } : r) }
    })
    // Background save
    fetchApi(`/api/settings/approval-rules/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }).catch(() => {
      queryClient.invalidateQueries({ queryKey: ['approval-rules'] })
    })
  }

  // Flatten all team members for the person picker
  const allMembers = teams.flatMap(t =>
    t.members.map(m => ({ ...m, teamName: t.name }))
  ).filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)

  const addStep = (ruleId: string) => {
    if (addStepType === 'team' && addStepTeamId) {
      mutate.mutate({ method: 'POST', url: `/api/settings/approval-rules/${ruleId}/steps`, body: { teamId: addStepTeamId } })
    } else if (addStepType === 'person' && addStepPersonId) {
      const memberTeam = teams.find(t => t.members.some(m => m.id === addStepPersonId))
      mutate.mutate({
        method: 'POST', url: `/api/settings/approval-rules/${ruleId}/steps`,
        body: { teamId: memberTeam?.id || teams[0]?.id, assignedUserId: addStepPersonId },
      })
    }
    setShowAddStep(false)
    setAddStepTeamId('')
    setAddStepPersonId('')
    setAddStepType('team')
  }

  const updateStep = useCallback((ruleId: string, stepId: string, data: Record<string, unknown>) => {
    mutate.mutate({ method: 'PUT', url: `/api/settings/approval-rules/${ruleId}/steps`, body: { stepId, ...data } })
  }, [mutate])

  const removeStep = useCallback((ruleId: string, stepId: string) => {
    mutate.mutate({ method: 'DELETE', url: `/api/settings/approval-rules/${ruleId}/steps`, body: { stepId } })
  }, [mutate])

  // Step reorder handler — optimistic update + single background save
  const handleStepDragEnd = useCallback((event: DragEndEvent) => {
    if (!selectedRule) return
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = selectedRule.steps.findIndex(s => s.id === active.id)
    const newIndex = selectedRule.steps.findIndex(s => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    // Build reordered steps
    const reordered = [...selectedRule.steps]
    const [moved] = reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, moved)
    const withNewOrder = reordered.map((step, i) => ({ ...step, sortOrder: i }))

    // Optimistic cache update — instant visual feedback
    queryClient.setQueryData(['approval-rules'], (old: { rules: RuleData[]; schools: SchoolData[]; campuses: CampusData[]; categories: CategoryData[]; teams: TeamData[] } | undefined) => {
      if (!old) return old
      return {
        ...old,
        rules: old.rules.map(r =>
          r.id === selectedRule.id ? { ...r, steps: withNewOrder } : r
        ),
      }
    })

    // Background save — send all reorders, only refetch once at the end
    const stepsToUpdate = withNewOrder.filter((step, i) => selectedRule.steps[i]?.id !== step.id)
    Promise.all(
      stepsToUpdate.map(step =>
        fetchApi(`/api/settings/approval-rules/${selectedRule.id}/steps`, {
          method: 'PUT',
          body: JSON.stringify({ stepId: step.id, sortOrder: step.sortOrder }),
        })
      )
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: ['approval-rules'] })
    }).catch(() => {
      queryClient.invalidateQueries({ queryKey: ['approval-rules'] })
    })
  }, [selectedRule, queryClient])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="ui-glass p-6"><div className="h-20 animate-pulse rounded-xl bg-slate-100" /></div>
        <div className="h-96 animate-pulse rounded-2xl bg-slate-50 border border-slate-200" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="ui-glass p-6">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Approval Workflow</h3>
            <p className="text-sm text-slate-500 mt-0.5">Define who must approve events using conditional rules</p>
          </div>
        </div>
      </div>

      {/* AI disclaimer banner */}
      <AnimatePresence>
        {showAIDisclaimer && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
              <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-800">AI-generated rules — please review</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  These rules were created by AI and may not be 100% accurate. Please review each rule's conditions, steps, and execution mode before relying on them.
                </p>
              </div>
              <button
                onClick={() => setShowAIDisclaimer(false)}
                className="p-1 hover:bg-amber-100 rounded-lg transition-colors flex-shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-amber-400" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Two-column builder */}
      <div className="flex gap-0 border border-slate-200 rounded-2xl overflow-hidden bg-white" style={{ height: 'calc(100vh - 200px)' }}>

        {/* ── Left panel: flat rule list ─────────────────────────────── */}
        <div className="w-96 flex-shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-100/50 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                Approval Rules
                <span className="ml-1.5 text-[10px] font-medium text-slate-400">{rules.length}</span>
              </p>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={ruleSearch}
                onChange={(e) => setRuleSearch(e.target.value)}
                placeholder="Search rules..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-slate-400 transition-colors placeholder:text-slate-400"
              />
              {ruleSearch && (
                <button
                  onClick={() => setRuleSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3 text-slate-400" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {/* Specific rules — each is independent, all matching rules merge */}
            {specificRules.map(rule => (
              <RuleCard
                key={rule.id}
                rule={rule}
                isSelected={selectedRuleId === rule.id}
                onClick={() => setSelectedRuleId(rule.id)}
                onDelete={() => deleteRule(rule.id)}
                categories={categories}
              />
            ))}

            {/* Default catch-all — always at the bottom */}
            {specificRules.length > 0 && defaultRule && (
              <div className="pt-2 pb-1">
                <div className="border-t border-slate-200" />
              </div>
            )}
            {defaultRule && (
              <RuleCard
                rule={defaultRule}
                isSelected={selectedRuleId === defaultRule.id}
                onClick={() => setSelectedRuleId(defaultRule.id)}
                onDelete={() => deleteRule(defaultRule.id)}
                categories={categories}
                isDefault
              />
            )}
          </div>

          {/* Bottom actions */}
          <div className="p-3 border-t border-slate-200 space-y-1">
            <button
              onClick={() => setShowAICreator(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer w-full"
            >
              <Sparkles className="w-3.5 h-3.5" /> Create with AI
            </button>
            <button
              onClick={() => addRule({})}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer w-full"
            >
              <Plus className="w-3.5 h-3.5" /> Add rule manually
            </button>
            {!defaultRule && (
              <button
                onClick={() => addRule({ isDefault: true })}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-lg transition-colors cursor-pointer w-full"
              >
                <Layers className="w-3.5 h-3.5" /> Add default catch-all
              </button>
            )}
          </div>
        </div>

        {/* ── Right panel: selected rule detail ────────────────────── */}
        <div className="flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            {selectedRule ? (
              <motion.div
                key={selectedRule.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="flex-1 flex flex-col"
              >
                {/* Detail header */}
                <div className="px-6 py-4 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={selectedRule.name}
                      onChange={(e) => updateRule(selectedRule.id, { name: e.target.value })}
                      className="text-lg font-semibold text-slate-900 bg-transparent border-none outline-none hover:bg-slate-50 focus:bg-slate-50 rounded-lg px-2 py-1 -mx-2 w-[calc(100%+1rem)] transition-colors"
                      placeholder="Rule name..."
                    />
                  </div>

                  {/* Condition builder — school + campus + category */}
                  {!selectedRule.isFinalApprover && !selectedRule.isDefault && (
                    <div className="mt-3 space-y-2">
                      {/* School condition */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-amber-600 w-12 flex-shrink-0">When</span>
                        <span className="text-xs text-slate-400 flex-shrink-0">school is</span>
                        <select
                          value={selectedRule.schoolId || ''}
                          onChange={(e) => {
                            const schoolName = schools.find(s => s.id === e.target.value)?.name
                            const updates: Record<string, unknown> = { schoolId: e.target.value || null }
                            // Auto-update name based on conditions
                            if (e.target.value && !selectedRule.campusId && !selectedRule.eventCategory) {
                              updates.name = (schoolName || '') + ' Events'
                            }
                            // Clear campus if it doesn't belong to selected school
                            if (e.target.value && selectedRule.campusId) {
                              const campus = campuses.find(c => c.id === selectedRule.campusId)
                              if (campus && campus.schoolId !== e.target.value) {
                                updates.campusId = null
                              }
                            }
                            updateRule(selectedRule.id, updates)
                          }}
                          className="text-xs bg-white border border-slate-200 rounded-md px-2 py-1 focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 outline-none flex-1 min-w-0"
                        >
                          <option value="">Any school</option>
                          {schools.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Campus condition */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-400 w-12 flex-shrink-0">and</span>
                        <span className="text-xs text-slate-400 flex-shrink-0">campus is</span>
                        <select
                          value={selectedRule.campusId || ''}
                          onChange={(e) => {
                            const updates: Record<string, unknown> = { campusId: e.target.value || null }
                            updateRule(selectedRule.id, updates)
                          }}
                          className="text-xs bg-white border border-slate-200 rounded-md px-2 py-1 focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 outline-none flex-1 min-w-0"
                        >
                          <option value="">Any campus</option>
                          {campuses
                            .filter(c => !selectedRule.schoolId || c.schoolId === selectedRule.schoolId)
                            .map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                      </div>

                      {/* Category condition */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-400 w-12 flex-shrink-0">and</span>
                        <span className="text-xs text-slate-400 flex-shrink-0">category is</span>
                        <select
                          value={selectedRule.eventCategory || ''}
                          onChange={(e) => {
                            updateRule(selectedRule.id, { eventCategory: e.target.value || null })
                          }}
                          className="text-xs bg-white border border-slate-200 rounded-md px-2 py-1 focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 outline-none flex-1 min-w-0"
                        >
                          <option value="">Any category</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Extra conditions — shown only when active or when user clicks "+ Add condition" */}
                      {selectedRule.minAttendance != null && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-400 w-12 flex-shrink-0">and</span>
                          <span className="text-xs text-slate-400 flex-shrink-0">attendance ≥</span>
                          <input
                            type="number"
                            min="1"
                            value={selectedRule.minAttendance ?? ''}
                            onChange={(e) => updateRule(selectedRule.id, { minAttendance: e.target.value ? Number(e.target.value) : null })}
                            placeholder="Any size"
                            className="text-xs bg-white border border-slate-200 rounded-md px-2 py-1 focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 outline-none w-24 flex-shrink-0"
                          />
                          <button onClick={() => updateRule(selectedRule.id, { minAttendance: null })} className="text-slate-300 hover:text-red-400 cursor-pointer"><X className="w-3 h-3" /></button>
                        </div>
                      )}

                      {selectedRule.requiresResource != null && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-400 w-12 flex-shrink-0">and</span>
                          <span className="text-xs text-slate-400 flex-shrink-0">needs</span>
                          <select
                            value={selectedRule.requiresResource || ''}
                            onChange={(e) => updateRule(selectedRule.id, { requiresResource: e.target.value || null })}
                            className="text-xs bg-white border border-slate-200 rounded-md px-2 py-1 focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 outline-none flex-1 min-w-0"
                          >
                            <option value="av">A/V Equipment</option>
                            <option value="facilities">Facilities Setup</option>
                            <option value="custodial">Custodial</option>
                            <option value="security">Security</option>
                          </select>
                          <button onClick={() => updateRule(selectedRule.id, { requiresResource: null })} className="text-slate-300 hover:text-red-400 cursor-pointer"><X className="w-3 h-3" /></button>
                        </div>
                      )}

                      {selectedRule.isOffCampus != null && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-400 w-12 flex-shrink-0">and</span>
                          <span className="text-xs text-slate-400 flex-shrink-0">location is</span>
                          <select
                            value={selectedRule.isOffCampus ? 'true' : 'false'}
                            onChange={(e) => updateRule(selectedRule.id, { isOffCampus: e.target.value === 'true' })}
                            className="text-xs bg-white border border-slate-200 rounded-md px-2 py-1 focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 outline-none flex-1 min-w-0"
                          >
                            <option value="false">On campus</option>
                            <option value="true">Off campus</option>
                          </select>
                          <button onClick={() => updateRule(selectedRule.id, { isOffCampus: null })} className="text-slate-300 hover:text-red-400 cursor-pointer"><X className="w-3 h-3" /></button>
                        </div>
                      )}

                      {/* + Add condition button — shows options not yet active */}
                      {(selectedRule.minAttendance == null || selectedRule.requiresResource == null || selectedRule.isOffCampus == null) && (
                        <div className="flex items-center gap-1.5 pl-14">
                          <span className="text-[10px] text-slate-400 mr-1">+ Add:</span>
                          {selectedRule.minAttendance == null && (
                            <button
                              type="button"
                              onClick={() => updateRule(selectedRule.id, { minAttendance: 100 })}
                              className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 hover:border-slate-400 cursor-pointer transition-colors"
                            >
                              Attendance
                            </button>
                          )}
                          {selectedRule.requiresResource == null && (
                            <button
                              type="button"
                              onClick={() => updateRule(selectedRule.id, { requiresResource: 'av' })}
                              className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 hover:border-slate-400 cursor-pointer transition-colors"
                            >
                              Resource
                            </button>
                          )}
                          {selectedRule.isOffCampus == null && (
                            <button
                              type="button"
                              onClick={() => updateRule(selectedRule.id, { isOffCampus: true })}
                              className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 hover:border-slate-400 cursor-pointer transition-colors"
                            >
                              Location
                            </button>
                          )}
                        </div>
                      )}

                      {/* Active conditions summary */}
                      {(selectedRule.schoolId || selectedRule.campusId || selectedRule.eventCategory || selectedRule.minAttendance || selectedRule.requiresResource || selectedRule.isOffCampus != null) && (
                        <p className="text-[10px] text-slate-400 pl-14">
                          Matches events where{' '}
                          {[
                            selectedRule.school && `school = ${selectedRule.school.name}`,
                            selectedRule.campus && `campus = ${selectedRule.campus.name}`,
                            selectedRule.eventCategory && `category = ${categories.find(c => c.id === selectedRule.eventCategory)?.name || selectedRule.eventCategory}`,
                            selectedRule.minAttendance && `attendance ≥ ${selectedRule.minAttendance}`,
                            selectedRule.requiresResource && `needs ${selectedRule.requiresResource.toUpperCase()}`,
                            selectedRule.isOffCampus === true && 'off-campus',
                            selectedRule.isOffCampus === false && 'on-campus',
                          ].filter(Boolean).join(' AND ')}
                        </p>
                      )}
                    </div>
                  )}

                  {selectedRule.isFinalApprover && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <Shield className="w-3 h-3" /> These steps always run after all conditional rules
                    </p>
                  )}

                  {selectedRule.isDefault && (
                    <p className="text-xs text-blue-600 mt-1">Applies when no other conditions match</p>
                  )}

                  {/* Parallel / Sequential toggle */}
                  {selectedRule.steps.length > 1 && (
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-xs font-medium text-slate-500">Execution:</span>
                      <div className="relative inline-flex items-center gap-0.5 p-0.5 rounded-full bg-slate-100">
                        <motion.div
                          className="absolute top-0.5 bottom-0.5 rounded-full bg-white shadow-sm"
                          animate={{
                            left: (selectedRule.executionMode || 'PARALLEL') === 'PARALLEL' ? '2px' : '50%',
                            width: 'calc(50% - 3px)',
                          }}
                          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                        />
                        <button
                          onClick={() => updateRule(selectedRule.id, { executionMode: 'PARALLEL' })}
                          className={`relative z-10 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                            (selectedRule.executionMode || 'PARALLEL') === 'PARALLEL'
                              ? 'text-slate-900'
                              : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          <Layers className="w-3 h-3" />
                          Parallel
                        </button>
                        <button
                          onClick={() => updateRule(selectedRule.id, { executionMode: 'SEQUENTIAL' })}
                          className={`relative z-10 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                            selectedRule.executionMode === 'SEQUENTIAL'
                              ? 'text-slate-900'
                              : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          <ArrowDown className="w-3 h-3" />
                          Sequential
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {(selectedRule.executionMode || 'PARALLEL') === 'PARALLEL'
                          ? 'All reviewers see event at once'
                          : 'Each step waits for the previous'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Steps list with drag-and-drop */}
                <div className="flex-1 overflow-y-auto">
                  {selectedRule.steps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                      <p className="text-sm text-slate-400">No approval steps yet</p>
                      <p className="text-xs text-slate-300 mt-1">Add a team or person that must review events matching this condition</p>
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      modifiers={[restrictToVerticalAxis]}
                      onDragEnd={handleStepDragEnd}
                    >
                      <SortableContext
                        items={selectedRule.steps.map(s => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="divide-y divide-slate-100">
                          {selectedRule.steps.map((step, idx) => (
                            <SortableStepRow
                              key={step.id}
                              step={step}
                              idx={idx}
                              ruleId={selectedRule.id}
                              executionMode={selectedRule.executionMode || 'PARALLEL'}
                              updateStep={updateStep}
                              removeStep={removeStep}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>

                {/* Add step */}
                <div className="px-6 py-4 border-t border-slate-100">
                  {showAddStep ? (
                    <div className="space-y-3">
                      {/* Type toggle: Team or Person */}
                      <div className="relative inline-flex items-center gap-0.5 p-0.5 rounded-full bg-slate-100">
                        <motion.div
                          className="absolute top-0.5 bottom-0.5 rounded-full bg-white shadow-sm"
                          animate={{
                            left: addStepType === 'team' ? '2px' : '50%',
                            width: 'calc(50% - 3px)',
                          }}
                          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                        />
                        <button
                          type="button"
                          onClick={() => { setAddStepType('team'); setAddStepPersonId('') }}
                          className={`relative z-10 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                            addStepType === 'team' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          <Users className="w-3 h-3" />
                          Team
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAddStepType('person'); setAddStepTeamId('') }}
                          className={`relative z-10 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors cursor-pointer ${
                            addStepType === 'person' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          <ChevronRight className="w-3 h-3" />
                          Person
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {addStepType === 'team' ? (
                          <select
                            value={addStepTeamId}
                            onChange={(e) => setAddStepTeamId(e.target.value)}
                            className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 outline-none appearance-none"
                            autoFocus
                          >
                            <option value="">Select team...</option>
                            {teams
                              .filter(t => !selectedRule.steps.some(s => s.teamId === t.id && !s.assignedUser))
                              .map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                          </select>
                        ) : (
                          <select
                            value={addStepPersonId}
                            onChange={(e) => setAddStepPersonId(e.target.value)}
                            className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 outline-none appearance-none"
                            autoFocus
                          >
                            <option value="">Select person...</option>
                            {allMembers
                              .filter(m => !selectedRule.steps.some(s => s.assignedUser?.id === m.id))
                              .map(m => (
                                <option key={m.id} value={m.id}>
                                  {m.name || m.email} ({m.teamName})
                                </option>
                              ))}
                          </select>
                        )}
                        <button
                          onClick={() => addStep(selectedRule.id)}
                          disabled={addStepType === 'team' ? !addStepTeamId : !addStepPersonId}
                          className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-full hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
                        >
                          Add
                        </button>
                        <button onClick={() => { setShowAddStep(false); setAddStepTeamId(''); setAddStepPersonId(''); setAddStepType('team') }} className="p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer">
                          <X className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setShowAddStep(true); setAddStepTeamId('') }}
                      className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add approval step
                    </button>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 flex flex-col items-center justify-center text-center px-8"
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-500">Select a rule to configure</p>
                <p className="text-xs text-slate-400 mt-1">Click a condition on the left to edit its approval steps</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* AI Workflow Creator Modal */}
      <AnimatePresence>
        {showAICreator && (
          <AIWorkflowCreator
            isOpen={showAICreator}
            onClose={() => setShowAICreator(false)}
            context={{
              schools: schools.map(s => ({ id: s.id, name: s.name })),
              campuses: campuses.map(c => ({ id: c.id, name: c.name, schoolName: schools.find(s => s.id === c.schoolId)?.name })),
              categories: categories.map(c => ({ id: c.id, name: c.name })),
              teams: teams.map(t => ({ id: t.id, name: t.name })),
              members: allMembers.map(m => ({ id: m.id, name: m.name || m.email, teamName: m.teamName, avatar: m.avatar })),
            }}
            onRulesCreated={() => {
              queryClient.invalidateQueries({ queryKey: ['approval-rules'] })
              setShowAICreator(false)
              setShowAIDisclaimer(true)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Rule Card ──────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  isSelected,
  onClick,
  onDelete,
  categories = [],
  isDefault = false,
}: {
  rule: RuleData
  isSelected: boolean
  onClick: () => void
  onDelete: () => void
  categories?: CategoryData[]
  isDefault?: boolean
}) {
  const categoryName = rule.eventCategory
    ? categories.find(c => c.id === rule.eventCategory)?.name || rule.eventCategory
    : null

  const conditionParts = [
    rule.school && rule.school.name,
    rule.campus && rule.campus.name,
    categoryName,
    rule.minAttendance && `${rule.minAttendance}+ people`,
    rule.requiresResource && rule.requiresResource.toUpperCase(),
    rule.isOffCampus === true && 'Off-campus',
    rule.isOffCampus === false && 'On-campus',
  ].filter(Boolean)

  const stepCount = rule.steps.length

  return (
    <div
      className={`group relative rounded-xl transition-all cursor-pointer ${
        isSelected
          ? 'bg-white border border-slate-200 shadow-sm'
          : 'hover:bg-white/60 border border-transparent'
      }`}
      onClick={onClick}
    >
      <div className="px-3 py-2.5">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            {/* Rule name */}
            <p className="text-[13px] font-medium text-slate-800 truncate">{rule.name}</p>

            {/* Condition chips */}
            {!isDefault && conditionParts.length > 0 && (
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                <span className="text-[10px] font-medium text-amber-600">When</span>
                {conditionParts.map((part, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                    {part}
                  </span>
                ))}
              </div>
            )}

            {isDefault && (
              <p className="text-[10px] text-blue-500 mt-0.5">Applies when no other rules match</p>
            )}

            {!isDefault && conditionParts.length === 0 && (
              <p className="text-[10px] text-slate-400 mt-0.5 italic">No conditions set — click to configure</p>
            )}

            {/* Step preview */}
            {stepCount > 0 && (
              <div className="mt-1.5 flex items-center gap-1 flex-wrap">
                {rule.steps.slice(0, 3).map((step, i) => (
                  <span key={step.id} className="text-[10px] text-slate-500">
                    {i > 0 && <span className="text-slate-300 mr-1">→</span>}
                    {step.assignedUser
                      ? `${step.assignedUser.firstName || ''} ${step.assignedUser.lastName || ''}`.trim()
                      : step.team.name}
                  </span>
                ))}
                {stepCount > 3 && (
                  <span className="text-[10px] text-slate-300">+{stepCount - 3} more</span>
                )}
              </div>
            )}
            {stepCount === 0 && !isDefault && conditionParts.length > 0 && (
              <p className="mt-1 text-[10px] text-slate-300 italic">No steps yet</p>
            )}
          </div>

          {/* Delete button */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded-md transition-all flex-shrink-0 cursor-pointer"
          >
            <Trash2 className="w-3 h-3 text-slate-300 hover:text-red-500" />
          </button>
        </div>
      </div>
    </div>
  )
}
