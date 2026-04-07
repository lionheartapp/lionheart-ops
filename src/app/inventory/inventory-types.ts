/**
 * Types and constants for the Inventory page.
 */

export interface InventoryItem {
  id: string
  name: string
  description: string | null
  category: string | null
  sku: string | null
  quantityOnHand: number
  reorderThreshold: number
  // AV Equipment fields
  ownerId: string | null
  manufacturer: string | null
  model: string | null
  serialNumbers: string[]
  tags: string[]
  allowCheckout: boolean
  imageUrl: string | null
  locations: Array<{ id: string; quantity: number; locationId: string | null; locationName: string; usage: string }> | null
  documentationLinks: Array<{ id: string; url: string; title: string; type: string }> | null
  createdAt: string
  updatedAt: string
}

export interface TransactionActor {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
}

export interface InventoryTransaction {
  id: string
  itemId: string
  type: 'CHECKOUT' | 'CHECKIN' | 'ADJUSTMENT'
  quantity: number
  checkedOutBy: TransactionActor | null
  checkedInBy: TransactionActor | null
  dueDate: string | null
  checkedOutAt: string | null
  checkedInAt: string | null
  notes: string | null
  createdAt: string
}

export type StockFilter = 'all' | 'in-stock' | 'low-stock' | 'out-of-stock'

export const inventoryKeys = {
  list: (search: string, category: string) => ['inventory', { search, category }] as const,
  detail: (id: string) => ['inventory', id] as const,
  transactions: (id: string) => ['inventory-transactions', id] as const,
}

export const STOCK_FILTER_OPTIONS: { value: StockFilter; label: string }[] = [
  { value: 'all', label: 'All Stock Levels' },
  { value: 'in-stock', label: 'In Stock' },
  { value: 'low-stock', label: 'Low Stock' },
  { value: 'out-of-stock', label: 'Out of Stock' },
]
