'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Eye, EyeOff, Save, Check, Loader2, Share2, Link2, Copy, CheckCheck, Settings, BookmarkPlus, Globe, Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { fetchApi } from '@/lib/api-client'
import { queryKeys } from '@/lib/queries'
import type { FormFieldType, FieldProtection, FieldSensitivity } from '@prisma/client'
import { slugifyFieldKey } from '@/lib/forms/schemas'
import FieldPalette from './FieldPalette'
import PageList from './PageList'
import FormCanvas from './FormCanvas'
import FieldProperties from './FieldProperties'
import FormStylePanel from './FormStylePanel'

const ApprovalRulesBuilder = dynamic(() => import('@/components/settings/ApprovalRulesBuilder'), {
  ssr: false,
})
const TicketsBuilder = dynamic(() => import('./TicketsBuilder'), {
  ssr: false,
})
const ResponsesTab = dynamic(() => import('./ResponsesTab'), {
  ssr: false,
})

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FormPageData {
  id: string
  title: string
  description: string | null
  sortOrder: number
  isOptional: boolean
  condFieldKey: string | null
  condOperator: string | null
  condEquals: string | null
  fields: FormFieldData[]
}

export interface FormFieldData {
  id: string
  key: string
  label: string
  type: FormFieldType
  required: boolean
  placeholder: string | null
  helpText: string | null
  options: string[]
  autoEscalate: boolean
  condFieldKey: string | null
  condOperator: string | null
  condEquals: string | null
  sortOrder: number
  pageId: string | null
  sectionId: string | null
  protection: FieldProtection
  isIncluded: boolean
  sensitivityLevel: FieldSensitivity
  defaultValue: string | null
  prefillSource: string | null
  minValue: string | null
  maxValue: string | null
  pattern: string | null
  errorMessage: string | null
  fileTypes: string[]
  maxFileSize: number | null
}

