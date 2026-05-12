'use client'

import { useQuery } from '@tanstack/react-query'
import { ArrowUpCircle, ArrowDownCircle, RotateCcw } from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import type { InventoryTransaction } from './inventory-types'
import { inventoryKeys } from './inventory-types'
import { formatActorName, formatDate } from './inventory-utils'

interface TransactionTimelineProps {
  itemId: string
  onCheckin: (transactionId: string) => void
  checkinPendingId: string | null
}

export default function TransactionTimeline({ itemId, onCheckin, checkinPendingId }: TransactionTimelineProps) {
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: inventoryKeys.transactions(itemId),
    queryFn: () => fetchApi<InventoryTransaction[]>(`/api/inventory/${itemId}/transactions`),
    staleTime: 30_000,
    enabled: Boolean(itemId),
  })

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-slate-200 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-slate-200 rounded w-3/4" />
              <div className="h-3 bg-slate-200 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-slate-400">
        No transactions yet
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {transactions.map((tx) => {
        const isCheckout = tx.type === 'CHECKOUT'
        const isCheckin = tx.type === 'CHECKIN'
        const isOpen = isCheckout && tx.checkedInAt === null
        const absQty = Math.abs(tx.quantity)

        // Overdue detection
        const isOverdue = isOpen && tx.dueDate != null && new Date(tx.dueDate) < new Date()
        const daysOverdue = isOverdue && tx.dueDate
          ? Math.floor((new Date().getTime() - new Date(tx.dueDate).getTime()) / (1000 * 60 * 60 * 24))
          : 0

        return (
          <div key={tx.id} className="flex gap-3">
            {/* Icon */}
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                isCheckout
                  ? isOpen
                    ? 'bg-red-100 text-red-600'
                    : 'bg-slate-100 text-slate-500'
                  : isCheckin
                  ? 'bg-green-100 text-green-600'
                  : 'bg-blue-100 text-blue-600'
              }`}
            >
              {isCheckout ? (
                <ArrowDownCircle className="w-4 h-4" aria-hidden="true" />
              ) : isCheckin ? (
                <ArrowUpCircle className="w-4 h-4" aria-hidden="true" />
              ) : (
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-slate-800">
                    {isCheckout && (
                      <>
                        <span className="font-medium">{formatActorName(tx.checkedOutBy)}</span>
                        {' checked out '}<span className="font-medium">{absQty}</span>
                      </>
                    )}
                    {isCheckin && (
                      <>
                        <span className="font-medium">{formatActorName(tx.checkedInBy)}</span>
                        {' checked in '}<span className="font-medium">{absQty}</span>
                      </>
                    )}
                    {tx.type === 'ADJUSTMENT' && (
                      <>Adjustment: <span className="font-medium">{tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}</span></>
                    )}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDate(tx.createdAt)}
                    {tx.dueDate && ` \u00b7 Due ${formatDate(tx.dueDate)}`}
                    {tx.notes && ` \u00b7 ${tx.notes}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isOverdue && (
                    <span className="text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                      Overdue {daysOverdue > 0 ? `(${daysOverdue}d)` : ''}
                    </span>
                  )}
                  {isOpen && !isOverdue && (
                    <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      Outstanding
                    </span>
                  )}
                  {isOpen && (
                    <button
                      onClick={() => onCheckin(tx.id)}
                      disabled={checkinPendingId === tx.id}
                      className="text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-full transition-colors duration-200 disabled:opacity-50 cursor-pointer"
                    >
                      {checkinPendingId === tx.id ? 'Checking in\u2026' : 'Check In'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
