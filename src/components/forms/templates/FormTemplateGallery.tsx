'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import {
  FileText, Plus, Bus, Heart, AlertTriangle, BarChart3, Laptop,
  Loader2, ChevronRight, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { useToast } from '@/components/Toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormTemplate {
  id: string
  name: string
  icon: string | null
  description: string | null
  category: string | null
  isSystem: boolean
}

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  Bus,
  Heart,
  AlertTriangle,
  BarChart: BarChart3,
  Laptop,
  FileText,
}

function getIcon(iconName: string | null): LucideIcon {
  if (!iconName) return FileText
  return ICON_MAP[iconName] ?? FileText
}

// ─── Category labels ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  events: 'Events',
  people: 'People',
  safety: 'Safety',
  feedback: 'Feedback',
  it: 'IT',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface FormTemplateGalleryProps {
  isOpen: boolean
  onClose: () => void
}

export default function FormTemplateGallery({ isOpen, onClose }: FormTemplateGalleryProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['form-templates'],
    queryFn: () => fetchApi<FormTemplate[]>('/api/forms/templates'),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  })

  const createBlank = useMutation({
    mutationFn: () =>
      fetchApi<{ id: string }>('/api/forms/hub', {
        method: 'POST',
        body: JSON.stringify({ name: 'Untitled Form' }),
      }),
    onSuccess: (form) => {
      onClose()
      router.push(`/forms/${form.id}/builder`)
    },
    onError: () => toast('Failed to create form', 'error'),
  })

  const cloneTemplate = useMutation({
    mutationFn: (templateId: string) =>
      fetchApi<{ id: string }>(`/api/forms/from-template/${templateId}`, {
        method: 'POST',
      }),
    onSuccess: (form) => {
      onClose()
      router.push(`/forms/${form.id}/builder`)
    },
    onError: () => toast('Failed to create from template', 'error'),
  })

  if (!isOpen) return null

  // Group templates by category
  const categories = new Map<string, FormTemplate[]>()
  for (const t of templates) {
    const cat = t.category ?? 'other'
    const group = categories.get(cat) ?? []
    group.push(t)
    categories.set(cat, group)
  }

  const filteredTemplates = selectedCategory
    ? templates.filter((t) => t.category === selectedCategory)
    : templates

  const isCreating = createBlank.isPending || cloneTemplate.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Create a Form</h2>
            <p className="text-xs text-slate-500 mt-0.5">Start from scratch or pick a template</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4.5 h-4.5 text-slate-500" />
          </button>
        </div>

        {/* Blank form option */}
        <div className="px-6 pt-5">
          <button
            type="button"
            onClick={() => createBlank.mutate()}
            disabled={isCreating}
            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-200 transition-colors">
              <Plus className="w-5 h-5 text-slate-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-slate-900">Blank Form</p>
              <p className="text-xs text-slate-500">Start with an empty canvas</p>
            </div>
            {createBlank.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
            )}
          </button>
        </div>

        {/* Category filter tabs */}
        {categories.size > 1 && (
          <div className="px-6 pt-4 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                !selectedCategory
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              All
            </button>
            {Array.from(categories.keys()).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </button>
            ))}
          </div>
        )}

        {/* Template grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredTemplates.map((template) => {
                const Icon = getIcon(template.icon)
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => cloneTemplate.mutate(template.id)}
                    disabled={isCreating}
                    className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer text-left group disabled:opacity-60"
                  >
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4.5 h-4.5 text-blue-600" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{template.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{template.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {!isLoading && filteredTemplates.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-slate-500">No templates in this category</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
