'use client'

/**
 * BudgetLineItemTable — Spreadsheet-style budget table grouped by category.
 *
 * Each category header is collapsible. Columns: Description, Vendor, Budgeted,
 * Actual, Expense Date, Receipt, Actions. Footer row shows grand totals.
 *
 * AI Estimate button: fetches budget estimates per category, shows comparison
 * panel, and allows applying estimates to unfilled categories.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Plus,
  Receipt,
  Sparkles,
  X,
  Loader2,
  Check,
} from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import { listItem, staggerContainer, fadeInUp } from '@/lib/animations'
import type { BudgetCategoryRow, BudgetLineItemRow } from '@/lib/types/budget'
import type { AIHistoricalBudgetEstimate } from '@/lib/types/event-ai'

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '—'
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

// ─── Category section ─────────────────────────────────────────────────────────

interface CategorySectionProps {
  category: BudgetCategoryRow
  items: BudgetLineItemRow[]
  onAddExpense: (categoryId: string) => void
  onEdit: (item: BudgetLineItemRow) => void
  onDelete: (item: BudgetLineItemRow) => void
}

function CategorySection({
  category,
  items,
  onAddExpense,
  onEdit,
  onDelete,
}: CategorySectionProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BudgetLineItemRow | null>(null)

  const totalBudgeted = items.reduce((sum, item) => sum + item.budgetedAmount, 0)
  const totalActual = items.reduce((sum, item) => sum + (item.actualAmount ?? 0), 0)

  return (
    <motion.div variants={listItem} className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Category header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center gap-2">
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
          )}
          <span className="text-sm font-semibold text-slate-800">{category.name}</span>
          <span className="text-xs text-slate-400 font-normal">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <div className="flex items-center gap-6 text-xs text-slate-500">
          <span>
            Budgeted:{' '}
            <span className="font-semibold text-slate-700">{formatCurrency(totalBudgeted)}</span>
          </span>
          <span>
            Actual:{' '}
            <span
              className={`font-semibold ${
                totalActual > totalBudgeted ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {formatCurrency(totalActual)}
            </span>
          </span>
        </div>
      </button>

      {/* Collapsible content */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            {items.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400">
                No expenses in this category yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-white">
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Description
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Vendor
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Budgeted
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Actual
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Date
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wide">
                        Receipt
                      </th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const isOver =
                        item.actualAmount != null && item.actualAmount > item.budgetedAmount
                      const isUnder =
                        item.actualAmount != null && item.actualAmount <= item.budgetedAmount
                      return (
                        <tr
                          key={item.id}
                          className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="px-4 py-2.5 text-slate-800 font-medium">
                            {item.description}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500">{item.vendor ?? '—'}</td>
                          <td className="px-4 py-2.5 text-right text-slate-700 font-mono text-xs">
                            {formatCurrency(item.budgetedAmount)}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-mono text-xs font-semibold ${
                              isOver
                                ? 'text-red-600'
                                : isUnder
                                ? 'text-green-600'
                                : 'text-slate-400'
                            }`}
                          >
                            {formatCurrency(item.actualAmount)}
                          </td>
                          <td className="px-4 py-2.5 text-slate-500 text-xs">
                            {formatDate(item.expenseDate)}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {item.receiptUrl ? (
                              <a
                                href={item.receiptUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-50 text-indigo-500 hover:bg-indigo-100 transition-colors cursor-pointer"
                                title="View receipt"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                              </a>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => onEdit(item)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Edit expense"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(item)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                title="Delete expense"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add expense button per category */}
            <div className="px-4 py-2 border-t border-slate-100">
              <button
                onClick={() => onAddExpense(category.id)}
                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium py-1 px-2 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Expense
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            onDelete(deleteTarget)
            setDeleteTarget(null)
          }
        }}
        title="Delete Expense"
        message={`Are you sure you want to delete "${deleteTarget?.description}"? This cannot be undone.`}
        confirmText="Delete Expense"
        variant="danger"
      />
    </motion.div>
  )
}

// ─── AI Estimate Panel ────────────────────────────────────────────────────────

interface AIEstimatePanelProps {
  estimate: AIHistoricalBudgetEstimate
  lineItems: BudgetLineItemRow[]
  onApply: (suggestions: { categoryName: string; amount: number }[]) => void
  onDismiss: () => void
}

function AIEstimatePanel({ estimate, lineItems, onApply, onDismiss }: AIEstimatePanelProps) {
  // Build current budgeted totals per category name
  const budgetedByCategory: Record<string, number> = {}
  for (const item of lineItems) {
    budgetedByCategory[item.categoryName] =
      (budgetedByCategory[item.categoryName] ?? 0) + item.budgetedAmount
  }

  // Only suggest estimates for categories not yet budgeted
  const suggestions = estimate.categories.filter(
    (cat) => !budgetedByCategory[cat.name] || budgetedByCategory[cat.name] === 0,
  )

  function handleApply() {
    const toApply = suggestions.map((s) => ({
      categoryName: s.name,
      amount: Math.round((s.estimatedMin + s.estimatedMax) / 2),
    }))
    onApply(toApply)
  }

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="border border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/70 border-b border-indigo-100">
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-slate-900">AI Budget Estimate</span>
          {estimate.isHistorical && (estimate.sourceEventCount ?? 0) > 0 && (
            <span className="text-xs text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full font-medium">
              Based on {estimate.sourceEventCount} past events
            </span>
          )}
          {!estimate.isHistorical && (
            <span className="text-xs text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full font-medium">
              AI Generated
            </span>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/50 transition-colors cursor-pointer flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Reasoning */}
      {estimate.reasoning && (
        <p className="px-4 pt-3 text-xs text-slate-600 leading-relaxed">{estimate.reasoning}</p>
      )}

      {/* Category estimates */}
      <div className="p-4 space-y-2">
        {estimate.categories.map((cat) => {
          const existingAmount = budgetedByCategory[cat.name]
          const hasExisting = existingAmount != null && existingAmount > 0
          return (
            <div
              key={cat.name}
              className={`flex items-center justify-between text-sm px-3 py-2 rounded-lg ${
                hasExisting ? 'bg-white/40 opacity-60' : 'bg-white/70'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {hasExisting ? (
                  <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                )}
                <span className="font-medium text-slate-800 truncate">{cat.name}</span>
                {hasExisting && (
                  <span className="text-xs text-slate-400 ml-1 flex-shrink-0">already budgeted</span>
                )}
              </div>
              <span className="text-xs text-slate-600 font-mono flex-shrink-0 ml-4">
                {formatCurrency(cat.estimatedMin)} – {formatCurrency(cat.estimatedMax)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Totals + actions */}
      <div className="px-4 pb-4 flex items-center justify-between border-t border-indigo-100 pt-3 gap-3 flex-wrap">
        <div className="text-xs text-slate-600">
          Total estimate:{' '}
          <span className="font-semibold text-slate-900">
            {formatCurrency(estimate.totalMin)} – {formatCurrency(estimate.totalMax)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 rounded-lg hover:bg-white/60 transition-colors cursor-pointer"
          >
            Dismiss
          </button>
          {suggestions.length > 0 ? (
            <button
              onClick={handleApply}
              className="px-4 py-1.5 text-xs font-medium rounded-full bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.97] transition-all cursor-pointer"
            >
              Apply {suggestions.length} estimate{suggestions.length === 1 ? '' : 's'}
            </button>
          ) : (
            <span className="text-xs text-slate-400">All categories already budgeted</span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export interface BudgetLineItemTableProps {
  eventProjectId: string
  categories: BudgetCategoryRow[]
  lineItems: BudgetLineItemRow[]
  onAddExpense: (categoryId: string) => void
  onEdit: (item: BudgetLineItemRow) => void
  onDelete: (item: BudgetLineItemRow) => void
  onApplyEstimates?: (suggestions: { categoryName: string; amount: number }[]) => void
}

export function BudgetLineItemTable({
  eventProjectId,
  categories,
  lineItems,
  onAddExpense,
  onEdit,
  onDelete,
  onApplyEstimates,
}: BudgetLineItemTableProps) {
  const [estimating, setEstimating] = useState(false)
  const [estimate, setEstimate] = useState<AIHistoricalBudgetEstimate | null>(null)
  const [estimateError, setEstimateError] = useState<string | null>(null)

  const totalBudgeted = lineItems.reduce((sum, item) => sum + item.budgetedAmount, 0)
  const totalActual = lineItems.reduce((sum, item) => sum + (item.actualAmount ?? 0), 0)

  // Sort categories by sortOrder
  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)

  async function handleAIEstimate() {
    setEstimating(true)
    setEstimateError(null)
    try {
      const res = await fetch('/api/events/ai/estimate-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventProjectId }),
      })
      const json = (await res.json()) as { ok: boolean; data?: AIHistoricalBudgetEstimate; error?: { message: string } }
      if (json.ok && json.data) {
        setEstimate(json.data)
      } else {
        setEstimateError(json.error?.message ?? 'Failed to generate estimate')
      }
    } catch {
      setEstimateError('Network error — please try again')
    } finally {
      setEstimating(false)
    }
  }

  function handleApplyEstimates(suggestions: { categoryName: string; amount: number }[]) {
    onApplyEstimates?.(suggestions)
    setEstimate(null)
  }

  return (
    <div className="space-y-3">
      {/* AI Estimate button */}
      <div className="flex items-center justify-end">
        <button
          onClick={handleAIEstimate}
          disabled={estimating}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 active:scale-[0.97] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {estimating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {estimating ? 'Estimating...' : 'AI Estimate'}
        </button>
      </div>

      {/* Error alert */}
      {estimateError && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <X className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{estimateError}</span>
          <button
            onClick={() => setEstimateError(null)}
            className="text-red-400 hover:text-red-600 cursor-pointer flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* AI Estimate panel */}
      <AnimatePresence>
        {estimate && (
          <AIEstimatePanel
            estimate={estimate}
            lineItems={lineItems}
            onApply={handleApplyEstimates}
            onDismiss={() => setEstimate(null)}
          />
        )}
      </AnimatePresence>

      {/* Category sections */}
      <motion.div
        variants={staggerContainer(0.04)}
        initial="hidden"
        animate="visible"
        className="space-y-3"
      >
        {sortedCategories.map((category) => {
          const items = lineItems
            .filter((item) => item.categoryId === category.id)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          return (
            <CategorySection
              key={category.id}
              category={category}
              items={items}
              onAddExpense={onAddExpense}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )
        })}
      </motion.div>

      {/* Grand total footer */}
      {lineItems.length > 0 && (
        <div className="flex items-center justify-end gap-8 px-4 py-3 bg-slate-900 rounded-xl text-sm">
          <span className="text-slate-300 font-medium">Grand Total</span>
          <div className="flex items-center gap-6">
            <span className="text-slate-300 text-xs">
              Budgeted:{' '}
              <span className="text-white font-semibold font-mono">
                {formatCurrency(totalBudgeted)}
              </span>
            </span>
            <span className="text-slate-300 text-xs">
              Actual:{' '}
              <span
                className={`font-semibold font-mono ${
                  totalActual > totalBudgeted ? 'text-red-400' : 'text-green-400'
                }`}
              >
                {formatCurrency(totalActual)}
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
