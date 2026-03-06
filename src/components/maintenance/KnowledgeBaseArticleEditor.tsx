'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Loader2, BookOpen, Tag } from 'lucide-react'
import { fetchApi, getAuthHeaders } from '@/lib/api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArticlePayload {
  title: string
  type: string
  content: string
  tags: string[]
  assetId?: string | null
  calculatorType?: string | null
  isPublished: boolean
}

interface KBArticleSummary {
  id: string
  title: string
  type: string
  content: string
  tags: string[]
  isPublished: boolean
  assetId?: string | null
  calculatorType?: string | null
}

interface KnowledgeBaseArticleEditorProps {
  isOpen: boolean
  onClose: () => void
  editArticle?: KBArticleSummary | null
  onSaved?: (article: KBArticleSummary) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: '', label: 'Select type...' },
  { value: 'EQUIPMENT_GUIDE', label: 'Equipment Guide' },
  { value: 'PROCEDURE_SOP', label: 'Procedure SOP' },
  { value: 'CALCULATION_TOOL', label: 'Calculation Tool' },
  { value: 'SAFETY_PROTOCOL', label: 'Safety Protocol' },
  { value: 'VENDOR_CONTACT', label: 'Vendor Contact' },
  { value: 'ASSET_NOTE', label: 'Asset Note' },
]

const CALCULATOR_OPTIONS = [
  { value: '', label: 'Select calculator...' },
  { value: 'POND_CARE_DOSAGE', label: 'Pond Care Dosage' },
]

const labelClass = 'block text-xs font-medium text-gray-600 mb-1'
const inputClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus:border-transparent transition-colors'
const selectClass =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus:border-transparent cursor-pointer transition-colors'

// ─── Initial form ─────────────────────────────────────────────────────────────

function getInitialForm(article?: KBArticleSummary | null) {
  return {
    title: article?.title ?? '',
    type: article?.type ?? '',
    content: article?.content ?? '',
    tagsInput: article?.tags.join(', ') ?? '',
    assetId: article?.assetId ?? '',
    calculatorType: article?.calculatorType ?? '',
    isPublished: article?.isPublished ?? true,
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KnowledgeBaseArticleEditor({
  isOpen,
  onClose,
  editArticle,
  onSaved,
}: KnowledgeBaseArticleEditorProps) {
  const queryClient = useQueryClient()
  const isEditMode = !!editArticle

  const [form, setForm] = useState(() => getInitialForm(editArticle))
  const [error, setError] = useState('')

  // Re-populate form when editArticle changes
  useEffect(() => {
    if (isOpen) {
      setForm(getInitialForm(editArticle))
      setError('')
    }
  }, [editArticle, isOpen])

  function updateField<K extends keyof typeof form>(field: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // Parse tags from comma-separated input
  function parseTags(input: string): string[] {
    return input
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
  }

  const mutation = useMutation<KBArticleSummary, Error, ArticlePayload>({
    mutationFn: (payload) => {
      if (isEditMode && editArticle) {
        return fetchApi<KBArticleSummary>(`/api/maintenance/knowledge-base/${editArticle.id}`, {
          method: 'PATCH',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
      return fetchApi<KBArticleSummary>('/api/maintenance/knowledge-base', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] })
      onSaved?.(saved)
      onClose()
    },
    onError: (err) => {
      setError(err.message || 'Failed to save article')
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.title.trim()) {
      setError('Title is required')
      return
    }
    if (!form.type) {
      setError('Article type is required')
      return
    }
    if (!form.content.trim()) {
      setError('Content is required')
      return
    }

    mutation.mutate({
      title: form.title.trim(),
      type: form.type,
      content: form.content,
      tags: parseTags(form.tagsInput),
      assetId: form.assetId || null,
      calculatorType: form.type === 'CALCULATION_TOOL' ? form.calculatorType || null : null,
      isPublished: form.isPublished,
    })
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="kb-editor-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.div
            key="kb-editor-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-lg ui-glass-overlay z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-primary-700" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    {isEditMode ? 'Edit Article' : 'New Article'}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {isEditMode ? 'Update knowledge base article' : 'Add to the knowledge base'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Title */}
              <div>
                <label className={labelClass} htmlFor="kb-title">Title *</label>
                <input
                  id="kb-title"
                  type="text"
                  className={inputClass}
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="e.g. Boiler Blowdown Procedure"
                  maxLength={200}
                  required
                />
              </div>

              {/* Article Type */}
              <div>
                <label className={labelClass} htmlFor="kb-type">Article Type *</label>
                <select
                  id="kb-type"
                  className={selectClass}
                  value={form.type}
                  onChange={(e) => updateField('type', e.target.value)}
                  required
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} disabled={!opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Calculator type (only when CALCULATION_TOOL) */}
              {form.type === 'CALCULATION_TOOL' && (
                <div>
                  <label className={labelClass} htmlFor="kb-calc-type">Calculator Type</label>
                  <select
                    id="kb-calc-type"
                    className={selectClass}
                    value={form.calculatorType}
                    onChange={(e) => updateField('calculatorType', e.target.value)}
                  >
                    {CALCULATOR_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Content */}
              <div>
                <label className={labelClass} htmlFor="kb-content">
                  Content * <span className="text-gray-400 font-normal">(Markdown supported)</span>
                </label>
                <textarea
                  id="kb-content"
                  className={`${inputClass} font-mono text-xs leading-relaxed`}
                  rows={12}
                  value={form.content}
                  onChange={(e) => updateField('content', e.target.value)}
                  placeholder="Write article content in Markdown..."
                  required
                />
              </div>

              {/* Tags */}
              <div>
                <label className={labelClass} htmlFor="kb-tags">
                  <span className="flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    Tags <span className="text-gray-400 font-normal">(comma-separated)</span>
                  </span>
                </label>
                <input
                  id="kb-tags"
                  type="text"
                  className={inputClass}
                  value={form.tagsInput}
                  onChange={(e) => updateField('tagsInput', e.target.value)}
                  placeholder="e.g. boiler, hvac, safety"
                />
                {/* Tag preview */}
                {form.tagsInput && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {parseTags(form.tagsInput).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 text-xs rounded-full bg-primary-50 text-primary-700 border border-primary-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Asset ID (optional) */}
              <div>
                <label className={labelClass} htmlFor="kb-asset">
                  Asset ID <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  id="kb-asset"
                  type="text"
                  className={inputClass}
                  value={form.assetId}
                  onChange={(e) => updateField('assetId', e.target.value)}
                  placeholder="Paste asset ID to link this article"
                />
              </div>

              {/* Published toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-700">Published</p>
                  <p className="text-xs text-gray-500">Visible to all team members with KB access</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.isPublished}
                  onClick={() => updateField('isPublished', !form.isPublished)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 ${
                    form.isPublished ? 'bg-gray-900' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      form.isPublished ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Error */}
              {error && (
                <p className="text-xs text-red-500 px-1">{error}</p>
              )}
            </form>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200/50 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="kb-editor-form"
                onClick={handleSubmit}
                disabled={mutation.isPending}
                className="flex-1 ui-btn-md ui-btn-primary"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : isEditMode ? (
                  'Save Changes'
                ) : (
                  'Save Article'
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
