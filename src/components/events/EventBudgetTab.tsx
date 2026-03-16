'use client'

/**
 * EventBudgetTab — Full event budget management interface.
 *
 * Three sub-tabs (pill-style toggle):
 * - Expenses: BudgetLineItemTable + BudgetExpenseDrawer
 * - Revenue: BudgetRevenueSection
 * - Report: BudgetReportView (budget vs actual)
 *
 * Replaces the placeholder stub from Phase 22 plan setup.
 */

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import { fadeInUp, tabContent } from '@/lib/animations'
import {
  useBudgetData,
  useBudgetRevenue,
  useBudgetReport,
  useBudgetMutations,
} from '@/lib/hooks/useBudget'
import { BudgetLineItemTable } from './budget/BudgetLineItemTable'
import { BudgetExpenseDrawer } from './budget/BudgetExpenseDrawer'
import { BudgetRevenueSection } from './budget/BudgetRevenueSection'
import { BudgetReportView } from './budget/BudgetReportView'
import type { BudgetLineItemRow, BudgetLineItemInput, BudgetRevenueInput } from '@/lib/types/budget'
import { useQueryClient } from '@tanstack/react-query'

// ─── Sub-tab types ─────────────────────────────────────────────────────────────

type SubTab = 'expenses' | 'revenue' | 'report'

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'expenses', label: 'Expenses' },
  { id: 'revenue', label: 'Revenue' },
  { id: 'report', label: 'Report' },
]

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

function ExpensesSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-200" />
              <div className="w-32 h-4 rounded bg-gray-200" />
              <div className="w-12 h-3 rounded bg-gray-100" />
            </div>
            <div className="flex gap-6">
              <div className="w-24 h-3 rounded bg-gray-200" />
              <div className="w-24 h-3 rounded bg-gray-200" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function RevenueSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="ui-glass rounded-xl p-5">
        <div className="w-48 h-4 rounded bg-gray-200 mb-2" />
        <div className="w-32 h-3 rounded bg-gray-100 mb-4" />
        <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl">
          <div className="w-40 h-4 rounded bg-gray-200" />
          <div className="w-24 h-6 rounded bg-gray-200" />
        </div>
      </div>
      <div className="ui-glass rounded-xl p-5">
        <div className="w-36 h-4 rounded bg-gray-200 mb-4" />
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center justify-between py-3">
            <div className="flex gap-3">
              <div className="w-20 h-5 rounded-full bg-gray-200" />
              <div className="w-40 h-4 rounded bg-gray-200" />
            </div>
            <div className="w-20 h-4 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ReportSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="ui-glass rounded-xl p-4">
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-200 flex-shrink-0" />
              <div className="flex-1">
                <div className="w-20 h-3 rounded bg-gray-200 mb-2" />
                <div className="w-28 h-5 rounded bg-gray-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="ui-glass-table rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="w-40 h-4 rounded bg-gray-200" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="flex-1 h-4 rounded bg-gray-200" />
              <div className="w-20 h-4 rounded bg-gray-200" />
              <div className="w-20 h-4 rounded bg-gray-200" />
              <div className="w-20 h-4 rounded bg-gray-200" />
              <div className="w-16 h-4 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface EventBudgetTabProps {
  eventProjectId: string
}

