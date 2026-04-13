'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, ArrowRight, Clock, Users, Trash2, User,
  ClipboardCheck, School, GitBranch, Shield, ChevronDown,
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
  assignedUserId: string | null
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

interface SchoolData {
  id: string
  name: string
  gradeLevel: string
  color: string
}

interface TeamData {
  id: string
  name: string
  slug: string
  members: { id: string; name: string; email: string }[]
}

// ─── API helpers ────────────────────────────────────────────────────────────

async function fetchRules() {
  const res = await fetchApi('/api/settings/approval-rules')
  return res as { rules: RuleData[]; schools: SchoolData[]; teams: TeamData[] }
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ApprovalRulesBuilder() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['approval-rules'], queryFn: fetchRules })
  const [showCreateRule, setShowCreateRule] = useState(false)
  const [newRule, setNewRule] = useState({ name: '', schoolId: '', isFinalApprover: false, isDefault: false })
  const [addStepRuleId, setAddStepRuleId] = useState<string | null>(null)
  const [newStepTeamId, setNewStepTeamId] = useState('')

  const rules = data?.rules ?? []
  const schools = data?.schools ?? []
  const teams = data?.teams ?? []

  const conditionalRules = rules.filter(r => !r.isFinalApprover && !r.isDefault)
  const defaultRules = rules.filter(r => r.isDefault)
  const finalRules = rules.filter(r => r.isFinalApprover)

  const mutateRules = useMutation({
    mutationFn: async (action: { method: string; url: string; body?: Record<string, unknown> }) => {
      const token = localStorage.getItem('auth-token')
      const res = await fetch(action.url, {
        method: action.method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: action.body ? JSON.stringify(action.body) : undefined,
      })
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approval-rules'] }),
  })

  const handleCreateRule = () => {
    mutateRules.mutate({
      method: 'POST',
      url: '/api/settings/approval-rules',
      body: {
        name: newRule.name || (newRule.schoolId ? schools.find(s => s.id === newRule.schoolId)?.name + ' Events' : 'New Rule'),
        schoolId: newRule.schoolId || null,
        isDefault: newRule.isDefault,
        isFinalApprover: newRule.isFinalApprover,
      },
    })
    setShowCreateRule(false)
    setNewRule({ name: '', schoolId: '', isFinalApprover: false, isDefault: false })
  }

  const handleDeleteRule = (ruleId: string) => {
    mutateRules.mutate({ method: 'DELETE', url: `/api/settings/approval-rules/${ruleId}` })
  }

  const handleAddStep = (ruleId: string) => {
    if (!newStepTeamId) return
    mutateRules.mutate({
      method: 'POST',
      url: `/api/settings/approval-rules/${ruleId}/steps`,
      body: { teamId: newStepTeamId },
    })
    setAddStepRuleId(null)
    setNewStepTeamId('')
  }

  const handleUpdateStep = (ruleId: string, stepId: string, data: Record<string, unknown>) => {
    mutateRules.mutate({
      method: 'PUT',
      url: `/api/settings/approval-rules/${ruleId}/steps`,
      body: { stepId, ...data },
    })
  }

  const handleRemoveStep = (ruleId: string, stepId: string) => {
    mutateRules.mutate({
      method: 'DELETE',
      url: `/api/settings/approval-rules/${ruleId}/steps`,
      body: { stepId },
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-white border border-slate-200 rounded-2xl p-5 h-32" />
        ))}
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
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">Approval Workflow</h3>
            <p className="text-sm text-slate-500 mt-0.5">Define conditional rules for who must approve events</p>
          </div>
          <button
            onClick={() => setShowCreateRule(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-full hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Rule
          </button>
        </div>

        {/* Flow summary */}
        <div className="mt-5 pt-5 border-t border-slate-200/60">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">1</div>
              <span>Event Created</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-amber-50 flex items-center justify-center text-[10px] font-bold text-amber-600">2</div>
              <span>Rules Evaluated</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-blue-50 flex items-center justify-center text-[10px] font-bold text-blue-600">3</div>
              <span>Teams Review</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-green-50 flex items-center justify-center text-[10px] font-bold text-green-600">4</div>
              <span>Confirmed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Create rule modal */}
      <AnimatePresence>
        {showCreateRule && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">New Approval Rule</h4>
                <button onClick={() => setShowCreateRule(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Rule Name</label>
                  <input
                    type="text"
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    placeholder="e.g., Elementary Events"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg hover:border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 outline-none transition-colors placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Applies to School</label>
                  <select
                    value={newRule.schoolId}
                    onChange={(e) => setNewRule({ ...newRule, schoolId: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg hover:border-slate-300 focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 outline-none transition-colors appearance-none"
                  >
                    <option value="">All Schools</option>
                    {schools.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.gradeLevel})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRule.isDefault}
                    onChange={(e) => setNewRule({ ...newRule, isDefault: e.target.checked, isFinalApprover: false })}
                    className="rounded border-slate-300"
                  />
                  Default rule (catch-all)
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRule.isFinalApprover}
                    onChange={(e) => setNewRule({ ...newRule, isFinalApprover: e.target.checked, isDefault: false })}
                    className="rounded border-slate-300"
                  />
                  Always required (final approver)
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleCreateRule}
                  className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-full hover:bg-slate-800 transition-colors"
                >
                  Create Rule
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conditional Rules */}
      {conditionalRules.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="w-4 h-4 text-amber-500" />
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Conditional Rules</h4>
          </div>
          <div className="space-y-3">
            {conditionalRules.map(rule => (
              <RuleCard
                key={rule.id}
                rule={rule}
                teams={teams}
                addStepRuleId={addStepRuleId}
                newStepTeamId={newStepTeamId}
                setAddStepRuleId={setAddStepRuleId}
                setNewStepTeamId={setNewStepTeamId}
                onAddStep={handleAddStep}
                onUpdateStep={handleUpdateStep}
                onRemoveStep={handleRemoveStep}
                onDeleteRule={handleDeleteRule}
              />
            ))}
          </div>
        </div>
      )}

      {/* Default Rules */}
      {defaultRules.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-blue-500" />
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Default Rules (when no condition matches)</h4>
          </div>
          <div className="space-y-3">
            {defaultRules.map(rule => (
              <RuleCard
                key={rule.id}
                rule={rule}
                teams={teams}
                addStepRuleId={addStepRuleId}
                newStepTeamId={newStepTeamId}
                setAddStepRuleId={setAddStepRuleId}
                setNewStepTeamId={setNewStepTeamId}
                onAddStep={handleAddStep}
                onUpdateStep={handleUpdateStep}
                onRemoveStep={handleRemoveStep}
                onDeleteRule={handleDeleteRule}
              />
            ))}
          </div>
        </div>
      )}

      {/* Final Approver Rules */}
      {finalRules.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-green-500" />
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Always Required (runs after all other rules)</h4>
          </div>
          <div className="space-y-3">
            {finalRules.map(rule => (
              <RuleCard
                key={rule.id}
                rule={rule}
                teams={teams}
                addStepRuleId={addStepRuleId}
                newStepTeamId={newStepTeamId}
                setAddStepRuleId={setAddStepRuleId}
                setNewStepTeamId={setNewStepTeamId}
                onAddStep={handleAddStep}
                onUpdateStep={handleUpdateStep}
                onRemoveStep={handleRemoveStep}
                onDeleteRule={handleDeleteRule}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {rules.length === 0 && (
        <div className="bg-white border border-slate-200 border-dashed rounded-2xl p-12 text-center">
          <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">No approval rules configured</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">Events will be auto-confirmed without review</p>
          <button
            onClick={() => setShowCreateRule(true)}
            className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-full hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-4 h-4 inline mr-1" /> Create First Rule
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Rule Card ──────────────────────────────────────────────────────────────

interface RuleCardProps {
  rule: RuleData
  teams: TeamData[]
  addStepRuleId: string | null
  newStepTeamId: string
  setAddStepRuleId: (id: string | null) => void
  setNewStepTeamId: (id: string) => void
  onAddStep: (ruleId: string) => void
  onUpdateStep: (ruleId: string, stepId: string, data: Record<string, unknown>) => void
  onRemoveStep: (ruleId: string, stepId: string) => void
  onDeleteRule: (ruleId: string) => void
}

function RuleCard({
  rule, teams, addStepRuleId, newStepTeamId,
  setAddStepRuleId, setNewStepTeamId,
  onAddStep, onUpdateStep, onRemoveStep, onDeleteRule,
}: RuleCardProps) {
  const conditionLabel = rule.isFinalApprover
    ? 'Always runs (final sign-off)'
    : rule.isDefault
      ? 'All events (catch-all)'
      : rule.school
        ? `Events at ${rule.school.name}`
        : rule.campus
          ? `Events at ${rule.campus.name} campus`
          : rule.eventCategory
            ? `${rule.eventCategory} events`
            : 'All events'

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Rule header */}
      <div className="px-5 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {rule.school && (
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: rule.school.color }} />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-slate-900">{rule.name}</h4>
              {rule.isFinalApprover && (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                  Final
                </span>
              )}
              {rule.isDefault && (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                  Default
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{conditionLabel}</p>
          </div>
        </div>
        <button
          onClick={() => onDeleteRule(rule.id)}
          className="p-2 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
          title="Delete rule"
        >
          <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" />
        </button>
      </div>

      {/* Steps */}
      {rule.steps.length > 0 && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {rule.steps.map((step, idx) => (
            <div key={step.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-600 flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{step.team.name}</p>
                  <p className="text-xs text-slate-400">
                    {step.assignedUser
                      ? `${step.assignedUser.firstName || ''} ${step.assignedUser.lastName || ''}`.trim() || step.assignedUser.email
                      : 'Entire team'}
                    {' · '}
                    {step.trigger === 'ALWAYS' ? 'Every event' : 'When resource needed'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-slate-100">
                  <button
                    onClick={() => onUpdateStep(rule.id, step.id, { mode: 'REQUIRED' })}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      step.mode === 'REQUIRED' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Must Approve
                  </button>
                  <button
                    onClick={() => onUpdateStep(rule.id, step.id, { mode: 'NOTIFICATION' })}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                      step.mode === 'NOTIFICATION' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Notify Only
                  </button>
                </div>
                <button
                  onClick={() => onRemoveStep(rule.id, step.id)}
                  className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add step */}
      <div className="border-t border-slate-100 px-5 py-3">
        {addStepRuleId === rule.id ? (
          <div className="flex items-center gap-2">
            <select
              value={newStepTeamId}
              onChange={(e) => setNewStepTeamId(e.target.value)}
              className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 outline-none appearance-none"
            >
              <option value="">Select team...</option>
              {teams.filter(t => !rule.steps.some(s => s.teamId === t.id)).map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              onClick={() => onAddStep(rule.id)}
              disabled={!newStepTeamId}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-full hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              Add
            </button>
            <button onClick={() => setAddStepRuleId(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setAddStepRuleId(rule.id); setNewStepTeamId('') }}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add approval step
          </button>
        )}
      </div>
    </div>
  )
}
