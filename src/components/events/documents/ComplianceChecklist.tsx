'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  ChevronDown,
  Plus,
  Trash2,
  Loader2,
  Download,
  Paperclip,
  Check,
  Circle,
  Clock,
} from 'lucide-react'
import { staggerContainer, listItem, fadeInUp } from '@/lib/animations'
import {
  useComplianceItems,
  useUpsertComplianceItem,
  useDeleteComplianceItem,
  type ComplianceItem,
  type UpsertComplianceItemInput,
} from '@/lib/hooks/useEventDocuments'
import { fetchApi } from '@/lib/api-client'
import { useToast } from '@/components/Toast'

// ─── Types ─────────────────────────────────────────────────────────────

type ComplianceStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE'

interface OrgUser {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
}

interface DefaultItem {
  label: string
  description: string
  sortOrder: number
}

// ─── Helpers ────────────────────────────────────────────────────────────

function statusConfig(status: ComplianceStatus) {
  switch (status) {
    case 'COMPLETE':
      return {
        label: 'Complete',
        bg: 'bg-green-100',
        text: 'text-green-700',
        icon: <Check className="w-3 h-3" />,
      }
    case 'IN_PROGRESS':
      return {
        label: 'In Progress',
        bg: 'bg-yellow-100',
        text: 'text-yellow-700',
        icon: <Clock className="w-3 h-3" />,
      }
    default:
      return {
        label: 'Not Started',
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        icon: <Circle className="w-3 h-3" />,
      }
  }
}

function userDisplayName(user: OrgUser | null | undefined): string {
  if (!user) return '—'
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ')
  return name || user.email
}

// ─── Skeleton ───────────────────────────────────────────────────────────

function ComplianceSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-14 bg-slate-100 rounded-xl" />
      ))}
    </div>
  )
}

// ─── Empty State ────────────────────────────────────────────────────────

function ComplianceEmpty({ onImport, isImporting }: { onImport: () => void; isImporting: boolean }) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="text-center py-16"
    >
      <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
        <Shield className="w-7 h-7 text-blue-500" />
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-2">No compliance items yet</h3>
      <p className="text-sm text-slate-500 max-w-xs mx-auto mb-6">
        Import a set of standard off-campus compliance items or add custom ones.
      </p>
      <button
        onClick={onImport}
        disabled={isImporting}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-60"
      >
        {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Import Standard Defaults
      </button>
    </motion.div>
  )
}

// ─── Inline Editor ──────────────────────────────────────────────────────

interface InlineEditorProps {
  item?: ComplianceItem | null
  eventProjectId: string
  users: OrgUser[]
  onSave: (data: UpsertComplianceItemInput) => void
  onCancel: () => void
  isSaving: boolean
}

function InlineEditor({ item, eventProjectId, users, onSave, onCancel, isSaving }: InlineEditorProps) {
  const [label, setLabel] = useState(item?.label ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [status, setStatus] = useState<ComplianceStatus>(item?.status ?? 'NOT_STARTED')
  const [assigneeId, setAssigneeId] = useState(item?.assigneeId ?? '')
  const [dueDate, setDueDate] = useState(
    item?.dueDate ? item.dueDate.split('T')[0] : '',
  )
  const [fileUrl, setFileUrl] = useState(item?.fileUrl ?? '')
  const [labelError, setLabelError] = useState('')

  function handleSubmit() {
    if (!label.trim()) {
      setLabelError('Label is required.')
      return
    }
    onSave({
      ...(item?.id ? { id: item.id } : {}),
      label: label.trim(),
      description: description.trim() || null,
      status,
      assigneeId: assigneeId || null,
      dueDate: dueDate || null,
      fileUrl: fileUrl.trim() || null,
      eventProjectId,
    })
  }

  return (
    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 mt-2">
      {/* Label */}
      <div>
        <input
          type="text"
          value={label}
          onChange={(e) => { setLabel(e.target.value); setLabelError('') }}
          placeholder="Compliance item label *"
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 transition-colors"
        />
        {labelError && <p className="text-xs text-red-500 mt-1">{labelError}</p>}
      </div>

      {/* Description */}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 transition-colors resize-none"
      />

      <div className="grid grid-cols-2 gap-3">
        {/* Status */}
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ComplianceStatus)}
            className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer bg-white"
          >
            <option value="NOT_STARTED">Not Started</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETE">Complete</option>
          </select>
        </div>

        {/* Due date */}
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Due Date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
          />
        </div>
      </div>

      {/* Assignee */}
      <div>
        <label className="text-xs text-slate-500 mb-1 block">Assignee</label>
        <select
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer bg-white"
        >
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {userDisplayName(u)}
            </option>
          ))}
        </select>
      </div>

      {/* File URL */}
      <div>
        <label className="text-xs text-slate-500 mb-1 block">File URL (optional)</label>
        <div className="relative">
          <Paperclip className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="url"
            value={fileUrl}
            onChange={(e) => setFileUrl(e.target.value)}
            placeholder="https://…"
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-300 transition-colors"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 font-medium hover:bg-white active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className="flex-1 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ─── Item Row ────────────────────────────────────────────────────────────

interface ItemRowProps {
  item: ComplianceItem
  eventProjectId: string
  users: OrgUser[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  isEditing: boolean
  onSave: (data: UpsertComplianceItemInput) => void
  onCancelEdit: () => void
  isSaving: boolean
  isDeleting: boolean
}

function ComplianceItemRow({
  item,
  eventProjectId,
  users,
  onEdit,
  onDelete,
  isEditing,
  onSave,
  onCancelEdit,
  isSaving,
  isDeleting,
}: ItemRowProps) {
  const cfg = statusConfig(item.status)
  const assignee = users.find((u) => u.id === item.assigneeId)

  return (
    <motion.li variants={listItem} className="group">
      {/* Row header */}
      <div
        className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
          isEditing
            ? 'border-indigo-200 bg-indigo-50/30'
            : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 bg-white'
        }`}
        onClick={() => (isEditing ? onCancelEdit() : onEdit(item.id))}
      >
        {/* Status badge */}
        <span
          className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.bg} ${cfg.text}`}
        >
          {cfg.icon}
          {cfg.label}
        </span>

