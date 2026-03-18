'use client'

/**
 * BudgetRevenueSection — Revenue tracking for event budgets.
 *
 * Two sub-sections:
 * 1. Registration Revenue — auto-synced from Stripe (read-only)
 * 2. Other Revenue — manual entries (inline add form)
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { z } from 'zod'
import {
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import { listItem, staggerContainer } from '@/lib/animations'
import type { BudgetRevenueRow, BudgetRevenueInput, BudgetRevenueSource } from '@/lib/types/budget'
import { BUDGET_REVENUE_SOURCES } from '@/lib/types/budget'

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Source badge ─────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<BudgetRevenueSource, string> = {
  REGISTRATION_FEE: 'Registration',
  SPONSORSHIP: 'Sponsorship',
  FUNDRAISING: 'Fundraising',
  DONATION: 'Donation',
  GRANT: 'Grant',
  OTHER: 'Other',
}

const SOURCE_STYLES: Record<BudgetRevenueSource, string> = {
  REGISTRATION_FEE: 'bg-slate-100 text-slate-600',
  SPONSORSHIP: 'bg-blue-100 text-blue-700',
  FUNDRAISING: 'bg-green-100 text-green-700',
  DONATION: 'bg-purple-100 text-purple-700',
  GRANT: 'bg-amber-100 text-amber-700',
  OTHER: 'bg-slate-100 text-slate-600',
}

function SourceBadge({ source }: { source: BudgetRevenueSource }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_STYLES[source]}`}
    >
      {SOURCE_LABELS[source]}
    </span>
  )
}

// ─── Inline revenue form ──────────────────────────────────────────────────────

const RevenueFormSchema = z.object({
  source: z.enum(BUDGET_REVENUE_SOURCES),
  description: z.string().min(1, 'Description is required').max(500),
  amount: z
    .string()
    .min(1, 'Amount is required')
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, 'Must be a valid amount'),
  receivedDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
})

type RevenueFormValues = z.infer<typeof RevenueFormSchema>

interface InlineRevenueFormProps {
  initialValues?: Partial<RevenueFormValues>
  onSave: (data: BudgetRevenueInput) => void
  onCancel: () => void
  isSaving?: boolean
}

function InlineRevenueForm({
  initialValues,
  onSave,
  onCancel,
  isSaving = false,
}: InlineRevenueFormProps) {
  const [form, setForm] = useState<RevenueFormValues>({
    source: initialValues?.source ?? 'SPONSORSHIP',
    description: initialValues?.description ?? '',
    amount: initialValues?.amount ?? '',
    receivedDate: initialValues?.receivedDate ?? '',
    notes: initialValues?.notes ?? '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof RevenueFormValues, string>>>({})

  function updateField<K extends keyof RevenueFormValues>(key: K, value: RevenueFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = RevenueFormSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof RevenueFormValues, string>> = {}
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as keyof RevenueFormValues
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      })
      setErrors(fieldErrors)
      return
    }
    const data: BudgetRevenueInput = {
      source: result.data.source,
      description: result.data.description,
      amount: parseFloat(result.data.amount),
      receivedDate: result.data.receivedDate
        ? new Date(result.data.receivedDate).toISOString()
        : null,
      notes: result.data.notes || null,
    }
    onSave(data)
  }

  // Filter out REGISTRATION_FEE from manual entries (it's auto-synced)
  const manualSources = BUDGET_REVENUE_SOURCES.filter((s) => s !== 'REGISTRATION_FEE')

  return (
    <form onSubmit={handleSubmit} className="border border-indigo-200 rounded-xl p-4 bg-indigo-50/30 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Source */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Source <span className="text-red-500">*</span>
          </label>
          <select
            value={form.source}
            onChange={(e) => updateField('source', e.target.value as BudgetRevenueSource)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition cursor-pointer"
          >
            {manualSources.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        {/* Amount */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Amount <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => updateField('amount', e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-slate-200 bg-white pl-6 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition"
            />
          </div>
          {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount}</p>}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Description <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="e.g. Spring Gala sponsorship from ABC Corp"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition"
        />
        {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
      </div>

      {/* Date + Notes */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Received Date</label>
          <input
            type="date"
            value={form.receivedDate}
            onChange={(e) => updateField('receivedDate', e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition cursor-pointer"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Notes</label>
          <input
            type="text"
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="Optional notes"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving…' : 'Save Revenue'}
        </button>
      </div>
    </form>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface BudgetRevenueSectionProps {
  revenue: BudgetRevenueRow[]
  syncedAt: string | null
  onSync: () => void
  isSyncing?: boolean
  onAdd: (data: BudgetRevenueInput) => void
  onUpdate: (revenueId: string, data: Partial<BudgetRevenueInput>) => void
  onDelete: (revenueId: string) => void
  isMutating?: boolean
}

export function BudgetRevenueSection({
  revenue,
  syncedAt,
  onSync,
  isSyncing = false,
  onAdd,
  onUpdate,
  onDelete,
  isMutating = false,
}: BudgetRevenueSectionProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [editItem, setEditItem] = useState<BudgetRevenueRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BudgetRevenueRow | null>(null)

  const registrationRevenue = revenue.filter((r) => r.source === 'REGISTRATION_FEE')
  const otherRevenue = revenue.filter((r) => r.source !== 'REGISTRATION_FEE')

  const registrationTotal = registrationRevenue.reduce((sum, r) => sum + r.amount, 0)
  const otherTotal = otherRevenue.reduce((sum, r) => sum + r.amount, 0)
  const grandTotal = registrationTotal + otherTotal

  return (
    <div className="space-y-6">
      {/* ── Registration Revenue ── */}
      <div className="ui-glass rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Registration Revenue</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Auto-synced from Stripe{' '}
              {syncedAt && (
                <span>
                  · Last synced {formatDate(syncedAt)}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            Sync Now
          </button>
        </div>

        <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-xl">
          <div>
            <span className="text-sm text-slate-600">
              {registrationRevenue.length > 0
                ? `${registrationRevenue.length} payment${registrationRevenue.length !== 1 ? 's' : ''} recorded`
                : 'No payments recorded yet'}
            </span>
          </div>
          <span className="text-lg font-bold text-slate-900 font-mono">
            {formatCurrency(registrationTotal)}
          </span>
        </div>
      </div>

      {/* ── Other Revenue ── */}
      <div className="ui-glass rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Other Revenue</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Sponsorships, donations, grants, and other income
            </p>
          </div>
          <button
            onClick={() => {
              setEditItem(null)
              setShowAddForm(true)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 active:scale-[0.97] transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Revenue
          </button>
        </div>

        {/* Inline add form */}
        {showAddForm && !editItem && (
          <div className="mb-4">
            <InlineRevenueForm
              onSave={(data) => {
                onAdd(data)
                setShowAddForm(false)
              }}
              onCancel={() => setShowAddForm(false)}
              isSaving={isMutating}
            />
          </div>
        )}

        {otherRevenue.length === 0 && !showAddForm ? (
          <div className="py-8 text-center text-sm text-slate-400">
            No revenue entries yet. Add sponsorships, donations, and other income above.
          </div>
        ) : (
          <motion.div
            variants={staggerContainer(0.03)}
            initial="hidden"
            animate="visible"
            className="space-y-2"
          >
            {otherRevenue.map((item) => (
              <motion.div key={item.id} variants={listItem}>
                {editItem?.id === item.id ? (
                  <InlineRevenueForm
                    initialValues={{
                      source: item.source,
                      description: item.description,
                      amount: String(item.amount),
                      receivedDate: item.receivedDate
                        ? new Date(item.receivedDate).toISOString().split('T')[0]
                        : '',
                      notes: item.notes ?? '',
                    }}
                    onSave={(data) => {
                      onUpdate(item.id, data)
                      setEditItem(null)
                    }}
                    onCancel={() => setEditItem(null)}
                    isSaving={isMutating}
                  />
                ) : (
                  <div className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <SourceBadge source={item.source} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {item.description}
                        </p>
                        <p className="text-xs text-slate-400">{formatDate(item.receivedDate)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-900 font-mono">
                        {formatCurrency(item.amount)}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditItem(item)
                            setShowAddForm(false)
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}

        {otherRevenue.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex justify-end">
            <span className="text-xs text-slate-500">
              Other total:{' '}
              <span className="font-semibold text-slate-800 font-mono">
                {formatCurrency(otherTotal)}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* ── Grand total ── */}
      <div className="flex items-center justify-between px-5 py-4 bg-slate-900 rounded-xl">
        <span className="text-sm font-semibold text-white">Total Revenue</span>
        <span className="text-xl font-bold text-white font-mono">{formatCurrency(grandTotal)}</span>
      </div>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            onDelete(deleteTarget.id)
            setDeleteTarget(null)
          }
        }}
        title="Delete Revenue Entry"
        message={`Are you sure you want to delete the "${deleteTarget?.description}" entry? This cannot be undone.`}
        confirmText="Delete Entry"
        variant="danger"
      />
    </div>
  )
}

