'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Trash2, ClipboardCheck, ChevronRight, Shield, Minus,
} from 'lucide-react'
import { fetchApi } from '@/lib/api-client'

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
  assignedUser: { id: string; firstName: string | null; lastName: string | null; email: string } | null
}

interface RuleData {
  id: string
  name: string
  description: string | null
  schoolId: string | null
  campusId: string | null
  eventCategory: string | null
  isDefault: boolean
  isFinalApprover: boolean
  isActive: boolean
  sortOrder: number
  school: { id: string; name: string; gradeLevel: string; color: string } | null
  campus: { id: string; name: string } | null
  steps: StepEntry[]
}

interface SchoolData { id: string; name: string; gradeLevel: string; color: string }
interface TeamData { id: string; name: string; slug: string; members: { id: string; name: string; email: string }[] }

async function fetchRules() {
  return fetchApi('/api/settings/approval-rules') as Promise<{ rules: RuleData[]; schools: SchoolData[]; teams: TeamData[] }>
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ApprovalRulesBuilder() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['approval-rules'], queryFn: fetchRules })
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)
  const [addStepTeamId, setAddStepTeamId] = useState('')
  const [showAddStep, setShowAddStep] = useState(false)

  const rules = data?.rules ?? []
  const schools = data?.schools ?? []
  const teams = data?.teams ?? []

  const conditionalRules = rules.filter(r => !r.isFinalApprover && !r.isDefault)
  const defaultRule = rules.find(r => r.isDefault)
  const alwaysRules = rules.filter(r => r.isFinalApprover)
  const selectedRule = rules.find(r => r.id === selectedRuleId) ?? null

  const mutate = useMutation({
    mutationFn: async (action: { method: string; url: string; body?: Record<string, unknown> }) => {
      const token = localStorage.getItem('auth-token')
      // Read CSRF token from cookie (required for state-changing requests)
      const csrfToken = document.cookie.split('; ').find(c => c.startsWith('csrf-token='))?.split('=')[1] || ''
      const res = await fetch(action.url, {
        method: action.method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        credentials: 'include',
        body: action.body ? JSON.stringify(action.body) : undefined,
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error?.message || 'Request failed')
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approval-rules'] }),
  })

  const addRule = (opts: { schoolId?: string; isDefault?: boolean; isFinalApprover?: boolean }) => {
    const name = opts.isFinalApprover
      ? 'Always Required'
      : opts.isDefault
        ? 'All Other Events'
        : opts.schoolId
          ? (schools.find(s => s.id === opts.schoolId)?.name || 'School') + ' Events'
          : 'New Condition'
    mutate.mutate({
      method: 'POST', url: '/api/settings/approval-rules',
      body: { name, ...opts },
    })
  }

  const deleteRule = (id: string) => {
    if (selectedRuleId === id) setSelectedRuleId(null)
    mutate.mutate({ method: 'DELETE', url: `/api/settings/approval-rules/${id}` })
  }

  const updateRule = (id: string, data: Record<string, unknown>) => {
    mutate.mutate({ method: 'PATCH', url: `/api/settings/approval-rules/${id}`, body: data })
  }

  const addStep = (ruleId: string, teamId: string) => {
    mutate.mutate({ method: 'POST', url: `/api/settings/approval-rules/${ruleId}/steps`, body: { teamId } })
    setShowAddStep(false)
    setAddStepTeamId('')
  }

  const updateStep = (ruleId: string, stepId: string, data: Record<string, unknown>) => {
    mutate.mutate({ method: 'PUT', url: `/api/settings/approval-rules/${ruleId}/steps`, body: { stepId, ...data } })
  }

  const removeStep = (ruleId: string, stepId: string) => {
    mutate.mutate({ method: 'DELETE', url: `/api/settings/approval-rules/${ruleId}/steps`, body: { stepId } })
  }

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

      {/* Two-column builder */}
      <div className="flex gap-0 border border-slate-200 rounded-2xl overflow-hidden bg-white min-h-[480px]">

        {/* ── Left panel: if/else tree ─────────────────────────────── */}
        <div className="w-80 flex-shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-100/50">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">When event is created</p>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {/* Conditional branches */}
            {conditionalRules.map((rule, idx) => (
              <TreeBranch
                key={rule.id}
                rule={rule}
                type={idx === 0 ? 'if' : 'else-if'}
                isSelected={selectedRuleId === rule.id}
                onClick={() => setSelectedRuleId(rule.id)}
                onDelete={() => deleteRule(rule.id)}
              />
            ))}

            {/* Default / else branch */}
            {defaultRule ? (
              <TreeBranch
                rule={defaultRule}
                type="else"
                isSelected={selectedRuleId === defaultRule.id}
                onClick={() => setSelectedRuleId(defaultRule.id)}
                onDelete={() => deleteRule(defaultRule.id)}
              />
            ) : conditionalRules.length > 0 ? (
              <button
                onClick={() => addRule({ isDefault: true })}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add else (catch-all)
              </button>
            ) : null}

            {/* Divider before "always" section */}
            {(conditionalRules.length > 0 || defaultRule) && (
              <div className="pt-2 pb-1">
                <div className="border-t border-slate-200" />
              </div>
            )}

            {/* Always-required rules */}
            {alwaysRules.map(rule => (
              <TreeBranch
                key={rule.id}
                rule={rule}
                type="always"
                isSelected={selectedRuleId === rule.id}
                onClick={() => setSelectedRuleId(rule.id)}
                onDelete={() => deleteRule(rule.id)}
              />
            ))}
          </div>

          {/* Bottom actions */}
          <div className="p-3 border-t border-slate-200 flex items-center gap-1">
            <button
              onClick={() => {
                // Add a conditional rule — pick the first unassigned school if any exist
                const usedSchoolIds = conditionalRules.map(r => r.schoolId).filter(Boolean)
                const unusedSchool = schools.find(s => !usedSchoolIds.includes(s.id))
                addRule(unusedSchool ? { schoolId: unusedSchool.id } : {})
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Add condition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            {!alwaysRules.length && (
              <button
                onClick={() => addRule({ isFinalApprover: true })}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Add always-required step"
              >
                <Shield className="w-3.5 h-3.5" /> Always
              </button>
            )}
            <button
              onClick={() => {
                // Remove last conditional rule
                const last = conditionalRules[conditionalRules.length - 1]
                if (last) deleteRule(last.id)
              }}
              disabled={conditionalRules.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none"
              title="Remove last condition"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
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
                    <div>
                      <input
                        type="text"
                        value={selectedRule.name}
                        onChange={(e) => updateRule(selectedRule.id, { name: e.target.value })}
                        className="text-sm font-semibold text-slate-900 bg-transparent border-none outline-none focus:ring-0 p-0 w-full"
                      />
                    </div>
                  </div>

                  {/* Condition selector */}
                  {!selectedRule.isFinalApprover && !selectedRule.isDefault && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-500">Condition:</span>
                      <span className="text-xs text-slate-400">School is</span>
                      <select
                        value={selectedRule.schoolId || ''}
                        onChange={(e) => updateRule(selectedRule.id, {
                          schoolId: e.target.value || null,
                          name: e.target.value
                            ? (schools.find(s => s.id === e.target.value)?.name || '') + ' Events'
                            : selectedRule.name,
                        })}
                        className="text-xs bg-white border border-slate-200 rounded-md px-2 py-1 focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 outline-none"
                      >
                        <option value="">Any school</option>
                        {schools.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
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
                </div>

                {/* Steps list */}
                <div className="flex-1 overflow-y-auto">
                  {selectedRule.steps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                      <p className="text-sm text-slate-400">No approval steps yet</p>
                      <p className="text-xs text-slate-300 mt-1">Add a team that must review events matching this condition</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {selectedRule.steps.map((step, idx) => (
                        <div key={step.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                          {/* Step number */}
                          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-600 flex-shrink-0">
                            {idx + 1}
                          </div>

                          {/* Step info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800">{step.team.name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {step.trigger === 'ALWAYS' ? 'Every event' : 'When resource needed'}
                              {step.assignedUser && (
                                <> · {step.assignedUser.firstName} {step.assignedUser.lastName}</>
                              )}
                            </p>
                          </div>

                          {/* Mode toggle */}
                          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-slate-100 flex-shrink-0">
                            <button
                              onClick={() => updateStep(selectedRule.id, step.id, { mode: 'REQUIRED' })}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                                step.mode === 'REQUIRED' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                              }`}
                            >
                              Must Approve
                            </button>
                            <button
                              onClick={() => updateStep(selectedRule.id, step.id, { mode: 'NOTIFICATION' })}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                                step.mode === 'NOTIFICATION' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                              }`}
                            >
                              Notify Only
                            </button>
                          </div>

                          {/* Trigger toggle */}
                          <select
                            value={step.trigger}
                            onChange={(e) => updateStep(selectedRule.id, step.id, { trigger: e.target.value })}
                            className="text-[10px] bg-white border border-slate-200 rounded-md px-1.5 py-1 focus:border-slate-900 outline-none flex-shrink-0"
                          >
                            <option value="ALWAYS">Always</option>
                            <option value="WHEN_RESOURCE_REQUESTED">If needed</option>
                          </select>

                          {/* Remove */}
                          <button
                            onClick={() => removeStep(selectedRule.id, step.id)}
                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5 text-slate-300 hover:text-red-500" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add step */}
                <div className="px-6 py-4 border-t border-slate-100">
                  {showAddStep ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={addStepTeamId}
                        onChange={(e) => setAddStepTeamId(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 outline-none appearance-none"
                        autoFocus
                      >
                        <option value="">Select team...</option>
                        {teams
                          .filter(t => !selectedRule.steps.some(s => s.teamId === t.id))
                          .map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                      </select>
                      <button
                        onClick={() => addStep(selectedRule.id, addStepTeamId)}
                        disabled={!addStepTeamId}
                        className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-full hover:bg-slate-800 disabled:opacity-40 transition-colors"
                      >
                        Add
                      </button>
                      <button onClick={() => { setShowAddStep(false); setAddStepTeamId('') }} className="p-1.5 hover:bg-slate-100 rounded-lg">
                        <X className="w-4 h-4 text-slate-400" />
                      </button>
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
    </div>
  )
}

// ─── Tree Branch Item ───────────────────────────────────────────────────────

function TreeBranch({
  rule,
  type,
  isSelected,
  onClick,
  onDelete,
}: {
  rule: RuleData
  type: 'if' | 'else-if' | 'else' | 'always'
  isSelected: boolean
  onClick: () => void
  onDelete: () => void
}) {
  const keyword = type === 'if' ? 'if' : type === 'else-if' ? 'else if' : type === 'else' ? 'else' : 'then always'
  const keywordColor = type === 'always'
    ? 'text-green-600'
    : type === 'else'
      ? 'text-blue-500'
      : 'text-amber-600'

  const conditionLabel = rule.school
    ? `school is "${rule.school.name}"`
    : rule.campus
      ? `campus is "${rule.campus.name}"`
      : rule.eventCategory
        ? `category is "${rule.eventCategory}"`
        : type === 'else'
          ? '(no conditions matched)'
          : type === 'always'
            ? '(runs for every event)'
            : 'any event'

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
      {/* Connector line */}
      {(type === 'else-if' || type === 'else') && (
        <div className="absolute -top-1 left-5 w-px h-1 bg-slate-300" />
      )}

      <div className="px-3 py-2.5">
        <div className="flex items-start gap-2">
          {/* Indent connector for actions */}
          <div className="flex flex-col items-center pt-0.5">
            <span className={`text-[11px] font-bold ${keywordColor}`}>{keyword}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-600 leading-relaxed">{conditionLabel}</p>
            {stepCount > 0 && (
              <div className="mt-1.5 space-y-0.5">
                {rule.steps.slice(0, 3).map((step, i) => (
                  <div key={step.id} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span className="text-slate-300">└</span>
                    <span className={step.mode === 'REQUIRED' ? 'text-slate-600' : 'text-slate-400'}>
                      {step.team.name}
                    </span>
                    {step.mode === 'NOTIFICATION' && (
                      <span className="text-slate-300">(notify)</span>
                    )}
                  </div>
                ))}
                {stepCount > 3 && (
                  <p className="text-[10px] text-slate-300 pl-4">+{stepCount - 3} more</p>
                )}
              </div>
            )}
            {stepCount === 0 && (
              <p className="mt-1 text-[10px] text-slate-300 italic">No steps — add actions →</p>
            )}
          </div>

          {/* Delete button */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded-md transition-all flex-shrink-0"
          >
            <Trash2 className="w-3 h-3 text-slate-300 hover:text-red-500" />
          </button>
        </div>
      </div>
    </div>
  )
}
