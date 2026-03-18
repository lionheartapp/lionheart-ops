'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  LayoutGrid,
  Shield,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Tag,
  Calendar,
  Check,
  AlertCircle,
} from 'lucide-react'
import { tabContent, staggerContainer, listItem, fadeInUp } from '@/lib/animations'
import {
  useDocumentRequirements,
  useDeleteDocumentRequirement,
  type DocumentRequirement,
} from '@/lib/hooks/useEventDocuments'
import { DocumentRequirementDrawer } from './documents/DocumentRequirementDrawer'
import { DocumentMatrix } from './documents/DocumentMatrix'
import { ComplianceChecklist } from './documents/ComplianceChecklist'
import { useToast } from '@/components/Toast'

// ─── Types ──────────────────────────────────────────────────────────────

type SubTab = 'requirements' | 'completion' | 'compliance'

interface EventDocumentsTabProps {
  eventProjectId: string
  canReadMedical?: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  PERMISSION_SLIP: 'Permission Slip',
  WAIVER: 'Waiver',
  MEDICAL_RELEASE: 'Medical Release',
  PHOTO_RELEASE: 'Photo Release',
  CUSTOM: 'Custom',
}

const DOCUMENT_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  PERMISSION_SLIP: { bg: 'bg-blue-100', text: 'text-blue-700' },
  WAIVER: { bg: 'bg-orange-100', text: 'text-orange-700' },
  MEDICAL_RELEASE: { bg: 'bg-red-100', text: 'text-red-700' },
  PHOTO_RELEASE: { bg: 'bg-purple-100', text: 'text-purple-700' },
  CUSTOM: { bg: 'bg-slate-100', text: 'text-slate-600' },
}

function docTypeConfig(type: string) {
  return {
    label: DOCUMENT_TYPE_LABELS[type] ?? type,
    ...(DOCUMENT_TYPE_COLORS[type] ?? { bg: 'bg-slate-100', text: 'text-slate-600' }),
  }
}

// ─── Skeleton ────────────────────────────────────────────────────────────

function RequirementsSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-14 bg-slate-100 rounded-xl" />
      ))}
    </div>
  )
}

// ─── Requirements Sub-tab ────────────────────────────────────────────────

interface RequirementsTabProps {
  eventProjectId: string
  canReadMedical: boolean
}

