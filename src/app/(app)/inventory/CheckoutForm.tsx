'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchApi } from '@/lib/api-client'
import type { InventoryItem } from './inventory-types'

interface CheckoutFormProps {
  item: InventoryItem
  onSuccess: () => void
}

export default function CheckoutForm({ item, onSuccess }: CheckoutFormProps) {
  const queryClient = useQueryClient()
  const [qty, setQty] = useState('1')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      return fetchApi(`/api/inventory/${item.id}/checkout`, {
        method: 'POST',
        body: JSON.stringify({
          quantity: parseInt(qty, 10),
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          notes: notes || undefined,
        }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions', item.id] })
      setQty('1')
      setDueDate('')
      setNotes('')
      setError(null)
      onSuccess()
    },
    onError: (err: Error) => {
      const msg = err.message || 'Something went wrong'
      if (msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('stock')) {
        setError('Insufficient stock \u2014 not enough units available')
      } else {
        setError(msg)
      }
    },
  })

  const maxQty = item.quantityOnHand
  const numQty = parseInt(qty, 10) || 0
  const isInvalid = numQty < 1 || numQty > maxQty

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (isInvalid) {
      setError(`Quantity must be between 1 and ${maxQty}`)
      return
    }
    mutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="checkout-qty" className="block text-sm font-medium text-slate-700 mb-1">
          Quantity <span className="text-slate-400 text-xs">(max {maxQty})</span>
        </label>
        <input
          id="checkout-qty"
          type="number"
          min={1}
          max={maxQty}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 focus:border-slate-400 transition-colors"
        />
      </div>

      <div>
        <label htmlFor="checkout-due" className="block text-sm font-medium text-slate-700 mb-1">
          Due Date <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          id="checkout-due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 focus:border-slate-400 transition-colors cursor-pointer"
        />
      </div>

      <div>
        <label htmlFor="checkout-notes" className="block text-sm font-medium text-slate-700 mb-1">
          Notes <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="checkout-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 focus:border-slate-400 transition-colors resize-none"
          placeholder="Who is checking out, reason, etc."
        />
      </div>

      <button
        type="submit"
        disabled={mutation.isPending || maxQty === 0}
        className="w-full px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all duration-200 disabled:opacity-50 cursor-pointer"
      >
        {mutation.isPending ? 'Checking Out\u2026' : 'Confirm Checkout'}
      </button>
    </form>
  )
}
