'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { LayoutTemplate, Search, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import DetailDrawer from '@/components/DetailDrawer'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useTemplates, useTemplateMutations } from '@/lib/hooks/useEventTemplates'
import { useToast } from '@/components/Toast'
import { staggerContainer, listItem } from '@/lib/animations'
import type { EventTemplateSummary } from '@/lib/types/event-template'

// ─── Types ───────────────────────────────────────────────────────────────────

interface TemplateListDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (templateId: string) => void
}

// ─── Event type options ───────────────────────────────────────────────────────

const EVENT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'camp', label: 'Camp' },
  { value: 'field_trip', label: 'Field Trip' },
  { value: 'retreat', label: 'Retreat' },
  { value: 'conference', label: 'Conference' },
  { value: 'performance', label: 'Performance' },
  { value: 'fundraiser', label: 'Fundraiser' },
  { value: 'sports_event', label: 'Sports Event' },
  { value: 'other', label: 'Other' },
]

function formatEventType(type: string | null): string {
  if (!type) return ''
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// ─── Template Card ────────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: EventTemplateSummary
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

function TemplateCard({ template, onSelect, onDelete }: TemplateCardProps) {
  const lastUsed = template.lastUsedAt
    ? formatDistanceToNow(new Date(template.lastUsedAt), { addSuffix: true })
    : null

  return (
    <motion.div
      variants={listItem}
      className="ui-glass-hover p-4 rounded-xl space-y-2.5"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{template.name}</p>
          {template.eventType && (
            <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium">
              {formatEventType(template.eventType)}
            </span>
          )}
        </div>
        <button
          onClick={() => onDelete(template.id)}
          className="flex-shrink-0 p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
          aria-label={`Delete template ${template.name}`}
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Description */}
      {template.description && (
        <p className="text-xs text-gray-500 line-clamp-2">{template.description}</p>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-3 text-xs text-gray-400">
        <span>Used {template.usageCount} {template.usageCount === 1 ? 'time' : 'times'}</span>
        {lastUsed && <span>Last used {lastUsed}</span>}
        {template.durationDays && (
          <span>{template.durationDays} day{template.durationDays === 1 ? '' : 's'}</span>
        )}
      </div>

      {/* Action */}
      <button
        onClick={() => onSelect(template.id)}
        className="w-full mt-1 px-4 py-2 rounded-full bg-gray-900 text-white text-xs font-medium hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer"
      >
        Use Template
      </button>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TemplateSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="ui-glass p-4 rounded-xl animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-1/4 mb-3" />
          <div className="h-3 bg-gray-100 rounded w-full mb-1" />
          <div className="h-3 bg-gray-100 rounded w-4/5 mb-3" />
          <div className="h-8 bg-gray-200 rounded-full w-full" />
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TemplateListDrawer({ isOpen, onClose, onSelect }: TemplateListDrawerProps) {
  const [search, setSearch] = useState('')
  const [eventType, setEventType] = useState('')
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const { toast } = useToast()
  const { data: templates, isLoading } = useTemplates({ eventType: eventType || undefined })
  const { deleteTemplate } = useTemplateMutations()

  // Client-side search filter
  const filtered = (templates ?? []).filter((t) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      t.name.toLowerCase().includes(q) ||
      (t.description?.toLowerCase().includes(q) ?? false)
    )
  })

  function handleSelect(templateId: string) {
    onSelect(templateId)
    onClose()
  }

  async function handleDeleteConfirm() {
    if (!deleteTargetId) return
    const target = templates?.find((t) => t.id === deleteTargetId)
    try {
      await deleteTemplate.mutateAsync(deleteTargetId)
      toast(`Template "${target?.name ?? ''}" deleted.`, 'success')
    } catch {
      toast('Failed to delete template.', 'error')
    } finally {
      setDeleteTargetId(null)
    }
  }

  const deleteTarget = templates?.find((t) => t.id === deleteTargetId)

  return (
    <>
      <DetailDrawer
        isOpen={isOpen}
        onClose={onClose}
        title="Event Templates"
        width="lg"
      >
        {/* Drawer content header */}
        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <LayoutTemplate className="w-4 h-4 text-indigo-500" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Event Templates</p>
            <p className="text-xs text-gray-500">Reuse the structure of past events</p>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3 mb-5">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"
            />
          </div>

          {/* Event type filter */}
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-700 focus:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 cursor-pointer"
          >
            {EVENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Template list */}
        {isLoading ? (
          <TemplateSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
              <LayoutTemplate className="w-6 h-6 text-gray-400" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">
              {search || eventType ? 'No templates match your filters' : 'No templates saved yet'}
            </p>
            <p className="text-xs text-gray-500 max-w-xs">
              {search || eventType
                ? 'Try clearing your filters to see all templates.'
                : 'Save an event as a template from the Overview tab to get started.'}
            </p>
          </div>
        ) : (
          <motion.div
            variants={staggerContainer(0.05)}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            {filtered.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onSelect={handleSelect}
                onDelete={setDeleteTargetId}
              />
            ))}
          </motion.div>
        )}
      </DetailDrawer>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={!!deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Template"
        message={`Are you sure you want to delete "${deleteTarget?.name ?? 'this template'}"? This cannot be undone.`}
        confirmText="Delete Template"
        variant="danger"
        isLoading={deleteTemplate.isPending}
        loadingText="Deleting..."
      />
    </>
  )
}
