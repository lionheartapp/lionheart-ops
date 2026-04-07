'use client'

import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import type { InventoryItem } from './inventory-types'
import { getStockStatus } from './inventory-utils'

export default function StockBadge({ item }: { item: InventoryItem }) {
  const status = getStockStatus(item)
  if (status === 'out-of-stock') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <XCircle className="w-3 h-3" aria-hidden="true" />
        Out of Stock
      </span>
    )
  }
  if (status === 'low-stock') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        <AlertTriangle className="w-3 h-3" aria-hidden="true" />
        Low Stock
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
      <CheckCircle className="w-3 h-3" aria-hidden="true" />
      In Stock
    </span>
  )
}
