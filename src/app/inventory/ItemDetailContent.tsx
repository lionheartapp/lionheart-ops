'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowDownCircle, Pencil, Trash2, ClipboardList } from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import type { InventoryItem } from './inventory-types'
import { getStockStatus } from './inventory-utils'
import StockBadge from './StockBadge'
import CheckoutForm from './CheckoutForm'
import TransactionTimeline from './TransactionTimeline'

interface ItemDetailContentProps {
  item: InventoryItem
  onEdit: () => void
  onDelete: () => void
  onCheckoutSuccess: () => void
}

export default function ItemDetailContent({ item, onEdit, onDelete, onCheckoutSuccess }: ItemDetailContentProps) {
  const queryClient = useQueryClient()
  const [showCheckoutForm, setShowCheckoutForm] = useState(false)
  const [checkinPendingId, setCheckinPendingId] = useState<string | null>(null)
  const [checkinConfirmId, setCheckinConfirmId] = useState<string | null>(null)
  const [checkinNotes, setCheckinNotes] = useState('')

  const checkinMutation = useMutation({
    mutationFn: ({ transactionId, notes }: { transactionId: string; notes?: string }) =>
      fetchApi(`/api/inventory/${item.id}/checkin`, {
        method: 'POST',
        body: JSON.stringify({ transactionId, ...(notes ? { notes } : {}) }),
      }),
    onMutate: ({ transactionId }) => {
      setCheckinPendingId(transactionId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions', item.id] })
      setCheckinPendingId(null)
      setCheckinConfirmId(null)
      setCheckinNotes('')
    },
    onError: () => {
      setCheckinPendingId(null)
    },
  })

  const status = getStockStatus(item)

  return (
    <div className="space-y-6">
      {/* Item summary card */}
      <div
        className={`rounded-xl p-4 border ${
          status === 'low-stock'
            ? 'bg-amber-50 border-amber-200'
            : status === 'out-of-stock'
            ? 'bg-red-50 border-red-200'
            : 'bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900 text-base">{item.name}</h3>
            {item.category && (
              <p className="text-sm text-slate-500 mt-0.5">{item.category}</p>
            )}
            {item.sku && (
              <p className="text-xs text-slate-400 mt-0.5 font-mono">SKU: {item.sku}</p>
            )}
          </div>
          <StockBadge item={item} />
        </div>

        <div className="mt-4 flex items-end gap-1">
          <span className="text-4xl font-bold text-slate-900">{item.quantityOnHand}</span>
          <span className="text-sm text-slate-500 mb-1.5">units</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">Reorder at {item.reorderThreshold}</p>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowCheckoutForm((v) => !v)}
          disabled={item.quantityOnHand === 0}
          className="flex-1 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
        >
          <ArrowDownCircle className="w-4 h-4" aria-hidden="true" />
          Checkout
        </button>
        <button
          onClick={onEdit}
          className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 active:scale-[0.97] transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Pencil className="w-4 h-4" aria-hidden="true" />
          Edit
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-2 rounded-lg bg-white border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 active:scale-[0.97] transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Checkout form */}
      <AnimatePresence>
        {showCheckoutForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="ui-glass p-4 rounded-xl">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Checkout Items</h4>
              <CheckoutForm
                item={item}
                onSuccess={() => {
                  setShowCheckoutForm(false)
                  onCheckoutSuccess()
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction history */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="w-4 h-4 text-slate-400" aria-hidden="true" />
          <h4 className="text-sm font-semibold text-slate-700">Transaction History</h4>
        </div>
        <TransactionTimeline
          itemId={item.id}
          onCheckin={(txId) => {
            setCheckinConfirmId(txId)
            setCheckinNotes('')
          }}
          checkinPendingId={checkinPendingId}
        />

        {/* Checkin confirmation with notes */}
        <AnimatePresence>
          {checkinConfirmId && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden mt-3"
            >
              <div className="ui-glass p-4 rounded-xl space-y-3">
                <h4 className="text-sm font-semibold text-slate-700">Confirm Check In</h4>
                <textarea
                  value={checkinNotes}
                  onChange={(e) => setCheckinNotes(e.target.value)}
                  placeholder="Return notes (optional) — e.g. condition, damage, missing parts"
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-all resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      checkinMutation.mutate({
                        transactionId: checkinConfirmId,
                        notes: checkinNotes.trim() || undefined,
                      })
                    }
                    disabled={checkinPendingId === checkinConfirmId}
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all duration-200 disabled:opacity-50 cursor-pointer"
                  >
                    {checkinPendingId === checkinConfirmId ? 'Checking in\u2026' : 'Confirm Check In'}
                  </button>
                  <button
                    onClick={() => {
                      setCheckinConfirmId(null)
                      setCheckinNotes('')
                    }}
                    className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-all duration-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
