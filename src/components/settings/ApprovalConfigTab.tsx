'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, ArrowRight, AlertTriangle, Clock, Users,
  ClipboardCheck, Trash2, User,
} from 'lucide-react'
import { fetchApi } from '@/lib/api-client'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FlowEntry {
  id: string
  teamId: string
  teamName: string
  mode: string
  trigger: string
  resourceType: string | null
  escalationHours: number
  autoSkipIfNotNeeded: boolean
  sortOrder: number
  assignedUserId: string | null
  assignedUserName: string | null
}

interface TeamMember {
  id: string
  name: string
  email: string
  avatar: string | null
}

interface TeamWithMembers {
  id: string
  name: string
  slug: string
  members: TeamMember[]
}

// ─── Auto-detect resource type from team slug ───────────────────────────────

function detectResourceType(slug: string): string | null {
  if (slug.includes('av') || slug.includes('audio') || slug.includes('production')) return 'av'
  if (slug.includes('facility') || slug.includes('maintenance')) return 'facilities'
  if (slug.includes('custod') || slug.includes('clean')) return 'custodial'
  if (slug.includes('secur')) return 'security'
  if (slug.includes('athlet')) return 'athletic'
  return null
}

function detectTrigger(slug: string): 'ALWAYS' | 'WHEN_RESOURCE_REQUESTED' {
  return detectResourceType(slug) ? 'WHEN_RESOURCE_REQUESTED' : 'ALWAYS'
}

// ─── Flow Entry Card ────────────────────────────────────────────────────────

interface FlowEntryCardProps {
  entry: FlowEntry
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onRemove: (id: string) => void
}