function RequirementsSubTab({ eventProjectId }: RequirementsTabProps) {
  const { data, isLoading } = useDocumentRequirements(eventProjectId)
  const deleteMutation = useDeleteDocumentRequirement(eventProjectId)
  const { toast } = useToast()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingReq, setEditingReq] = useState<DocumentRequirement | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const requirements = data?.requirements ?? []
  const stats = data?.stats

  async function handleDelete(req: DocumentRequirement) {
    setDeletingId(req.id)
    try {
      await deleteMutation.mutateAsync(req.id)
      toast(`Removed "${req.label}"`, 'success')
    } catch {
      toast('Failed to delete requirement', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  function handleEdit(req: DocumentRequirement) {
    setEditingReq(req)
    setDrawerOpen(true)
  }

  function handleAdd() {
    setEditingReq(null)
    setDrawerOpen(true)
  }

  if (isLoading) return <RequirementsSkeleton />

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      {stats && requirements.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="ui-glass p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{stats.totalRequirements}</p>
            <p className="text-xs text-slate-500 mt-0.5">Requirements</p>
          </div>
          <div className="ui-glass p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{stats.totalRegistrations}</p>
            <p className="text-xs text-slate-500 mt-0.5">Participants</p>
          </div>
          <div className="ui-glass p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{Math.round(stats.completionPercentage)}%</p>
            <p className="text-xs text-slate-500 mt-0.5">Complete</p>
          </div>
        </div>
      )}

      {/* Add button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {requirements.length === 0
            ? 'No document requirements yet'
            : `${requirements.length} document requirement${requirements.length === 1 ? '' : 's'}`}
        </p>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Requirement
        </button>
      </div>

      {/* List */}
      {requirements.length === 0 ? (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
          className="text-center py-12"
        >
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-6 h-6 text-indigo-400" />
          </div>
          <p className="text-sm text-slate-500 max-w-xs mx-auto">
            Add document requirements like permission slips, waivers, and medical releases.
          </p>
        </motion.div>
      ) : (
        <motion.ul
          variants={staggerContainer(0.04)}
          initial="hidden"
          animate="visible"
          className="space-y-2"
        >
          {requirements.map((req) => {
            const dtCfg = docTypeConfig(req.documentType)
            return (
              <motion.li
                key={req.id}
                variants={listItem}
                className="group flex items-center gap-3 p-3.5 bg-white border border-slate-100 rounded-xl hover:border-slate-200 hover:bg-slate-50/40 transition-all"
              >
                {/* Required indicator */}
                {req.isRequired ? (
                  <AlertCircle
                    className="w-4 h-4 text-amber-400 flex-shrink-0"
                    aria-label="Required"
                  />
                ) : (
                  <Check
                    className="w-4 h-4 text-slate-300 flex-shrink-0"
                    aria-label="Optional"
                  />
                )}

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{req.label}</p>
                  {req.description && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">{req.description}</p>
                  )}
                </div>

                {/* Type badge */}
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${dtCfg.bg} ${dtCfg.text}`}
                >
                  <Tag className="w-3 h-3" />
                  {dtCfg.label}
                </span>

                {/* Due date */}
                {req.dueDate && (
                  <span className="flex items-center gap-1 text-xs text-slate-400 flex-shrink-0 hidden sm:flex">
                    <Calendar className="w-3 h-3" />
                    {new Date(req.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(req)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all cursor-pointer"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(req)}
                    disabled={deletingId === req.id}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer disabled:opacity-50"
                    title="Delete"
                  >
                    {deletingId === req.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </motion.li>
            )
          })}
        </motion.ul>
      )}

      {/* Drawer */}
      <DocumentRequirementDrawer
        eventProjectId={eventProjectId}
        isOpen={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditingReq(null) }}
        requirement={editingReq}
      />
    </div>
  )
}

// ─── Sub-tab pill bar ────────────────────────────────────────────────────

interface SubTabBarProps {
  active: SubTab
  onChange: (t: SubTab) => void
}

const SUB_TABS: { id: SubTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'requirements', label: 'Requirements', icon: FileText },
  { id: 'completion', label: 'Completion', icon: LayoutGrid },
  { id: 'compliance', label: 'Compliance', icon: Shield },
]

function SubTabBar({ active, onChange }: SubTabBarProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
      {SUB_TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
            active === id
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Icon className={`w-3.5 h-3.5 ${active === id ? 'text-indigo-500' : 'text-slate-400'}`} />
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── Header stats bar ────────────────────────────────────────────────────

function DocumentsHeaderStats({ eventProjectId }: { eventProjectId: string }) {
  const { data } = useDocumentRequirements(eventProjectId)
  const stats = data?.stats

  if (!stats || stats.totalRequirements === 0) return null

  const pct = Math.round(stats.completionPercentage)

  return (
    <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-indigo-50/80 to-blue-50/80 border border-indigo-100/60 rounded-2xl">
      {/* Progress bar */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-indigo-700">Overall Completion</span>
          <span className="text-xs font-bold text-indigo-700">{pct}%</span>
        </div>
        <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Quick stats */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="text-center">
          <p className="text-lg font-bold text-slate-900">{stats.totalRequirements}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Docs</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-slate-900">{stats.totalRegistrations}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Participants</p>
        </div>
      </div>
    </div>
  )
}

// ─── Component ───────────────────────────────────────────────────────────

export function EventDocumentsTab({ eventProjectId, canReadMedical = false }: EventDocumentsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('requirements')

  function renderSubTab() {
    switch (activeSubTab) {
      case 'requirements':
        return (
          <RequirementsSubTab
            eventProjectId={eventProjectId}
            canReadMedical={canReadMedical}
          />
        )
      case 'completion':
        return (
          <DocumentMatrix
            eventProjectId={eventProjectId}
            canReadMedical={canReadMedical}
          />
        )
      case 'compliance':
        return <ComplianceChecklist eventProjectId={eventProjectId} />
    }
  }

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="space-y-5"
    >
      {/* Header stats */}
      <DocumentsHeaderStats eventProjectId={eventProjectId} />

      {/* Sub-tab bar */}
      <SubTabBar active={activeSubTab} onChange={setActiveSubTab} />

      {/* Sub-tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          variants={tabContent}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {renderSubTab()}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