        {/* Label */}
        <span className="text-sm font-medium text-slate-900 flex-1 min-w-0 truncate">
          {item.label}
        </span>

        {/* Assignee avatar */}
        {assignee && (
          <div
            className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0"
            title={userDisplayName(assignee)}
          >
            <span className="text-[10px] font-semibold text-indigo-700">
              {(assignee.firstName?.[0] ?? assignee.email[0]).toUpperCase()}
            </span>
          </div>
        )}

        {/* Due date */}
        {item.dueDate && (
          <span className="text-xs text-slate-400 flex-shrink-0 hidden sm:block">
            Due {new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}

        {/* File indicator */}
        {item.fileUrl && (
          <a
            href={item.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-slate-400 hover:text-indigo-500 flex-shrink-0 transition-colors"
            title="View file"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </a>
        )}

        {/* Expand indicator */}
        <ChevronDown
          className={`w-4 h-4 text-slate-300 flex-shrink-0 transition-transform group-hover:text-slate-400 ${
            isEditing ? 'rotate-180 text-indigo-400' : ''
          }`}
        />

        {/* Delete */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(item.id)
          }}
          disabled={isDeleting}
          className="p-1 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer disabled:opacity-50 flex-shrink-0"
          title="Delete item"
        >
          {isDeleting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Inline editor */}
      <AnimatePresence initial={false}>
        {isEditing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <InlineEditor
              item={item}
              eventProjectId={eventProjectId}
              users={users}
              onSave={onSave}
              onCancel={onCancelEdit}
              isSaving={isSaving}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

// ─── Component ──────────────────────────────────────────────────────────

interface ComplianceChecklistProps {
  eventProjectId: string
}

export function ComplianceChecklist({ eventProjectId }: ComplianceChecklistProps) {
  const { data: items, isLoading } = useComplianceItems(eventProjectId)
  const upsertMutation = useUpsertComplianceItem(eventProjectId)
  const deleteMutation = useDeleteComplianceItem(eventProjectId)
  const { toast } = useToast()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([])

  // Fetch org users for assignee dropdown (once)
  useEffect(() => {
    fetchApi<OrgUser[]>('/api/settings/users?limit=100')
      .then((data) => setOrgUsers(Array.isArray(data) ? data : []))
      .catch(() => {/* non-critical */})
  }, [])

  async function handleImportDefaults() {
    setIsImporting(true)
    try {
      const defaults = await fetchApi<DefaultItem[]>(
        `/api/events/projects/${eventProjectId}/compliance?defaults=true`,
      )
      for (const d of defaults) {
        await upsertMutation.mutateAsync({
          label: d.label,
          description: d.description,
          eventProjectId,
          sortOrder: d.sortOrder,
        })
      }
      toast('Standard compliance items imported', 'success')
    } catch {
      toast('Failed to import defaults', 'error')
    } finally {
      setIsImporting(false)
    }
  }

  async function handleSave(data: UpsertComplianceItemInput) {
    try {
      await upsertMutation.mutateAsync(data)
      setEditingId(null)
      setShowNewForm(false)
    } catch {
      toast('Failed to save item', 'error')
    }
  }

  async function handleDelete(itemId: string) {
    setDeletingId(itemId)
    try {
      await deleteMutation.mutateAsync(itemId)
    } catch {
      toast('Failed to delete item', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) return <ComplianceSkeleton />

  const isEmpty = !items || items.length === 0

  return (
    <div className="space-y-4">
      {/* Header actions */}
      {!isEmpty && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm text-slate-500">{items.length} compliance items</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleImportDefaults}
              disabled={isImporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 font-medium hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-60"
            >
              {isImporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Import Defaults
            </button>
            <button
              onClick={() => { setShowNewForm(true); setEditingId(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Custom
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && !showNewForm && (
        <ComplianceEmpty onImport={handleImportDefaults} isImporting={isImporting} />
      )}

      {/* List */}
      {!isEmpty && (
        <motion.ul
          variants={staggerContainer(0.04)}
          initial="hidden"
          animate="visible"
          className="space-y-2"
        >
          {items.map((item) => (
            <ComplianceItemRow
              key={item.id}
              item={item}
              eventProjectId={eventProjectId}
              users={orgUsers}
              onEdit={(id) => { setEditingId(id); setShowNewForm(false) }}
              onDelete={handleDelete}
              isEditing={editingId === item.id}
              onSave={handleSave}
              onCancelEdit={() => setEditingId(null)}
              isSaving={upsertMutation.isPending}
              isDeleting={deletingId === item.id}
            />
          ))}
        </motion.ul>
      )}

      {/* New item inline form */}
      <AnimatePresence>
        {showNewForm && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
          >
            <InlineEditor
              eventProjectId={eventProjectId}
              users={orgUsers}
              onSave={handleSave}
              onCancel={() => setShowNewForm(false)}
              isSaving={upsertMutation.isPending}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add custom (shown when list exists, not just above) */}
      {isEmpty && showNewForm && (
        <InlineEditor
          eventProjectId={eventProjectId}
          users={orgUsers}
          onSave={handleSave}
          onCancel={() => setShowNewForm(false)}
          isSaving={upsertMutation.isPending}
        />
      )}
    </div>
  )
}
