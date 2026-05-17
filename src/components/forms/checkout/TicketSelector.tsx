'use client'

import { Minus, Plus } from 'lucide-react'

export interface TicketTypePublic {
  id: string
  name: string
  description: string | null
  price: number // cents
  maxPerOrder: number | null
  totalInventory: number | null
  available: number | null // computed: totalInventory - soldCount (null = unlimited)
}

interface TicketSelectorProps {
  ticketTypes: TicketTypePublic[]
  quantities: Record<string, number> // ticketTypeId → quantity
  onChange: (ticketTypeId: string, quantity: number) => void
}

export default function TicketSelector({ ticketTypes, quantities, onChange }: TicketSelectorProps) {
  return (
    <div className="space-y-2">
      {ticketTypes.map((tt) => {
        const qty = quantities[tt.id] ?? 0
        const maxQty = Math.min(
          tt.maxPerOrder ?? 10,
          tt.available ?? 999
        )
        const soldOut = tt.available !== null && tt.available <= 0
        const lowStock = tt.available !== null && tt.available > 0 && tt.available <= Math.ceil((tt.totalInventory ?? 0) * 0.15)

        return (
          <div
            key={tt.id}
            className={`border rounded-xl p-4 transition-colors ${
              soldOut ? 'border-slate-100 bg-slate-50 opacity-60' : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{tt.name}</span>
                  {lowStock && !soldOut && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium text-amber-700 bg-amber-50 rounded-full">
                      Only {tt.available} left
                    </span>
                  )}
                  {soldOut && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium text-red-700 bg-red-50 rounded-full">
                      Sold out
                    </span>
                  )}
                </div>
                {tt.description && (
                  <p className="text-xs text-slate-500 mt-0.5">{tt.description}</p>
                )}
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-sm font-semibold text-slate-900">
                  {tt.price === 0 ? 'Free' : `$${(tt.price / 100).toFixed(2)}`}
                </span>

                {!soldOut && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onChange(tt.id, Math.max(0, qty - 1))}
                      disabled={qty <= 0}
                      className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-medium text-slate-900">{qty}</span>
                    <button
                      type="button"
                      onClick={() => onChange(tt.id, Math.min(maxQty, qty + 1))}
                      disabled={qty >= maxQty}
                      className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