interface FormDefinitionData {
  id: string
  context: string
  systemKey: string | null
  isDefault: boolean
  description: string | null
  coverColor: string | null
  confirmMessage: string | null
  autoSave: boolean
  requireEmail: boolean
  publicStyle: string
  publicCtaColor: string | null
  publicBgColor: string | null
  publicImageUrl: string | null
  publicImageSide: string
  logoUrl: string | null
  visibility: 'PRIVATE' | 'SHARED'
  createdBy: string | null
  pages: FormPageData[]
  fields: FormFieldData[]
  actions: unknown[]
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function FormBuilder({ formId }: { formId: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()

  // ─── State ──────────────────────────────────────────────────────────────
  const [pages, setPages] = useState<FormPageData[]>([])
  const [formName, setFormName] = useState('')
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [leftTab, setLeftTab] = useState<'pages' | 'components' | 'tickets' | 'responses' | 'workflows'>('components')
  const [previewMode, setPreviewMode] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // ─── Fetch form ─────────────────────────────────────────────────────────
  const { data: form, isLoading } = useQuery({
    queryKey: queryKeys.forms.detail(formId),
    queryFn: () => fetchApi<FormDefinitionData>(`/api/forms/${formId}/detail`),
    staleTime: 30_000,
  })

  // Initialize local state from fetched data — only on first load
  const initializedRef = useRef(false)
  useEffect(() => {
    if (!form || initializedRef.current) return
    initializedRef.current = true
    setFormName(form.description || form.systemKey || 'Untitled Form')
    // Build pages with their fields, plus a virtual page for pageless fields
    const realPages = (form.pages ?? []).map((p) => ({
      ...p,
      fields: p.fields ?? [],
    }))

    // Fields without a page go into the first page (or a virtual one)
    const pagelessFields = (form.fields ?? []).filter((f) => !f.pageId)
    if (realPages.length > 0 && pagelessFields.length > 0) {
      realPages[0] = {
        ...realPages[0],
        fields: [...pagelessFields, ...realPages[0].fields].sort(
          (a, b) => a.sortOrder - b.sortOrder
        ),
      }
    } else if (realPages.length === 0 && pagelessFields.length > 0) {
      // No pages exist — create a virtual one
      realPages.push({
        id: '__default__',
        title: 'Page 1',
        description: null,
        sortOrder: 0,
        isOptional: false,
        condFieldKey: null,
        condOperator: null,
        condEquals: null,
        fields: pagelessFields.sort((a, b) => a.sortOrder - b.sortOrder),
      })
    }

    setPages(realPages)
    if (!activePageId && realPages.length > 0) {
      setActivePageId(realPages[0].id)
    }
  }, [form]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Save mutation ──────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (data: { pages: FormPageData[] }) => {
      // Save field updates — flatten all fields and batch update
      const allFields = data.pages.flatMap((p) =>
        p.fields.map((f, i) => ({ ...f, pageId: p.id === '__default__' ? null : p.id, sortOrder: i }))
      )
      // For now, save each field individually (batch endpoint can be added later)
      for (const field of allFields) {
        if (!field.id.startsWith('new_')) {
          await fetchApi(`/api/forms/${formId}/fields/${field.id}`, {
            method: 'PATCH',
            body: JSON.stringify(field),
          })
        }
      }
    },
    onSuccess: () => {
      setDirty(false)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
      queryClient.invalidateQueries({ queryKey: queryKeys.forms.detail(formId) })
    },
    onError: () => {
      setSaveStatus('idle')
    },
  })

  // Auto-save with debounce
  const triggerAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveMutation.mutate({ pages })
      setSaveStatus('saving')
    }, 2000)
  }, [pages, saveMutation])

  // ─── Style updates ───────────────────────────────────────────────────────
  const updateFormStyle = useCallback((patch: Record<string, unknown>) => {
    fetchApi(`/api/forms/${formId}/detail`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forms.detail(formId) })
      // Also invalidate hub list in case visibility changed
      if ('visibility' in patch) {
        queryClient.invalidateQueries({ queryKey: queryKeys.forms.all })
      }
    }).catch(() => {})
  }, [formId, queryClient])

  // ─── Form name ───────────────────────────────────────────────────────────
  const updateFormName = useCallback((name: string) => {
    setFormName(name)
    setDirty(true)
    // Save immediately to the API and invalidate the hub list so the name updates there too
    fetchApi(`/api/forms/${formId}/detail`, {
      method: 'PATCH',
      body: JSON.stringify({ description: name }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forms.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.forms.detail(formId) })
    }).catch(() => {})
  }, [formId, queryClient])

  // ─── Page operations (inline) ───────────────────────────────────────────
  const updatePageTitle = useCallback((pageId: string, title: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, title } : p))
    )
    setDirty(true)
    if (pageId !== '__default__') {
      fetchApi(`/api/forms/${formId}/pages/${pageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      }).catch(() => {})
    }
  }, [formId])

  // ─── Field operations ───────────────────────────────────────────────────
  const activePage = pages.find((p) => p.id === activePageId) ?? pages[0]
  const selectedField = activePage?.fields.find((f) => f.id === selectedFieldId) ?? null

  const updateField = useCallback((fieldId: string, patch: Partial<FormFieldData>) => {
    setPages((prev) =>
      prev.map((page) => ({
        ...page,
        fields: page.fields.map((f) =>
          f.id === fieldId ? { ...f, ...patch } : f
        ),
      }))
    )
    setDirty(true)
    triggerAutoSave()
  }, [triggerAutoSave])

  const reorderFields = useCallback((pageId: string, reordered: FormFieldData[]) => {
    setPages((prev) =>
      prev.map((page) =>
        page.id === pageId ? { ...page, fields: reordered } : page
      )
    )
    setDirty(true)
    triggerAutoSave()
  }, [triggerAutoSave])

  const addField = useCallback(async (type: FormFieldType) => {
    if (!activePageId) return

    // Only one TICKET_SELECTOR allowed per form
    if (type === 'TICKET_SELECTOR') {
      const alreadyHas = pages.some((p) => p.fields.some((f) => f.type === 'TICKET_SELECTOR'))
      if (alreadyHas) return // silently prevent duplicate
    }

    const label = type === 'HEADER' ? 'Section Heading' : type === 'DIVIDER' ? '' : type === 'TICKET_SELECTOR' ? 'Ticket Selection' : 'New Field'
    const key = slugifyFieldKey(label) + '_' + Date.now().toString(36)

    try {
      const newField = await fetchApi<FormFieldData>(`/api/forms/${formId}/fields`, {
        method: 'POST',
        body: JSON.stringify({
          key,
          label,
          type,
          required: false,
          sortOrder: activePage?.fields.length ?? 0,
          pageId: activePageId === '__default__' ? null : activePageId,
        }),
      })

      setPages((prev) =>
        prev.map((page) =>
          page.id === activePageId
            ? { ...page, fields: [...page.fields, newField] }
            : page
        )
      )
      setSelectedFieldId(newField.id)
    } catch {
      // TODO: toast error
    }
  }, [activePageId, activePage, formId])

  const removeField = useCallback(async (fieldId: string) => {
    const field = activePage?.fields.find((f) => f.id === fieldId)
    if (!field || field.protection === 'LOCKED' || field.protection === 'DEFAULT') return

    try {
      await fetchApi(`/api/forms/${formId}/fields/${fieldId}`, { method: 'DELETE' })
      setPages((prev) =>
        prev.map((page) => ({
          ...page,
          fields: page.fields.filter((f) => f.id !== fieldId),
        }))
      )
      if (selectedFieldId === fieldId) setSelectedFieldId(null)
    } catch {
      // TODO: toast error
    }
  }, [activePage, formId, selectedFieldId])

  // ─── Page operations ────────────────────────────────────────────────────
  const addPage = useCallback(async () => {
    try {
      const newPage = await fetchApi<FormPageData>(`/api/forms/${formId}/pages`, {
        method: 'POST',
        body: JSON.stringify({
          title: `Page ${pages.length + 1}`,
          sortOrder: pages.length,
        }),
      })
      setPages((prev) => [...prev, { ...newPage, fields: [] }])
      setActivePageId(newPage.id)
    } catch {
      // TODO: toast error
    }
  }, [formId, pages.length])

  const reorderPages = useCallback((reordered: FormPageData[]) => {
    setPages(reordered)
    setDirty(true)
    triggerAutoSave()
  }, [triggerAutoSave])

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }, [])

  const builderUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/forms/${formId}/builder`
    : ''
  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/f/${formId}`
    : ''

  const handleSave = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveStatus('saving')
    saveMutation.mutate({ pages })
  }

  // ─── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    )
  }

  if (!form) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Form not found.</p>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/forms')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          {/* eslint-disable-next-line no-restricted-syntax -- inline editable title, not a form field */}
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            onBlur={() => updateFormName(formName)}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            className="text-sm font-semibold text-slate-900 truncate max-w-[300px] bg-transparent border-none outline-none ring-0 px-0 py-0.5"
            style={{ borderRadius: 0, boxShadow: 'none' }}
            placeholder="Untitled Form"
          />
          {form.systemKey && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium ml-1">
              System
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewMode(!previewMode)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer ${
              previewMode
                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {previewMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {previewMode ? 'Edit' : 'Preview'}
          </button>
          {!form.systemKey && (
          <button
            type="button"
            onClick={() => setShareOpen(!shareOpen)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty && saveStatus !== 'idle'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer ${
              saveStatus === 'saved'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : dirty
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'bg-white text-slate-400 border border-slate-200'
            }`}
          >
            {saveStatus === 'saving' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : saveStatus === 'saved' ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save'}
          </button>
        </div>
      </header>

      {/* Share dropdown */}
      {shareOpen && (
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0 z-[5]">
          <div className="max-w-xl space-y-3">
            {/* Collaboration link */}
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Collaboration Link
              </label>
              <p className="text-[10px] text-slate-400 mb-2">Anyone with this link and an account can view and edit this form.</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 truncate font-mono">
                  {builderUrl}
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(builderUrl, 'builder')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer flex-shrink-0"
                >
                  {copied === 'builder' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied === 'builder' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            {/* Public fill-out link */}
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                Public Form Link
              </label>
              <p className="text-[10px] text-slate-400 mb-2">
                Share this with anyone to fill out the form. No login required.
                {form.requireEmail ? ' Email address will be required.' : ' Fully anonymous.'}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 truncate font-mono">
                  {publicUrl}
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(publicUrl, 'public')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer flex-shrink-0"
                >
                  {copied === 'public' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Link2 className="w-3.5 h-3.5" />}
                  {copied === 'public' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            {/* Visibility toggle — custom forms only */}
            {form.context === 'CUSTOM' && (
              <div className="pt-2 border-t border-slate-100">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Form Visibility
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const next = form.visibility === 'SHARED' ? 'PRIVATE' : 'SHARED'
                      updateFormStyle({ visibility: next })
                    }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                      form.visibility === 'SHARED' ? 'bg-indigo-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                        form.visibility === 'SHARED' ? 'translate-x-[18px]' : 'translate-x-[3px]'
                      }`}
                    />
                  </button>
                  <div className="flex items-center gap-1.5">
                    {form.visibility === 'SHARED' ? (
                      <Globe className="w-3.5 h-3.5 text-indigo-500" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span className="text-xs font-medium text-slate-700">
                      {form.visibility === 'SHARED' ? 'Shared with organization' : 'Only visible to you'}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  {form.visibility === 'SHARED'
                    ? 'Everyone in your organization can see and use this form.'
                    : 'Only you can see this form. Toggle to share it with your team.'}
                </p>
              </div>
            )}
            {/* Save as template */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await fetchApi('/api/forms/templates', {
                      method: 'POST',
                      body: JSON.stringify({
                        formId,
                        name: formName || 'Untitled Template',
                      }),
                    })
                    setCopied('template')
                    setTimeout(() => setCopied(null), 2000)
                  } catch {
                    // Failed silently — could add toast here
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {copied === 'template' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                {copied === 'template' ? 'Saved as Template' : 'Save as Template'}
              </button>
              <p className="text-[10px] text-slate-400 mt-1.5">
                Others can start new forms from this template.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Builder mode tabs */}
      {!previewMode && (
        <div className="flex items-center gap-1 px-4 py-1.5 bg-white border-b border-slate-100">
          {(['pages', 'components', 'tickets', 'responses', 'workflows'] as const).map((tab) => {
            const labels = { pages: 'Pages', components: 'Fields', tickets: 'Tickets', responses: 'Responses', workflows: 'Approvals' } as const
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setLeftTab(tab)}
                className={`relative px-3 py-1.5 text-xs font-medium rounded-full cursor-pointer transition-colors duration-200 ${
                  leftTab === tab
                    ? 'text-white'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {leftTab === tab && (
                  <motion.div
                    layoutId="builder-tab-pill"
                    className="absolute inset-0 bg-slate-900 rounded-full"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
                  />
                )}
                <span className="relative z-10">{labels[tab]}</span>
              </button>
            )
          })}
        </div>
      )}

      {leftTab === 'tickets' && !previewMode ? (
        <div className="flex-1 overflow-hidden">
          <TicketsBuilder formDefinitionId={formId} />
        </div>
      ) : leftTab === 'responses' && !previewMode ? (
        <div className="flex-1 overflow-hidden">
          <ResponsesTab formId={formId} hasTicketTypes={true} />
        </div>
      ) : leftTab === 'workflows' && !previewMode ? (
        <div className="flex-1 overflow-hidden">
          <ApprovalRulesBuilder formDefinitionId={formId} />
        </div>
      ) : (
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel — palette / pages (hidden in preview) */}
        {!previewMode && (
        <aside className="w-56 bg-white border-r border-slate-200 flex flex-col overflow-hidden flex-shrink-0">
          {/* Panel content */}
          <div className="flex-1 overflow-y-auto">
            {leftTab === 'pages' ? (
              <PageList
                pages={pages}
                activePageId={activePageId}
                onSelectPage={setActivePageId}
                onAddPage={addPage}
                onReorder={reorderPages}
                onRenamePage={updatePageTitle}
              />
            ) : (
              <FieldPalette onAddField={addField} />
            )}
          </div>
        </aside>
        )}

        {/* Center panel — canvas */}
        <main className="flex-1 overflow-y-auto">
          <FormCanvas
            formId={formId}
            pages={pages}
            activePageId={activePageId}
            onSelectPage={setActivePageId}
            selectedFieldId={previewMode ? null : selectedFieldId}
            onSelectField={previewMode ? () => {} : setSelectedFieldId}
            onReorderFields={reorderFields}
            onRemoveField={removeField}
            onRenamePageTitle={updatePageTitle}
            previewMode={previewMode}
            formStyle={form ? {
              formName: formName,
              publicStyle: form.publicStyle || 'MINIMAL',
              publicImageUrl: form.publicImageUrl ?? null,
              publicImageSide: form.publicImageSide || 'RIGHT',
              publicCtaColor: form.publicCtaColor ?? null,
              publicBgColor: form.publicBgColor ?? null,
              coverColor: form.coverColor ?? null,
              logoUrl: form.logoUrl ?? null,
              isSystem: !!form.systemKey,
            } : undefined}
          />
        </main>

        {/* Right panel — field properties or form style (hidden in preview) */}
        {!previewMode && (
        <aside className="w-72 bg-white border-l border-slate-200 overflow-y-auto flex-shrink-0">
          {selectedField ? (
            <FieldProperties
              field={selectedField}
              allFields={activePage?.fields ?? []}
              onUpdate={(patch) => {
                if (selectedFieldId) updateField(selectedFieldId, patch)
              }}
              onRemove={() => {
                if (selectedFieldId) removeField(selectedFieldId)
              }}
              isSystemForm={!!form.systemKey}
            />
          ) : form.systemKey ? (
            // System forms — no public styling, just a hint
            <div className="flex items-center justify-center h-full text-center px-6">
              <div>
                <Settings className="w-8 h-8 text-slate-200 mx-auto mb-3" />
                <p className="text-xs text-slate-400">Select a field on the canvas to edit its properties.</p>
                <p className="text-[10px] text-slate-300 mt-2">System forms are used internally and don&apos;t have public styling options.</p>
              </div>
            </div>
          ) : (
            <FormStylePanel
              formId={formId}
              publicStyle={(form.publicStyle || 'MINIMAL') as 'MINIMAL' | 'SPLIT' | 'HERO'}
              publicImageUrl={form.publicImageUrl ?? null}
              publicImageSide={(form.publicImageSide || 'RIGHT') as 'LEFT' | 'RIGHT'}
              publicCtaColor={form.publicCtaColor ?? null}
              publicBgColor={form.publicBgColor ?? null}
              coverColor={form.coverColor ?? null}
              logoUrl={form.logoUrl ?? null}
              requireEmail={form.requireEmail ?? true}
              confirmMessage={form.confirmMessage ?? null}
              onUpdate={updateFormStyle}
            />
          )}
        </aside>
        )}
      </div>

      )}
    </div>
  )
}
