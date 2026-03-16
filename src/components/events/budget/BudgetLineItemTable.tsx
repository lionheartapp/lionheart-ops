'use client'

/**
 * BudgetLineItemTable — Spreadsheet-style budget table grouped by category.
 *
 * Each category header is collapsible. Columns: Description, Vendor, Budgeted,
 * Actual, Expense Date, Receipt, Actions. Footer row shows grand totals.
 *
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Pencil, Trash2, Plus, Receipt } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import { listItem, staggerContainer } from '@/lib/animations'
import type { BudgetCategoryRow, BudgetLineItemRow } from '@/lib/types/budget'

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
    <motion.div variants={listItem} className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Category header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer text-left"
      >
        <div className="flex items-center gap-2">
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
          <span className="text-sm font-semibold text-gray-800">{category.name}</span>
          <span className="text-xs text-gray-400 font-normal">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        <div className="flex items-center gap-6 text-xs text-gray-500">
          <span>
            Budgeted: <span className="font-semibold text-gray-700">{formatCurrency(totalBudgeted)}</span>
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
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                No expenses in this category yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-white">
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Description
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Vendor
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Budgeted
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Actual
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Date
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">
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
                          className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                        >
                          <td className="px-4 py-2.5 text-gray-800 font-medium">{item.description}</td>
                          <td className="px-4 py-2.5 text-gray-500">{item.vendor ?? '—'}</td>
                          <td className="px-4 py-2.5 text-right text-gray-700 font-mono text-xs">
                            {formatCurrency(item.budgetedAmount)}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-mono text-xs font-semibold ${
                              isOver
                                ? 'text-red-600'
                                : isUnder
                                ? 'text-green-600'
                                : 'text-gray-400'
                            }`}
                          >
                            {formatCurrency(item.actualAmount)}
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs">
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
                              <span className="text-gray-300 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => onEdit(item)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                                title="Edit expense"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(item)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
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
            <div className="px-4 py-2 border-t border-gray-100">
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

// ─── Main Component ───────────────────────────────────────────────────────────

export interface BudgetLineItemTableProps {
  categories: BudgetCategoryRow[]
  lineItems: BudgetLineItemRow[]
  onAddExpense: (categoryId: string) => void
  onEdit: (item: BudgetLineItemRow) => void
  onDelete: (item: BudgetLineItemRow) => void
}

export function BudgetLineItemTable({
  categories,
  lineItems,
  onAddExpense,
  onEdit,
  onDelete,
}: BudgetLineItemTableProps) {
  const totalBudgeted = lineItems.reduce((sum, item) => sum + item.budgetedAmount, 0)
  const totalActual = lineItems.reduce((sum, item) => sum + (item.actualAmount ?? 0), 0)

  // Sort categories by sortOrder
  const sortedCategories = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <div className="space-y-3">
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
        <div className="flex items-center justify-end gap-8 px-4 py-3 bg-gray-900 rounded-xl text-sm">
          <span className="text-gray-300 font-medium">Grand Total</span>
          <div className="flex items-center gap-6">
            <span className="text-gray-300 text-xs">
              Budgeted:{' '}
              <span className="text-white font-semibold font-mono">
                {formatCurrency(totalBudgeted)}
              </span>
            </span>
            <span className="text-gray-300 text-xs">
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
