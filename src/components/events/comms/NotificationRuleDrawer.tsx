'use client'

/**
 * NotificationRuleDrawer
 *
 * Drawer for creating and editing notification rules with AI-draft support.
 * Manages the DRAFT → PENDING_APPROVAL → APPROVED → SENT lifecycle.
 *
 * Props:
 *   eventProjectId — ID of the event project
 *   rule           — Existing rule (edit mode) or undefined (create mode)
 *   eventTitle     — Used for AI draft context
 *   eventDate      — Used for AI draft context and date preview
 *   onClose        — Called when drawer should close
 */

import { useState, useEffect } from 'react'
import { Sparkles, Clock, Filter, Zap, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import DetailDrawer from '@/components/DetailDrawer'
import { useNotificationMutations, useAIDraft } from '@/lib/hooks/useNotificationRules'
import {
  CONDITION_TYPES,
  ACTION_TYPES,
} from '@/lib/types/notification-orchestration'
import type { NotificationRuleRow, NotificationRuleInput } from '@/lib/types/notification-orchestration'

// ─── Types ─────────────────────────────────────────────────────────────────────

type TriggerType = 'DATE_BASED' | 'CONDITION_BASED' | 'ACTION_TRIGGERED'
type TargetAudience = 'all' | 'registered' | 'incomplete_docs' | 'unpaid'

interface NotificationRuleDrawerProps {
  eventProjectId: string
  rule?: NotificationRuleRow
  eventTitle: string
  eventDate: Date
  onClose: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AUDIENCE_OPTIONS: { value: TargetAudience; label: string }[] = [
  { value: 'all', label: 'All Registrants' },
  { value: 'registered', label: 'Confirmed Only' },
  { value: 'incomplete_docs', label: 'Incomplete Documents' },
  { value: 'unpaid', label: 'Unpaid' },
]

const TRIGGER_TABS: { id: TriggerType; label: string; icon: typeof Clock }[] = [
  { id: 'DATE_BASED', label: 'Date-based', icon: Clock },
  { id: 'CONDITION_BASED', label: 'Condition-based', icon: Filter },
  { id: 'ACTION_TRIGGERED', label: 'Action-triggered', icon: Zap },
]

// ─── Field helpers ────────────────────────────────────────────────────────────

function computeScheduledDate(eventDate: Date, offsetDays: number): string {
  const d = new Date(eventDate)
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTriggerDescription(triggerType: TriggerType, offsetDays: number, beforeAfter: 'before' | 'after'): string {
  if (triggerType !== 'DATE_BASED') return ''
  if (offsetDays === 0) return 'Day of event'
  return `${offsetDays} day${offsetDays !== 1 ? 's' : ''} ${beforeAfter} event`
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
      {children}
    </h4>
  )
}

// ─── Input field ─────────────────────────────────────────────────────────────

function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-700 mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: NotificationRuleRow['status'] }) {
  const configs = {
    DRAFT: { icon: Clock, cls: 'bg-slate-100 text-slate-600', label: 'Draft' },
    PENDING_APPROVAL: { icon: AlertCircle, cls: 'bg-amber-100 text-amber-700', label: 'Pending Approval' },
    APPROVED: { icon: CheckCircle, cls: 'bg-blue-100 text-blue-700', label: 'Approved — queued' },
    SENT: { icon: CheckCircle, cls: 'bg-green-100 text-green-700', label: 'Sent' },
    CANCELLED: { icon: XCircle, cls: 'bg-red-100 text-red-500', label: 'Cancelled' },
  }
  const config = configs[status] ?? configs.DRAFT
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.cls}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function NotificationRuleDrawer({
  eventProjectId,
  rule,
  eventTitle,
  eventDate,
  onClose,
}: NotificationRuleDrawerProps) {
  const isEditMode = !!rule
  const isReadOnly = rule?.status === 'SENT' || rule?.status === 'CANCELLED'

  const mutations = useNotificationMutations(eventProjectId)
  const aiDraft = useAIDraft(eventProjectId)

  // ── Form state ────────────────────────────────────────────────────────────

  const [triggerType, setTriggerType] = useState<TriggerType>(
    rule?.triggerType ?? 'DATE_BASED'
  )
  const [label, setLabel] = useState(rule?.label ?? '')
  const [offsetDays, setOffsetDays] = useState(Math.abs(rule?.offsetDays ?? 7))
  const [beforeAfter, setBeforeAfter] = useState<'before' | 'after'>(
    (rule?.offsetDays ?? -7) >= 0 ? 'after' : 'before'
  )
  const [conditionType, setConditionType] = useState(rule?.conditionType ?? CONDITION_TYPES[0].key)
  const [conditionThresholdDays, setConditionThresholdDays] = useState(
    rule?.conditionThresholdDays ?? 3
  )
  const [actionType, setActionType] = useState(rule?.actionType ?? ACTION_TYPES[0].key)
  const [targetAudience, setTargetAudience] = useState<TargetAudience>(
    (rule?.targetAudience as TargetAudience) ?? 'all'
  )
  const [subject, setSubject] = useState(rule?.subject ?? '')
  const [messageBody, setMessageBody] = useState(rule?.messageBody ?? '')
  const [isAIDrafted, setIsAIDrafted] = useState(rule?.isAIDrafted ?? false)
  const [error, setError] = useState<string | null>(null)

  // Reset AI drafted badge when content is manually edited
  const handleSubjectChange = (v: string) => { setSubject(v); setIsAIDrafted(false) }
  const handleBodyChange = (v: string) => { setMessageBody(v); setIsAIDrafted(false) }

  // ── Computed values ───────────────────────────────────────────────────────

  const computedOffsetDays = beforeAfter === 'before' ? -offsetDays : offsetDays
  const scheduledDatePreview =
    triggerType === 'DATE_BASED'
      ? computeScheduledDate(eventDate, computedOffsetDays)
      : null

  // ── Build payload ─────────────────────────────────────────────────────────

  function buildPayload(): NotificationRuleInput {
    const base = {
      triggerType,
      label: label.trim(),
      targetAudience,
      subject: subject.trim(),
      messageBody: messageBody.trim(),
    }
    if (triggerType === 'DATE_BASED') {
      return { ...base, offsetDays: computedOffsetDays }
    }
    if (triggerType === 'CONDITION_BASED') {
      return { ...base, conditionType, conditionThresholdDays }
    }
    return { ...base, actionType }
  }

  function validate(): boolean {
    if (!label.trim()) { setError('Label is required'); return false }
    if (!subject.trim()) { setError('Subject is required'); return false }
    if (!messageBody.trim()) { setError('Message body is required'); return false }
    setError(null)
    return true
  }

  // ── AI draft ──────────────────────────────────────────────────────────────

  async function handleAIDraft() {
    const triggerDescription =
      triggerType === 'DATE_BASED'
        ? formatTriggerDescription(triggerType, offsetDays, beforeAfter)
        : triggerType === 'CONDITION_BASED'
          ? `When ${CONDITION_TYPES.find(c => c.key === conditionType)?.label ?? conditionType}`
          : `When ${ACTION_TYPES.find(a => a.key === actionType)?.label ?? actionType}`

    try {
      const draft = await aiDraft.mutateAsync({
        eventTitle,
        eventDate: eventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        triggerType: triggerDescription,
        targetAudience: AUDIENCE_OPTIONS.find(o => o.value === targetAudience)?.label ?? targetAudience,
      })
      setSubject(draft.subject)
      setMessageBody(draft.body)
      setIsAIDrafted(true)
    } catch {
      setError('AI drafting is currently unavailable. Please write the message manually.')
    }
  }

  // ── Mutations ─────────────────────────────────────────────────────────────

  async function handleSaveDraft() {
    if (!validate()) return
    try {
      if (isEditMode && rule) {
        await mutations.updateRule.mutateAsync({ ruleId: rule.id, data: buildPayload() })
      } else {
        await mutations.createRule.mutateAsync(buildPayload())
      }
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    }
  }

  async function handleSubmitForApproval() {
    if (!validate()) return
    try {
      // Save changes first if in edit mode
      if (isEditMode && rule) {
        await mutations.updateRule.mutateAsync({ ruleId: rule.id, data: buildPayload() })
      } else {
        // Create first, then submit
        const created = await mutations.createRule.mutateAsync(buildPayload())
        await mutations.submitForApproval.mutateAsync(created.id)
        onClose()
        return
      }
      await mutations.submitForApproval.mutateAsync(rule!.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit')
    }
  }

  async function handleApprove() {
    if (!rule) return
    try {
      await mutations.approveRule.mutateAsync(rule.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to approve')
    }
  }

  async function handleCancel() {
    if (!rule) return
    try {
      await mutations.cancelRule.mutateAsync(rule.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel')
    }
  }

  const isMutating =
    mutations.createRule.isPending ||
    mutations.updateRule.isPending ||
    mutations.submitForApproval.isPending ||
    mutations.approveRule.isPending ||
    mutations.cancelRule.isPending

  // ── Footer ────────────────────────────────────────────────────────────────

  function renderFooter() {
    if (!rule) {
      // Create mode
      return (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isMutating}
            className="flex-1 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
          >
            {isMutating ? 'Saving...' : 'Save as Draft'}
          </button>
          <button
            type="button"
            onClick={handleSubmitForApproval}
            disabled={isMutating}
            className="flex-1 py-2.5 rounded-full border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
          >
            Submit for Approval
          </button>
        </div>
      )
    }

    if (rule.status === 'DRAFT') {
      return (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isMutating}
            className="flex-1 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
          >
            {isMutating ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={handleSubmitForApproval}
            disabled={isMutating}
            className="flex-1 py-2.5 rounded-full border border-indigo-200 text-indigo-700 bg-indigo-50 text-sm font-medium hover:bg-indigo-100 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
          >
            Submit for Approval
          </button>
        </div>
      )
    }

    if (rule.status === 'PENDING_APPROVAL') {
      return (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleApprove}
            disabled={isMutating}
            className="flex-1 py-2.5 rounded-full bg-green-600 text-white text-sm font-medium hover:bg-green-700 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
          >
            {isMutating ? 'Approving...' : 'Approve & Queue'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isMutating}
            className="py-2.5 px-4 rounded-full border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )
    }

    if (rule.status === 'APPROVED') {
      return (
        <button
          type="button"
          onClick={handleCancel}
          disabled={isMutating}
          className="w-full py-2.5 rounded-full border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
        >
          {isMutating ? 'Cancelling...' : 'Cancel Notification'}
        </button>
      )
    }

    // SENT or CANCELLED — no action buttons
    return null
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const drawerTitle = isEditMode ? 'Edit Notification Rule' : 'New Notification Rule'

  return (
    <DetailDrawer
      isOpen
      onClose={onClose}
      title={drawerTitle}
      width="lg"
      footer={renderFooter() ?? undefined}
    >
      <div className="space-y-6 py-2">
        {/* Status badge (edit mode) */}
        {rule && (
          <div className="flex items-center gap-2">
            <StatusBadge status={rule.status} />
            {rule.sentAt && (
              <span className="text-xs text-slate-400">
                Sent {new Date(rule.sentAt).toLocaleDateString()}
              </span>
            )}
          </div>
        )}

        {/* ── Section 1: Trigger Configuration ───────────────────────────── */}
        <section>
          <SectionLabel>Trigger Configuration</SectionLabel>

          {/* Trigger type segmented control */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl mb-4">
            {TRIGGER_TABS.map(({ id, label: tabLabel, icon: Icon }) => (
              <button
                key={id}
                type="button"
                disabled={isReadOnly}
                onClick={() => setTriggerType(id)}
                className={`
                  flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium
                  transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed
                  ${triggerType === id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                  }
                `}
              >
                <Icon className="w-3 h-3" />
                <span className="hidden sm:inline">{tabLabel}</span>
              </button>
            ))}
          </div>

          {/* Date-based config */}
          {triggerType === 'DATE_BASED' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 whitespace-nowrap">Send</span>
                <input
                  type="number"
                  id="offsetDays"
                  min={0}
                  max={365}
                  value={offsetDays}
                  onChange={(e) => setOffsetDays(Number(e.target.value))}
                  disabled={isReadOnly}
                  className="w-16 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-50"
                />
                <span className="text-sm text-slate-600">days</span>
                <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg">
                  {(['before', 'after'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      disabled={isReadOnly}
                      onClick={() => setBeforeAfter(opt)}
                      className={`
                        px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer disabled:cursor-not-allowed
                        ${beforeAfter === opt ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}
                      `}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <span className="text-sm text-slate-600 whitespace-nowrap">event</span>
              </div>
              {scheduledDatePreview && (
                <p className="text-xs text-indigo-600 font-medium">
                  Scheduled: {scheduledDatePreview}
                </p>
              )}
            </div>
          )}

          {/* Condition-based config */}
          {triggerType === 'CONDITION_BASED' && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 flex-wrap">
                <span className="text-sm text-slate-600 whitespace-nowrap pt-2">If</span>
                <select
                  id="conditionType"
                  value={conditionType}
                  onChange={(e) => setConditionType(e.target.value)}
                  disabled={isReadOnly}
                  className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white disabled:bg-slate-50 cursor-pointer"
                >
                  {CONDITION_TYPES.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 whitespace-nowrap">is true</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={conditionThresholdDays}
                  onChange={(e) => setConditionThresholdDays(Number(e.target.value))}
                  disabled={isReadOnly}
                  className="w-16 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-50"
                />
                <span className="text-sm text-slate-600">days before event, send notification</span>
              </div>
            </div>
          )}

          {/* Action-triggered config */}
          {triggerType === 'ACTION_TRIGGERED' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600 whitespace-nowrap">Send immediately when</span>
              <select
                id="actionType"
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                disabled={isReadOnly}
                className="flex-1 px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white disabled:bg-slate-50 cursor-pointer"
              >
                {ACTION_TYPES.map((a) => (
                  <option key={a.key} value={a.key}>{a.label}</option>
                ))}
              </select>
            </div>
          )}
        </section>

        {/* ── Section 2: Audience ─────────────────────────────────────────── */}
        <section>
          <SectionLabel>Audience</SectionLabel>
          <Field label="Target Audience" htmlFor="targetAudience">
            <select
              id="targetAudience"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value as TargetAudience)}
              disabled={isReadOnly}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white disabled:bg-slate-50 cursor-pointer"
            >
              {AUDIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
        </section>

        {/* ── Section 3: Message Content ──────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Message Content</SectionLabel>
            {!isReadOnly && (
              <button
                type="button"
                onClick={handleAIDraft}
                disabled={aiDraft.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-medium hover:from-blue-600 hover:to-indigo-600 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-70"
              >
                {aiDraft.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                {aiDraft.isPending ? 'Drafting...' : 'AI Draft'}
              </button>
            )}
          </div>

          <div className="space-y-3">
            <Field label="Rule Label" htmlFor="label" hint="Short name shown on the timeline">
              <input
                id="label"
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={isReadOnly}
                placeholder="e.g. 7-day reminder"
                maxLength={200}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-50"
              />
            </Field>

            <Field label="Subject" htmlFor="subject">
              <div className="relative">
                <input
                  id="subject"
                  type="text"
                  value={subject}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  disabled={isReadOnly}
                  placeholder="Notification subject line"
                  maxLength={500}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-50 pr-24"
                />
                {isAIDrafted && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-blue-100 to-indigo-100 text-indigo-700 whitespace-nowrap">
                    AI-generated
                  </span>
                )}
              </div>
            </Field>

            <Field label="Message Body" htmlFor="messageBody">
              <textarea
                id="messageBody"
                value={messageBody}
                onChange={(e) => handleBodyChange(e.target.value)}
                disabled={isReadOnly}
                placeholder="Write your message here, or click AI Draft to generate one..."
                rows={6}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-slate-50 resize-none"
              />
            </Field>
          </div>
        </section>

        {/* ── Message preview ─────────────────────────────────────────────── */}
        {subject && (
          <section>
            <SectionLabel>Preview</SectionLabel>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'linear-gradient(135deg, #3B82F6, #6366F1)' }}
                >
                  <span className="text-white text-xs font-bold">L</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-900">{subject || 'Subject line'}</p>
                  {messageBody && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-3 whitespace-pre-line">
                      {messageBody}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}
      </div>
    </DetailDrawer>
  )
}