export function EventBudgetTab({ eventProjectId }: EventBudgetTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('expenses')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editItem, setEditItem] = useState<BudgetLineItemRow | null>(null)
  const [defaultCategoryId, setDefaultCategoryId] = useState<string | null>(null)

  const queryClient = useQueryClient()

  const budgetData = useBudgetData(eventProjectId)
  const revenueData = useBudgetRevenue(eventProjectId)
  const reportData = useBudgetReport(eventProjectId)
  const mutations = useBudgetMutations(eventProjectId)

  const categories = budgetData.data?.categories ?? []
  const lineItems = budgetData.data?.lineItems ?? []
  const revenue = revenueData.data?.revenue ?? []
  const syncedAt = revenueData.data?.syncedAt ?? null

  // ── Expense handlers ────────────────────────────────────────────────────────

  const handleAddExpense = useCallback((categoryId: string) => {
    setEditItem(null)
    setDefaultCategoryId(categoryId)
    setDrawerOpen(true)
  }, [])

  const handleEditExpense = useCallback((item: BudgetLineItemRow) => {
    setEditItem(item)
    setDefaultCategoryId(null)
    setDrawerOpen(true)
  }, [])

  const handleDeleteExpense = useCallback(
    (item: BudgetLineItemRow) => {
      mutations.deleteLineItem.mutate(item.id)
    },
    [mutations.deleteLineItem]
  )

  const handleSaveExpense = useCallback(
    async (data: BudgetLineItemInput & { receiptUrl?: string }) => {
      if (editItem) {
        await mutations.updateLineItem.mutateAsync({ lineId: editItem.id, data })
      } else {
        await mutations.addLineItem.mutateAsync(data)
      }
      setDrawerOpen(false)
      setEditItem(null)
    },
    [editItem, mutations.addLineItem, mutations.updateLineItem]
  )

  // ── Revenue handlers ────────────────────────────────────────────────────────

  const handleSync = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['budget-revenue', eventProjectId] })
    queryClient.invalidateQueries({ queryKey: ['budget-report', eventProjectId] })
  }, [queryClient, eventProjectId])

  const handleAddRevenue = useCallback(
    (data: BudgetRevenueInput) => {
      mutations.addRevenue.mutate(data)
    },
    [mutations.addRevenue]
  )

  const handleUpdateRevenue = useCallback(
    (revenueId: string, data: Partial<BudgetRevenueInput>) => {
      mutations.updateRevenue.mutate({ revenueId, data })
    },
    [mutations.updateRevenue]
  )

  const handleDeleteRevenue = useCallback(
    (revenueId: string) => {
      mutations.deleteRevenue.mutate(revenueId)
    },
    [mutations.deleteRevenue]
  )

  const isMutatingRevenue =
    mutations.addRevenue.isPending ||
    mutations.updateRevenue.isPending ||
    mutations.deleteRevenue.isPending

  const isSavingExpense =
    mutations.addLineItem.isPending || mutations.updateLineItem.isPending

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible">
      {/* Sub-tab pill toggle + Add Expense button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-full">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeSubTab === tab.id
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeSubTab === 'expenses' && (
          <button
            onClick={() => {
              setEditItem(null)
              setDefaultCategoryId(categories[0]?.id ?? null)
              setDrawerOpen(true)
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        )}
      </div>

      {/* Sub-tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          variants={tabContent}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {activeSubTab === 'expenses' && (
            <>
              {budgetData.isLoading ? (
                <ExpensesSkeleton />
              ) : budgetData.error ? (
                <div className="py-12 text-center text-sm text-red-500">
                  Failed to load budget data. Please try again.
                </div>
              ) : categories.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">
                  No budget categories yet. Categories will be created automatically when you add your first expense.
                </div>
              ) : (
                <BudgetLineItemTable
                  categories={categories}
                  lineItems={lineItems}
                  onAddExpense={handleAddExpense}
                  onEdit={handleEditExpense}
                  onDelete={handleDeleteExpense}
                />
              )}
            </>
          )}

          {activeSubTab === 'revenue' && (
            <>
              {revenueData.isLoading ? (
                <RevenueSkeleton />
              ) : revenueData.error ? (
                <div className="py-12 text-center text-sm text-red-500">
                  Failed to load revenue data. Please try again.
                </div>
              ) : (
                <BudgetRevenueSection
                  revenue={revenue}
                  syncedAt={syncedAt}
                  onSync={handleSync}
                  isSyncing={revenueData.isFetching}
                  onAdd={handleAddRevenue}
                  onUpdate={handleUpdateRevenue}
                  onDelete={handleDeleteRevenue}
                  isMutating={isMutatingRevenue}
                />
              )}
            </>
          )}

          {activeSubTab === 'report' && (
            <>
              {reportData.isLoading ? (
                <ReportSkeleton />
              ) : reportData.error ? (
                <div className="py-12 text-center text-sm text-red-500">
                  Failed to load budget report. Please try again.
                </div>
              ) : reportData.data ? (
                <BudgetReportView report={reportData.data} />
              ) : null}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Expense add/edit drawer */}
      <BudgetExpenseDrawer
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setEditItem(null)
        }}
        eventProjectId={eventProjectId}
        categories={categories}
        editItem={editItem}
        defaultCategoryId={defaultCategoryId}
        onSave={handleSaveExpense}
        isSaving={isSavingExpense}
      />
    </motion.div>
  )
}
