/**
 * Utility functions for the Inventory page.
 */

import type { InventoryItem, TransactionActor } from './inventory-types'

export function getStockStatus(item: InventoryItem): 'in-stock' | 'low-stock' | 'out-of-stock' {
  if (item.quantityOnHand === 0) return 'out-of-stock'
  if (item.quantityOnHand <= item.reorderThreshold) return 'low-stock'
  return 'in-stock'
}

export function formatActorName(actor: TransactionActor | null): string {
  if (!actor) return 'Unknown'
  const full = [actor.firstName, actor.lastName].filter(Boolean).join(' ')
  return full || actor.email
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
