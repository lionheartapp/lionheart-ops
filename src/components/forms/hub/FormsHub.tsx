'use client'

import { useState, Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  Plus,
  FileText,
  CalendarClock,
  Wrench,
  Monitor,
  ClipboardList,
  ChevronRight,
  Search,
  Globe,
  Lock,
  MoreHorizontal,
  Archive,
  Copy,
  Trash2,
  ArchiveRestore,
  AlertTriangle,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import { queryKeys } from '@/lib/queries'
import FormCard from './FormCard'
import FormTemplateGallery from '@/components/forms/templates/FormTemplateGallery'

// ─── Types ──────────────────────────────────────────────────────────────────

interface FormListItem {
  id: string
  context: string
  systemKey: string | null
  isDefault: boolean
  description: string | null
  categoryKey: string | null
  createdBy: string | null
  visibility: 'PRIVATE' | 'SHARED'
  status?: 'ACTIVE' | 'ARCHIVED'
  createdAt: string
  updatedAt: string
  pages: Array<{ id: string }>
  fields: Array<{ id: string }>
  _count?: { submissions: number }
  updatedByUser?: { id: string; firstName: string | null; lastName: string | null; avatar: string | null } | null
}

// ─── System form display config ─────────────────────────────────────────────

interface SystemFormConfig {
  key: string
  label: string
  description: string
  icon: typeof CalendarClock
  group: string
}

const SYSTEM_FORM_CONFIG: SystemFormConfig[] = [
  // School Events
  { key: 'single_event', label: 'Single Event', description: 'A one-time event on a specific date', icon: CalendarClock, group: 'SCHOOL EVENTS' },
  { key: 'recurring_event', label: 'Recurring Event', description: 'Repeats on a schedule', icon: CalendarClock, group: 'SCHOOL EVENTS' },
  { key: 'multiday_event', label: 'Multi-day Event', description: 'Spans across multiple days', icon: CalendarClock, group: 'SCHOOL EVENTS' },
  // Support
  { key: 'facilities_request', label: 'Facilities Request', description: 'Submit a facilities request', icon: Wrench, group: 'SUPPORT' },
  { key: 'it_request', label: 'IT Request', description: 'Submit an IT support request', icon: Monitor, group: 'SUPPORT' },
  // Registration
  { key: 'event_registration', label: 'Event Registration', description: 'Public registration form for events', icon: ClipboardList, group: 'REGISTRATION' },
]

function getSystemConfig(systemKey: string | null): SystemFormConfig | undefined {
  return SYSTEM_FORM_CONFIG.find((c) => c.key === systemKey)
}

type HubTab = 'custom' | 'system'

// ─── Component ──────────────────────────────────────────────────────────────

interface FormInfo {
  id: string
  name: string
  isSystem: boolean
  submissions: number
  orders: number
  tickets: number
  linkedEvent: string | null
}

export default function FormsHub() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState<HubTab>(isAdmin ? 'system' : 'custom')
  const [search, setSearch] = useState('')
  const [showGallery, setShowGallery] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<FormInfo | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const { data: forms = [], isLoading } = useQuery({
    queryKey: queryKeys.forms.all,
    queryFn: () => fetchApi<FormListItem[]>('/api/forms/hub'),
    staleTime: 60_000,
  })

  const systemForms = forms.filter((f) => f.isDefault || f.systemKey)
  const allCustomForms = forms.filter((f) => !f.isDefault && !f.systemKey)
  const customForms = allCustomForms.filter((f) => (f as FormListItem & { status?: string }).status !== 'ARCHIVED')
  const archivedForms = allCustomForms.filter((f) => (f as FormListItem & { status?: string }).status === 'ARCHIVED')

  // Mutations
  const archiveMutation = useMutation({
    mutationFn: ({ formId, action }: { formId: string; action: 'archive' | 'unarchive' }) =>
      fetchApi(`/api/forms/${formId}/archive`, { method: 'POST', body: JSON.stringify({ action }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.forms.all }),
  })

  const duplicateMutation = useMutation({
    mutationFn: (formId: string) =>
      fetchApi<{ id: string }>(`/api/forms/${formId}/duplicate`, { method: 'POST' }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forms.all })
      if (data?.id) router.push(`/forms/${data.id}/builder`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (formId: string) =>
      fetchApi(`/api/forms/${formId}/detail`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forms.all })
      setDeleteConfirm(null)
    },
  })

  async function handleMenuAction(formId: string, action: 'archive' | 'duplicate' | 'delete') {
    setMenuOpenId(null)
    if (action === 'archive') {
      archiveMutation.mutate({ formId, action: 'archive' })
    } else if (action === 'duplicate') {
      duplicateMutation.mutate(formId)
    } else if (action === 'delete') {
      // Fetch info before showing confirmation
      try {
        const info = await fetchApi<FormInfo>(`/api/forms/${formId}/info`)
        setDeleteConfirm(info)
      } catch {
        setDeleteConfirm({ id: formId, name: 'this form', isSystem: false, submissions: 0, orders: 0, tickets: 0, linkedEvent: null })
      }
    }
  }

  // Group system forms by their display group
  const systemGroups = new Map<string, Array<FormListItem & { config: SystemFormConfig }>>()
  for (const form of systemForms) {
    const config = getSystemConfig(form.systemKey)
    if (!config) continue
    const group = systemGroups.get(config.group) ?? []
    group.push({ ...form, config })
    systemGroups.set(config.group, group)
  }

  // Filter custom forms by search
  const filteredCustom = search
    ? customForms.filter((f) =>
        (f.description ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : customForms

  const handleOpenBuilder = (formId: string) => {
    router.push(`/forms/${formId}/builder`)
  }

  // Tab counts for badges
  const tabCounts = {
    custom: customForms.length,
    system: systemForms.length,
  }

  const tabs: { key: HubTab; label: string }[] = [
    ...(isAdmin ? [{ key: 'system' as const, label: 'System' }] : []),
    { key: 'custom', label: 'Custom' },
  ]

  // ─── Loading skeleton ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="px-4 sm:px-8 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-7 w-32 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-9 w-28 bg-slate-200 rounded-full animate-pulse" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 animate-pulse">
            <div className="w-10 h-10 rounded-lg bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 bg-slate-200 rounded" />
              <div className="h-3 w-56 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Forms</h1>
        <button
          onClick={() => setShowGallery(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 transition-colors duration-200 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create Form
        </button>
      </div>

      {/* Tabs — hide when only one tab (non-admin users) */}
      {tabs.length > 1 && <div className="flex items-center gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-2 text-sm font-medium rounded-full cursor-pointer transition-colors duration-200 ${
              activeTab === tab.key
                ? 'text-white'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {activeTab === tab.key && (
              <motion.div
                layoutId="forms-hub-tab-pill"
                className="absolute inset-0 bg-slate-900 rounded-full"
                transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {tab.label}
              {tabCounts[tab.key] > 0 && (
                <span className={`text-[10px] w-[18px] h-[18px] inline-flex items-center justify-center rounded-full ${
                  activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  {tabCounts[tab.key]}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>}

      {/* ─── Custom Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'custom' && (
        <div className="space-y-3">
          {customForms.length > 3 && (
            <div className="flex justify-end">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                {/* eslint-disable-next-line no-restricted-syntax -- inline search within a hub list, not a form field */}
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-40 pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition-colors"
                />
              </div>
            </div>
          )}

          {customForms.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">No custom forms yet</p>
              <p className="text-xs text-slate-500 mt-1">Create a form to collect responses from staff, parents, or the community.</p>
              <button
                onClick={() => setShowGallery(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 transition-colors duration-200 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Create Form
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Pages</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Fields</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Created</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCustom.map((form) => (
                    <tr
                      key={form.id}
                      onClick={() => handleOpenBuilder(form.id)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
                          </div>
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {form.description || 'Untitled Form'}
                          </span>
                          {form.visibility === 'SHARED' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 bg-indigo-50 rounded-full flex-shrink-0">
                              <Globe className="w-2.5 h-2.5" />
                              Shared
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-50 rounded-full flex-shrink-0">
                              <Lock className="w-2.5 h-2.5" />
                              Private
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">{form.pages.length}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">{form.fields.length}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">
                        {new Date(form.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="relative">
                          <button
                            onClick={() => setMenuOpenId(menuOpenId === form.id ? null : form.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {menuOpenId === form.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                              <div className="absolute right-0 top-8 z-20 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1">
                                <button
                                  onClick={() => handleMenuAction(form.id, 'duplicate')}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                                >
                                  <Copy className="w-3.5 h-3.5" /> Duplicate
                                </button>
                                <button
                                  onClick={() => handleMenuAction(form.id, 'archive')}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                                >
                                  <Archive className="w-3.5 h-3.5" /> Archive
                                </button>
                                <button
                                  onClick={() => handleMenuAction(form.id, 'delete')}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Archived section */}
          {archivedForms.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
              >
                <Archive className="w-3.5 h-3.5" />
                {showArchived ? 'Hide' : 'Show'} archived ({archivedForms.length})
              </button>
              {showArchived && (
                <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                  {archivedForms.map((form) => (
                    <div
                      key={form.id}
                      className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0"
                    >
                      <FileText className="w-4 h-4 text-slate-300 flex-shrink-0" />
                      <span className="text-sm text-slate-500 flex-1 truncate">{form.description || 'Untitled Form'}</span>
                      <button
                        onClick={() => archiveMutation.mutate({ formId: form.id, action: 'unarchive' })}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <ArchiveRestore className="w-3 h-3" /> Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm p-6 z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Delete form?</h3>
                <p className="text-xs text-slate-500">This cannot be undone</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 mb-4 space-y-1.5">
              <p className="text-sm font-medium text-slate-900">{deleteConfirm.name}</p>
              {deleteConfirm.submissions > 0 && (
                <p className="text-xs text-slate-600">{deleteConfirm.submissions} submission{deleteConfirm.submissions === 1 ? '' : 's'} will be deleted</p>
              )}
              {deleteConfirm.orders > 0 && (
                <p className="text-xs text-slate-600">{deleteConfirm.orders} order{deleteConfirm.orders === 1 ? '' : 's'} and {deleteConfirm.tickets} ticket{deleteConfirm.tickets === 1 ? '' : 's'} will be deleted</p>
              )}
              {deleteConfirm.linkedEvent && (
                <p className="text-xs text-amber-600">Linked to event: {deleteConfirm.linkedEvent}</p>
              )}
              {deleteConfirm.submissions === 0 && deleteConfirm.orders === 0 && !deleteConfirm.linkedEvent && (
                <p className="text-xs text-slate-400">No data attached — safe to delete</p>
              )}
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Consider archiving instead — it preserves all data for future reference and AI insights.
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  archiveMutation.mutate({ formId: deleteConfirm.id, action: 'archive' })
                  setDeleteConfirm(null)
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Archive instead
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-full hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── System Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'system' && (
        <div className="space-y-3">
          {systemGroups.size > 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Pages</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Fields</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Last Edited</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {Array.from(systemGroups.entries()).map(([groupLabel, groupForms]) => (
                    <Fragment key={groupLabel}>
                      {/* Group header row */}
                      <tr className="bg-slate-50/70">
                        <td colSpan={5} className="px-4 py-2">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{groupLabel}</span>
                        </td>
                      </tr>
                      {groupForms.map(({ config, ...form }) => {
                        const editorName = form.updatedByUser
                          ? `${form.updatedByUser.firstName ?? ''} ${form.updatedByUser.lastName ?? ''}`.trim()
                          : null
                        return (
                          <tr
                            key={form.id}
                            onClick={() => handleOpenBuilder(form.id)}
                            className="hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-100 last:border-b-0"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                                  <config.icon className="w-4 h-4 text-blue-600" strokeWidth={1.5} />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-sm font-medium text-slate-900 truncate block">{config.label}</span>
                                  <span className="text-xs text-slate-400 truncate block">{config.description}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">{form.pages.length}</td>
                            <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">{form.fields.length}</td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <div className="flex items-center gap-2">
                                {form.updatedByUser?.avatar ? (
                                  <img src={form.updatedByUser.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                                ) : editorName ? (
                                  <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-medium text-slate-500">
                                    {editorName.charAt(0)}
                                  </div>
                                ) : null}
                                <div className="flex flex-col">
                                  {editorName && <span className="text-[10px] text-slate-500 font-medium leading-tight">{editorName}</span>}
                                  <span className="text-[10px] text-slate-400 leading-tight">
                                    {new Date(form.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-3">
                              <ChevronRight className="w-4 h-4 text-slate-300" />
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">System forms will appear here once configured.</p>
            </div>
          )}
        </div>
      )}

      <FormTemplateGallery
        isOpen={showGallery}
        onClose={() => setShowGallery(false)}
      />
    </div>
  )
}
