'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Plus,
  FileText,
  CalendarClock,
  Wrench,
  Monitor,
  ClipboardList,
  ChevronRight,
  Search,
} from 'lucide-react'
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
  createdAt: string
  updatedAt: string
  pages: Array<{ id: string }>
  fields: Array<{ id: string }>
  _count?: { submissions: number }
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

export default function FormsHub() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<HubTab>('custom')
  const [search, setSearch] = useState('')
  const [showGallery, setShowGallery] = useState(false)

  const { data: forms = [], isLoading } = useQuery({
    queryKey: queryKeys.forms.all,
    queryFn: () => fetchApi<FormListItem[]>('/api/forms/hub'),
    staleTime: 60_000,
  })

  const systemForms = forms.filter((f) => f.isDefault || f.systemKey)
  const customForms = forms.filter((f) => !f.isDefault && !f.systemKey)

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
    { key: 'custom', label: 'Custom' },
    { key: 'system', label: 'System' },
  ]

  // ─── Loading skeleton ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="px-4 sm:px-8 py-6 space-y-6 max-w-5xl">
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
    <div className="px-4 sm:px-8 py-6 space-y-6 max-w-5xl">
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

      {/* Tabs */}
      <div className="flex items-center gap-1">
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
                  activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  {tabCounts[tab.key]}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

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
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">{form.pages.length}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">{form.fields.length}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">
                        {new Date(form.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-2 py-3">
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── System Tab ─────────────────────────────────────────────────── */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          {Array.from(systemGroups.entries()).map(([groupLabel, groupForms]) => (
            <div key={groupLabel} className="space-y-3">
              <h2 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1">
                {groupLabel}
              </h2>
              <div className="space-y-2">
                {groupForms.map(({ config, ...form }) => (
                  <FormCard
                    key={form.id}
                    icon={config.icon}
                    label={config.label}
                    description={config.description}
                    fieldCount={form.fields.length}
                    pageCount={form.pages.length}
                    submissionCount={form._count?.submissions ?? 0}
                    isSystem
                    onClick={() => handleOpenBuilder(form.id)}
                  />
                ))}
              </div>
            </div>
          ))}

          {systemGroups.size === 0 && (
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