function FlowEntryCard({ entry, onUpdate, onRemove }: FlowEntryCardProps) {
  const isRequired = entry.mode === 'REQUIRED'
  const assigneeName = entry.assignedUserName || 'Entire team'

  return (
    <div
      className={`bg-white border rounded-2xl overflow-hidden transition-all duration-200 ${
        isRequired ? 'border-slate-200 shadow-sm' : 'border-slate-200/80'
      }`}
    >
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-semibold text-slate-900">
                {entry.teamName}
              </h4>
              {isRequired ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                  Must Approve
                </span>
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  Notify Only
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {entry.assignedUserId ? (
                <><User className="w-3 h-3 inline-block mr-1 align-[-2px]" />{assigneeName}</>
              ) : (
                <><Users className="w-3 h-3 inline-block mr-1 align-[-2px]" />{assigneeName}</>
              )}
              {' · '}
              {entry.trigger === 'ALWAYS' ? 'Every event' : 'When resource needed'}
            </p>
          </div>

          {/* Mode toggle */}
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-slate-100 flex-shrink-0">
            <button
              onClick={() => onUpdate(entry.id, { mode: 'REQUIRED' })}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                isRequired ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Must Approve
            </button>
            <button
              onClick={() => onUpdate(entry.id, { mode: 'NOTIFICATION' })}
              className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                !isRequired ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Notify Only
            </button>
          </div>

          <button
            onClick={() => onRemove(entry.id)}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer flex-shrink-0"
            title="Remove from flow"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded config for Required */}
      {isRequired && (
        <div className="px-5 pb-4">
          <div className="rounded-xl px-4 py-3 flex items-center gap-3 bg-slate-50/80 border border-slate-100">
            <Clock className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
            <span className="text-[11px] font-medium text-slate-500">Remind after</span>
            <input
              type="number"
              value={entry.escalationHours}
              onChange={(e) => onUpdate(entry.id, { escalationHours: parseInt(e.target.value) || 72 })}
              min={1}
              max={720}
              className="w-16 px-2 py-1.5 rounded-lg text-[13px] outline-none text-center bg-white border border-slate-200 text-slate-900 focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition"
            />
            <span className="text-[11px] text-slate-500">hours with no response</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Add Team Modal ─────────────────────────────────────────────────────────

interface AddTeamModalProps {
  teams: TeamWithMembers[]
  onAdd: (data: { teamId: string; mode: string; trigger: string; resourceType?: string; assignedUserId?: string }) => void
  onClose: () => void
}

function AddTeamModal({ teams, onAdd, onClose }: AddTeamModalProps) {
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [assignTo, setAssignTo] = useState<'team' | 'person'>('team')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [mode, setMode] = useState<'REQUIRED' | 'NOTIFICATION'>('REQUIRED')

  const selectedTeam = teams.find((t) => t.id === selectedTeamId)

  const handleSubmit = () => {
    if (!selectedTeamId) return
    if (assignTo === 'person' && !selectedUserId) return

    const slug = selectedTeam?.slug ?? ''
    const trigger = detectTrigger(slug)
    const resourceType = detectResourceType(slug)

    onAdd({
      teamId: selectedTeamId,
      mode,
      trigger,
      resourceType: resourceType ?? undefined,
      assignedUserId: assignTo === 'person' ? selectedUserId : undefined,
    })
    onClose()
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.96 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          className="w-full max-w-md bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
            <h3 className="text-lg font-semibold text-slate-900">
              Add to Approval Flow
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Team */}
            <div>
              <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                Team
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => { setSelectedTeamId(e.target.value); setSelectedUserId(''); setAssignTo('team') }}
                className="mt-1.5 w-full px-3 py-2.5 rounded-xl text-sm cursor-pointer outline-none bg-slate-50 border border-slate-200 text-slate-900 focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition"
              >
                <option value="" className="text-slate-400">Select a team...</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Who specifically */}
            {selectedTeam && (
              <div>
                <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Who specifically?
                </label>
                <div className="flex gap-2 mt-1.5">
                  <button
                    onClick={() => { setAssignTo('team'); setSelectedUserId('') }}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      assignTo === 'team' ? 'bg-slate-200/80 text-slate-900' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Entire team
                  </button>
                  <button
                    onClick={() => setAssignTo('person')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      assignTo === 'person' ? 'bg-slate-200/80 text-slate-900' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    Specific person
                  </button>
                </div>

                {assignTo === 'person' && (
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="mt-2 w-full px-3 py-2.5 rounded-xl text-sm cursor-pointer outline-none bg-slate-50 border border-slate-200 text-slate-900 focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition"
                  >
                    <option value="" className="text-slate-400">Select a person...</option>
                    {selectedTeam.members.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Mode */}
            {selectedTeamId && (
              <div>
                <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  What should they do?
                </label>
                <div className="flex gap-2 mt-1.5">
                  <button
                    onClick={() => setMode('REQUIRED')}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer text-center ${
                      mode === 'REQUIRED' ? 'bg-slate-200/80 text-slate-900' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    Must approve event
                  </button>
                  <button
                    onClick={() => setMode('NOTIFICATION')}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer text-center ${
                      mode === 'NOTIFICATION' ? 'bg-slate-200/80 text-slate-900' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    Just get notified
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-full text-sm font-medium bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedTeamId || (assignTo === 'person' && !selectedUserId)}
              className="flex-1 px-4 py-2.5 rounded-full text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-40"
            >
              Add to Flow
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ApprovalConfigTab() {
  const queryClient = useQueryClient()
  const [showAddModal, setShowAddModal] = useState(false)

  const { data: flowData, isLoading } = useQuery<{ entries: FlowEntry[]; teams: TeamWithMembers[]; resourceTypes: unknown[] }>({
    queryKey: ['approval-flow'],
    queryFn: () => fetchApi('/api/settings/approval-flow'),
  })

  const entries = flowData?.entries ?? []
  const teams = flowData?.teams ?? []

  const addMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      fetchApi('/api/settings/approval-flow', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approval-flow'] }),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      fetchApi('/api/settings/approval-flow', { method: 'PUT', body: JSON.stringify({ id, ...data }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approval-flow'] }),
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) =>
      fetchApi('/api/settings/approval-flow', { method: 'DELETE', body: JSON.stringify({ id }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['approval-flow'] }),
  })

  const hasRequiredEntry = entries.some((e) => e.mode === 'REQUIRED')

  // Live preview
  const summary = useMemo(() => {
    const required = entries.filter((e) => e.mode === 'REQUIRED')
    const notify = entries.filter((e) => e.mode === 'NOTIFICATION')
    return { required, notify }
  }, [entries])

  return (
    <div className="space-y-6">
      <div className="ui-glass p-6">
        {/* Section header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Approval Config</h3>
            <p className="text-sm text-slate-500 mt-0.5">Configure which teams review events before they're confirmed</p>
          </div>
        </div>

        {/* Flow visualization */}
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-slate-50 border border-slate-100 mb-5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-200/80 flex items-center justify-center">
              <span className="text-[11px] font-bold text-slate-700">1</span>
            </div>
            <span className="text-xs font-medium text-slate-700">Event Created</span>
          </div>
          <ArrowRight className="w-4 h-4 flex-shrink-0 text-slate-300" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-200/80 flex items-center justify-center">
              <span className="text-[11px] font-bold text-slate-700">2</span>
            </div>
            <span className="text-xs font-medium text-slate-700">Teams Review</span>
          </div>
          <ArrowRight className="w-4 h-4 flex-shrink-0 text-slate-300" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-200/80 flex items-center justify-center">
              <span className="text-[11px] font-bold text-slate-700">3</span>
            </div>
            <span className="text-xs font-medium text-slate-700">Event Confirmed</span>
          </div>
        </div>

        {/* Warning */}
        {!isLoading && !hasRequiredEntry && entries.length > 0 && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 mb-5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-500" />
            <p className="text-[13px] font-medium text-red-800">
              No teams are set to "Must Approve" — events will skip review and be confirmed immediately.
            </p>
          </div>
        )}

        {/* Live preview */}
        {!isLoading && entries.length > 0 && (
          <div className="rounded-2xl px-5 py-4 bg-slate-50 border border-slate-100 mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              With your current settings
            </p>
            <p className="text-[13px] leading-relaxed text-slate-700">
              {summary.required.length > 0 ? (
                <>
                  Events need approval from{' '}
                  <strong className="text-slate-900">
                    {summary.required.map((e) =>
                      e.assignedUserName ? `${e.assignedUserName} (${e.teamName})` : e.teamName
                    ).join(' and ')}
                  </strong>
                  {summary.required.some((e) => e.trigger === 'WHEN_RESOURCE_REQUESTED')
                    ? ' (some only when their resource is needed)'
                    : ''
                  }.{' '}
                </>
              ) : (
                <>Events will be auto-confirmed with no review. </>
              )}
              {summary.notify.length > 0 && (
                <>
                  <strong className="text-slate-900">
                    {summary.notify.map((e) =>
                      e.assignedUserName ? `${e.assignedUserName} (${e.teamName})` : e.teamName
                    ).join(' and ')}
                  </strong>
                  {' '}will be notified but won't block confirmation.
                </>
              )}
            </p>
          </div>
        )}

        {/* Flow entries */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="w-14 h-14 rounded-2xl bg-slate-200/80 flex items-center justify-center mx-auto mb-4">
              <Users className="w-7 h-7 text-slate-500" strokeWidth={1.75} />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">No teams in the approval flow</p>
            <p className="text-xs text-slate-500 mb-5 max-w-xs mx-auto">
              Events will be confirmed immediately. Add a team to require approval before events go live.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
              Add First Team
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <FlowEntryCard
                key={entry.id}
                entry={entry}
                onUpdate={(id, data) => updateMutation.mutate({ id, ...data })}
                onRemove={(id) => removeMutation.mutate(id)}
              />
            ))}
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-medium border-2 border-dashed border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              Add Team
            </button>
          </div>
        )}
      </div>

      {/* Add modal */}
      <AnimatePresence>
        {showAddModal && (
          <AddTeamModal
            teams={teams}
            onAdd={(data) => addMutation.mutate(data)}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
