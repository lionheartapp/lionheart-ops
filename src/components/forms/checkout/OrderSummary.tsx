'use client'

import type { TicketTypePublic } from './TicketSelector'

interface OrderSummaryProps {
  ticketTypes: TicketTypePublic[]
  quantities: Record<string, number>
  discountLabel: string | null // e.g. "EARLYBIRD (-10%)"
  discountAmount: number // cents
}

export default function OrderSummary({ ticketTypes, quantities, discountLabel, discountAmount }: OrderSummaryProps) {
  const items = ticketTypes
    .filter((tt) => (quantities[tt.id] ?? 0) > 0)
    .map((tt) => ({
      name: tt.name,
      qty: quantities[tt.id],
      subtotal: tt.price * quantities[tt.id],
    }))

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
  const total = Math.max(0, subtotal - discountAmount)

  if (items.length === 0) return null

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Order Summary</h4>

      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.name} className="flex justify-between text-sm">
            <span className="text-slate-600">
              {item.qty}× {item.name}
            </span>
            <span className="text-slate-900 font-medium">
              ${(item.subtotal / 100).toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {discountAmount > 0 && discountLabel && (
        <div className="flex justify-between text-sm mt-2 pt-2 border-t border-slate-200">
          <span className="text-emerald-600">{discountLabel}</span>
          <span className="text-emerald-600 font-medium">-${(discountAmount / 100).toFixed(2)}</span>
        </div>
      )}

      <div className="flex justify-between text-sm font-semibold mt-3 pt-3 border-t border-slate-200">
        <span className="text-slate-900">Total</span>
        <span className="text-slate-900">${(total / 100).toFixed(2)}</span>
      </div>
    </div>
  )
}
