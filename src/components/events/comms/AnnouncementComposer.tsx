'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, ChevronDown, AlertCircle, Loader2 } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { useCreateAnnouncement } from '@/lib/hooks/useEventComms'
import { useQuery } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import type { EventGroupWithAssignments } from '@/lib/types/events-phase21'
import type { AnnouncementAudience } from '@/lib/types/events-phase21'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AnnouncementComposerProps {
  eventProjectId: string
}

type AudienceOption = {
  value: AnnouncementAudience
  label: string
  description: string
}

const AUDIENCE_OPTIONS: AudienceOption[] = [
  { value: 'ALL', label: 'All Registrants', description: 'Everyone who is registered' },
  { value: 'GROUP', label: 'Specific Group', description: 'Members of a selected group' },
  { value: 'INCOMPLETE_DOCS', label: 'Incomplete Documents', description: 'Registrants with missing required documents' },
  { value: 'PAID_ONLY', label: 'Paid Only', description: 'Registrants who have paid in full' },
]

// ─── Confirmation Dialog ────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  audience: string
  groupName?: string
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}

function ConfirmDialog({ audience, groupName, onConfirm, onCancel, isPending }: ConfirmDialogProps) {
  const audienceLabel = audience === 'GROUP' && groupName
    ? `members of "${groupName}"`
    : AUDIENCE_OPTIONS.find(a => a.value === audience)?.label.toLowerCase() ?? audience

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        className="relative bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Send announcement?</h3>
            <p className="text-sm text-slate-500 mt-1">
              This will email all {audienceLabel}. This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Sending...
              </>
            ) : (
              'Send'
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function AnnouncementComposer({ eventProjectId }: AnnouncementComposerProps) {
  const { toast } = useToast()
  const createMutation = useCreateAnnouncement(eventProjectId)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audience, setAudience] = useState<AnnouncementAudience>('ALL')
  const [targetGroupId, setTargetGroupId] = useState<string>('')
  const [showConfirm, setShowConfirm] = useState(false)

  // Fetch groups for the "Specific Group" audience selector
  const { data: groups = [] } = useQuery<EventGroupWithAssignments[]>({
    queryKey: ['event-groups', eventProjectId],
    queryFn: () => fetchApi<EventGroupWithAssignments[]>(`/api/events/projects/${eventProjectId}/groups`),
    enabled: !!eventProjectId,
    staleTime: 60_000,
  })

  const selectedGroup = groups.find(g => g.id === targetGroupId)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    if (audience === 'GROUP' && !targetGroupId) return
    setShowConfirm(true)
  }

  function handleConfirm() {
    createMutation.mutate(
      {
        title: title.trim(),
        body: body.trim(),
        audience,
        targetGroupId: audience === 'GROUP' ? targetGroupId : null,
      },
      {
        onSuccess: () => {
          toast('Announcement sent successfully', 'success')
          setTitle('')
          setBody('')
          setAudience('ALL')
          setTargetGroupId('')
          setShowConfirm(false)
        },
        onError: (err) => {
          toast(err instanceof Error ? err.message : 'Failed to send announcement', 'error')
          setShowConfirm(false)
        },
      },
    )
  }

  const isValid = title.trim() && body.trim() && (audience !== 'GROUP' || targetGroupId)

  return (
    <>
      <AnimatePresence>
        {showConfirm && (
          <ConfirmDialog
            audience={audience}
            groupName={selectedGroup?.name}
            onConfirm={handleConfirm}
            onCancel={() => setShowConfirm(false)}
            isPending={createMutation.isPending}
          />
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
            Subject
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Important schedule update"
            maxLength={200}
            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-colors"
            required
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
            Message
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your announcement here..."
            rows={4}
            className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-colors resize-none"
            required
          />
        </div>

        {/* Audience */}
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            Send to
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {AUDIENCE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  audience === opt.value
                    ? 'border-blue-400 bg-blue-50/50'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="audience"
                  value={opt.value}
                  checked={audience === opt.value}
                  onChange={() => {
                    setAudience(opt.value)
                    if (opt.value !== 'GROUP') setTargetGroupId('')
                  }}
                  className="mt-0.5 accent-blue-500 flex-shrink-0"
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">{opt.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Group selector (shown when audience is GROUP) */}
        <AnimatePresence>
          {audience === 'GROUP' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                Select Group
              </label>
              <div className="relative">
                <select
                  value={targetGroupId}
                  onChange={(e) => setTargetGroupId(e.target.value)}
                  className="w-full appearance-none px-3.5 py-2.5 pr-9 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-colors cursor-pointer"
                  required={audience === 'GROUP'}
                >
                  <option value="">Choose a group...</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.type.replace('_', ' ')}) — {g.assignmentCount} member{g.assignmentCount !== 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              {groups.length === 0 && (
                <p className="text-xs text-amber-600 mt-1.5">
                  No groups found. Create groups in the People tab first.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit */}
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={!isValid || createMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            Send Announcement
          </button>
        </div>
      </form>
    </>
  )
}
