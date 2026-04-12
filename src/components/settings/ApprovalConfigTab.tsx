'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, ArrowRight, AlertTriangle, Clock, Users,
  CheckCircle2, Trash2, User,
} from 'lucide-react'
import {
  SURFACE,
  BORDER,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  WARM_CHIP,
  HAIRLINE,
  CARD_SHADOW,
} from '@/lib/design/warm-tokens'
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
      className="rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        backgroundColor: SURFACE,
        border: `1px solid ${isRequired ? 'rgba(17, 15, 10, 0.1)' : BORDER}`,
        boxShadow: isRequired ? CARD_SHADOW : 'none',
      }}
    >
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4
                className="text-[14px] font-semibold"
                style={{ color: TEXT_PRIMARY, letterSpacing: '-0.01em' }}
              >
                {entry.teamName}
              </h4>
              {isRequired ? (
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.04em] px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: '#e8e3d9', color: TEXT_PRIMARY }}
                >
                  Must Approve
                </span>
              ) : (
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.04em] px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: WARM_CHIP, color: TEXT_SECONDARY }}
                >
                  Notify Only
                </span>
              )}
            </div>
            <p className="text-[12px] mt-0.5" style={{ color: TEXT_SECONDARY }}>
              {entry.assignedUserId ? (
                <><User className="w-3 h-3 inline-block mr-1" style={{ verticalAlign: '-2px' }} />{assigneeName}</>
              ) : (
                <><Users className="w-3 h-3 inline-block mr-1" style={{ verticalAlign: '-2px' }} />{assigneeName}</>
              )}
              {' · '}
              {entry.trigger === 'ALWAYS'
                ? 'Every event'
                : 'When resource needed'
              }
            </p>
          </div>

          {/* Mode toggle */}
          <div
            className="inline-flex items-center gap-0.5 p-0.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: WARM_CHIP }}
          >
            <button
              onClick={() => onUpdate(entry.id, { mode: 'REQUIRED' })}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap"
              style={{
                backgroundColor: isRequired ? '#ffffff' : 'transparent',
                color: isRequired ? TEXT_PRIMARY : TEXT_MUTED,
                boxShadow: isRequired ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Must Approve
            </button>
            <button
              onClick={() => onUpdate(entry.id, { mode: 'NOTIFICATION' })}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap"
              style={{
                backgroundColor: !isRequired ? '#ffffff' : 'transparent',
                color: !isRequired ? TEXT_PRIMARY : TEXT_MUTED,
                boxShadow: !isRequired ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Notify Only
            </button>
          </div>

          <button
            onClick={() => onRemove(entry.id)}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
            style={{ color: TEXT_MUTED }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = WARM_CHIP; e.currentTarget.style.color = TEXT_PRIMARY }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = TEXT_MUTED }}
            title="Remove from flow"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded config for Required */}
      {isRequired && (
        <div className="px-5 pb-4">
          <div
            className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ backgroundColor: 'rgba(255,255,255,0.7)', border: `1px solid ${HAIRLINE}` }}
          >
            <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: TEXT_MUTED }} />
            <span className="text-[11px] font-medium" style={{ color: TEXT_SECONDARY }}>
              Remind after
            </span>
            <input
              type="number"
              value={entry.escalationHours}
              onChange={(e) => onUpdate(entry.id, { escalationHours: parseInt(e.target.value) || 72 })}
              min={1}
              max={720}
              className="w-16 px-2 py-1.5 rounded-lg text-[13px] outline-none text-center"
              style={{ backgroundColor: WARM_CHIP, color: TEXT_PRIMARY, border: '1px solid transparent' }}
            />
            <span className="text-[11px]" style={{ color: TEXT_SECONDARY }}>hours with no response</span>
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
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(17, 15, 10, 0.3)' }}
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
          className="w-full max-w-md rounded-2xl overflow-hidden"
          style={{ backgroundColor: SURFACE, border: `1px solid ${BORDER}`, boxShadow: CARD_SHADOW }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
            <h3 className="text-[17px] font-semibold" style={{ color: TEXT_PRIMARY, letterSpacing: '-0.015em' }}>
              Add to Approval Flow
            </h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              style={{ color: TEXT_SECONDARY }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = WARM_CHIP)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Team */}
            <div>
              <label className="text-[12px] font-medium" style={{ color: TEXT_SECONDARY }}>
                Team
              </label>
              <select
                value={selectedTeamId}
                onChange={(e) => { setSelectedTeamId(e.target.value); setSelectedUserId(''); setAssignTo('team') }}
                className="mt-1.5 w-full px-3 py-2.5 rounded-xl text-[13px] cursor-pointer outline-none"
                style={{ backgroundColor: WARM_CHIP, color: selectedTeamId ? TEXT_PRIMARY : TEXT_MUTED, border: '1px solid transparent' }}
              >
                <option value="">Select a team...</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Who specifically */}
            {selectedTeam && (
              <div>
                <label className="text-[12px] font-medium" style={{ color: TEXT_SECONDARY }}>
                  Who specifically?
                </label>
                <div className="flex gap-2 mt-1.5">
                  <button
                    onClick={() => { setAssignTo('team'); setSelectedUserId('') }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-colors cursor-pointer"
                    style={{
                      backgroundColor: assignTo === 'team' ? '#e8e3d9' : WARM_CHIP,
                      color: assignTo === 'team' ? TEXT_PRIMARY : TEXT_SECONDARY,
                    }}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Entire team
                  </button>
                  <button
                    onClick={() => setAssignTo('person')}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-colors cursor-pointer"
                    style={{
                      backgroundColor: assignTo === 'person' ? '#e8e3d9' : WARM_CHIP,
                      color: assignTo === 'person' ? TEXT_PRIMARY : TEXT_SECONDARY,
                    }}
                  >
                    <User className="w-3.5 h-3.5" />
                    Specific person
                  </button>
                </div>

                {assignTo === 'person' && (
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="mt-2 w-full px-3 py-2.5 rounded-xl text-[13px] cursor-pointer outline-none"
                    style={{ backgroundColor: WARM_CHIP, color: selectedUserId ? TEXT_PRIMARY : TEXT_MUTED, border: '1px solid transparent' }}
                  >
                    <option value="">Select a person...</option>
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
                <label className="text-[12px] font-medium" style={{ color: TEXT_SECONDARY }}>
                  What should they do?
                </label>
                <div className="flex gap-2 mt-1.5">
                  <button
                    onClick={() => setMode('REQUIRED')}
                    className="flex-1 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-colors cursor-pointer text-center"
                    style={{
                      backgroundColor: mode === 'REQUIRED' ? '#e8e3d9' : WARM_CHIP,
                      color: mode === 'REQUIRED' ? TEXT_PRIMARY : TEXT_SECONDARY,
                    }}
                  >
                    Must approve event
                  </button>
                  <button
                    onClick={() => setMode('NOTIFICATION')}
                    className="flex-1 px-3 py-2.5 rounded-xl text-[12px] font-medium transition-colors cursor-pointer text-center"
                    style={{
                      backgroundColor: mode === 'NOTIFICATION' ? '#e8e3d9' : WARM_CHIP,
                      color: mode === 'NOTIFICATION' ? TEXT_PRIMARY : TEXT_SECONDARY,
                    }}
                  >
                    Just get notified
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 px-6 py-4" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-full text-[13px] font-medium transition-colors cursor-pointer"
              style={{ backgroundColor: WARM_CHIP, color: TEXT_SECONDARY }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedTeamId || (assignTo === 'person' && !selectedUserId)}
              className="flex-1 px-4 py-2.5 rounded-full text-[13px] font-semibold transition-all cursor-pointer disabled:opacity-40"
              style={{ backgroundColor: TEXT_PRIMARY, color: '#ffffff' }}
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
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: TEXT_PRIMARY, letterSpacing: '-0.02em' }}>
            Event Approval Flow
          </h2>
          <p className="text-[13px] mt-1.5 max-w-xl" style={{ color: TEXT_SECONDARY }}>
            When someone creates an event, these teams review it before it's confirmed.
            Add your teams below and choose who must approve.
          </p>
        </div>

        <div className="flex items-center gap-3 px-5 py-3.5 rounded-2xl" style={{ backgroundColor: WARM_CHIP }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#e8e3d9' }}>
              <span className="text-[11px] font-bold" style={{ color: TEXT_PRIMARY }}>1</span>
            </div>
            <span className="text-[12px] font-medium" style={{ color: TEXT_PRIMARY }}>Event Created</span>
          </div>
          <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#e8e3d9' }}>
              <span className="text-[11px] font-bold" style={{ color: TEXT_PRIMARY }}>2</span>
            </div>
            <span className="text-[12px] font-medium" style={{ color: TEXT_PRIMARY }}>Teams Review</span>
          </div>
          <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: TEXT_MUTED }} />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#e8e3d9' }}>
              <span className="text-[11px] font-bold" style={{ color: TEXT_PRIMARY }}>3</span>
            </div>
            <span className="text-[12px] font-medium" style={{ color: TEXT_PRIMARY }}>Event Confirmed</span>
          </div>
        </div>
      </div>

      {/* Warning */}
      {!isLoading && !hasRequiredEntry && entries.length > 0 && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: '#dc2626' }} />
          <p className="text-[13px] font-medium" style={{ color: '#991b1b' }}>
            No teams are set to "Must Approve" — events will skip review and be confirmed immediately.
          </p>
        </div>
      )}

      {/* Live preview — above the entries so the admin sees the summary first */}
      {!isLoading && entries.length > 0 && (
        <div className="rounded-2xl px-5 py-4" style={{ backgroundColor: WARM_CHIP, border: `1px solid ${HAIRLINE}` }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: TEXT_MUTED }}>
            With your current settings
          </p>
          <p className="text-[13px] leading-relaxed" style={{ color: TEXT_PRIMARY }}>
            {summary.required.length > 0 ? (
              <>
                Events need approval from{' '}
                <strong>
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
                <strong>
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
          {[1, 2].map((i) => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ backgroundColor: WARM_CHIP }} />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 rounded-2xl" style={{ backgroundColor: WARM_CHIP, border: `1px solid ${HAIRLINE}` }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#e8e3d9' }}>
            <Users className="w-7 h-7" strokeWidth={1.75} style={{ color: TEXT_PRIMARY }} />
          </div>
          <p className="text-[14px] font-semibold mb-1" style={{ color: TEXT_PRIMARY }}>No teams in the approval flow</p>
          <p className="text-[12px] mb-5 max-w-xs mx-auto" style={{ color: TEXT_SECONDARY }}>
            Events will be confirmed immediately. Add a team to require approval before events go live.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[13px] font-semibold cursor-pointer hover:-translate-y-px transition-all"
            style={{ backgroundColor: TEXT_PRIMARY, color: '#ffffff', boxShadow: CARD_SHADOW }}
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
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[13px] font-medium transition-colors cursor-pointer"
            style={{ border: `1px dashed ${BORDER}`, color: TEXT_SECONDARY }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = WARM_CHIP; e.currentTarget.style.borderStyle = 'solid' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderStyle = 'dashed' }}
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            Add Team
          </button>
        </div>
      )}

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
