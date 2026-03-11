'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Package,
  Plus,
  Search,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  Pencil,
  Trash2,
  Eye,
  RotateCcw,
  ClipboardList,
} from 'lucide-react'
import DashboardLayout from '@/components/DashboardLayout'
import DetailDrawer from '@/components/DetailDrawer'
import ConfirmDialog from '@/components/ConfirmDialog'
import AnimatedCounter from '@/components/motion/AnimatedCounter'
import { fetchApi } from '@/lib/api-client'
import { fadeInUp, staggerContainer, listItem, cardEntrance } from '@/lib/animations'
import { INVENTORY_CATEGORIES } from '@/lib/constants/inventory'

// ─── Types ───────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: string
  name: string
  category: string | null
  sku: string | null
  quantityOnHand: number
  reorderThreshold: number
  createdAt: string
  updatedAt: string
}

interface TransactionActor {
  id: string
  firstName: string | null
  lastName: string | null
  email: string
}

interface InventoryTransaction {
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

type StockFilter = 'all' | 'in-stock' | 'low-stock' | 'out-of-stock'

// ─── Query Keys ──────────────────────────────────────────────────────────────

const inventoryKeys = {
  list: (search: string, category: string) => ['inventory', { search, category }] as const,
  detail: (id: string) => ['inventory', id] as const,
  transactions: (id: string) => ['inventory-transactions', id] as const,
}

// ─── Helper: stock status ─────────────────────────────────────────────────────

function getStockStatus(item: InventoryItem): 'in-stock' | 'low-stock' | 'out-of-stock' {
  if (item.quantityOnHand === 0) return 'out-of-stock'
  if (item.quantityOnHand <= item.reorderThreshold) return 'low-stock'
  return 'in-stock'
}

function StockBadge({ item }: { item: InventoryItem }) {
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

function formatActorName(actor: TransactionActor | null): string {
  if (!actor) return 'Unknown'
  const full = [actor.firstName, actor.lastName].filter(Boolean).join(' ')
  return full || actor.email
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-100">
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-4 bg-gray-200 rounded w-1/6" />
          <div className="h-4 bg-gray-200 rounded w-1/8" />
          <div className="h-4 bg-gray-200 rounded w-12" />
          <div className="h-4 bg-gray-200 rounded w-12" />
          <div className="h-6 bg-gray-200 rounded-full w-20" />
          <div className="h-8 bg-gray-200 rounded-lg w-20 ml-auto" />
        </div>
      ))}
    </div>
  )
}

// ─── Item Form (Add/Edit) ─────────────────────────────────────────────────────

interface ItemFormProps {
  item?: InventoryItem | null
  onSuccess: () => void
  onCancel: () => void
}

function ItemForm({ item, onSuccess, onCancel }: ItemFormProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(item?.name ?? '')
  const [category, setCategory] = useState(item?.category ?? '')
  const [sku, setSku] = useState(item?.sku ?? '')
  const [qty, setQty] = useState(String(item?.quantityOnHand ?? 0))
  const [threshold, setThreshold] = useState(String(item?.reorderThreshold ?? 0))
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const isEditing = Boolean(item)

  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        category: category || undefined,
        sku: sku || undefined,
        quantityOnHand: parseInt(qty, 10) || 0,
        reorderThreshold: parseInt(threshold, 10) || 0,
      }
      if (isEditing) {
        return fetchApi(`/api/inventory/${item!.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      }
      return fetchApi('/api/inventory', {
        method: 'POST',
        body: JSON.stringify(body),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      onSuccess()
    },
    onError: (err: Error) => {
      const msg = err.message || 'Something went wrong'
      if (msg.toLowerCase().includes('name')) {
        setFieldErrors({ name: msg })
      } else {
        setFieldErrors({ _form: msg })
      }
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    if (!name.trim()) {
      setFieldErrors({ name: 'Name is required' })
      return
    }
    mutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fieldErrors._form && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {fieldErrors._form}
        </div>
      )}

      <div>
        <label htmlFor="item-name" className="block text-sm font-medium text-gray-700 mb-1">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          id="item-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-200 focus:border-gray-400 transition-colors ${
            fieldErrors.name ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
          }`}
          placeholder="e.g. Whiteboard Markers"
          aria-describedby={fieldErrors.name ? 'name-error' : undefined}
        />
        {fieldErrors.name && (
          <p id="name-error" className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
        )}
      </div>

      <div>
        <label htmlFor="item-category" className="block text-sm font-medium text-gray-700 mb-1">
          Category
        </label>
        <select
          id="item-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-200 focus:border-gray-400 transition-colors cursor-pointer"
        >
          <option value="">— Select category —</option>
          {INVENTORY_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="item-sku" className="block text-sm font-medium text-gray-700 mb-1">
          SKU <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          id="item-sku"
          type="text"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-200 focus:border-gray-400 transition-colors"
          placeholder="e.g. WBM-100"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="item-qty" className="block text-sm font-medium text-gray-700 mb-1">
            Qty on Hand
          </label>
          <input
            id="item-qty"
            type="number"
            min={0}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-200 focus:border-gray-400 transition-colors"
          />
        </div>
        <div>
          <label htmlFor="item-threshold" className="block text-sm font-medium text-gray-700 mb-1">
            Reorder Point
          </label>
          <input
            id="item-threshold"
            type="number"
            min={0}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-200 focus:border-gray-400 transition-colors"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={mutation.isPending}
          className="flex-1 px-5 py-2.5 rounded-full bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all duration-200 disabled:opacity-50 cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex-1 px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all duration-200 disabled:opacity-50 cursor-pointer"
        >
          {mutation.isPending ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Item'}
        </button>
      </div>
    </form>
  )
}

// ─── Checkout Form ────────────────────────────────────────────────────────────

interface CheckoutFormProps {
  item: InventoryItem
  onSuccess: () => void
}

function CheckoutForm({ item, onSuccess }: CheckoutFormProps) {
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
        setError('Insufficient stock — not enough units available')
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
        <label htmlFor="checkout-qty" className="block text-sm font-medium text-gray-700 mb-1">
          Quantity <span className="text-gray-400 text-xs">(max {maxQty})</span>
        </label>
        <input
          id="checkout-qty"
          type="number"
          min={1}
          max={maxQty}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-200 focus:border-gray-400 transition-colors"
        />
      </div>

      <div>
        <label htmlFor="checkout-due" className="block text-sm font-medium text-gray-700 mb-1">
          Due Date <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          id="checkout-due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-200 focus:border-gray-400 transition-colors cursor-pointer"
        />
      </div>

      <div>
        <label htmlFor="checkout-notes" className="block text-sm font-medium text-gray-700 mb-1">
          Notes <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="checkout-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-200 focus:border-gray-400 transition-colors resize-none"
          placeholder="Who is checking out, reason, etc."
        />
      </div>

      <button
        type="submit"
        disabled={mutation.isPending || maxQty === 0}
        className="w-full px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all duration-200 disabled:opacity-50 cursor-pointer"
      >
        {mutation.isPending ? 'Checking Out…' : 'Confirm Checkout'}
      </button>
    </form>
  )
}

// ─── Transaction Timeline ─────────────────────────────────────────────────────

interface TransactionTimelineProps {
  itemId: string
  onCheckin: (transactionId: string) => void
  checkinPendingId: string | null
}

function TransactionTimeline({ itemId, onCheckin, checkinPendingId }: TransactionTimelineProps) {
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
            <div className="w-7 h-7 rounded-full bg-gray-200 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-gray-400">
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

        return (
          <div key={tx.id} className="flex gap-3">
            {/* Icon */}
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                isCheckout
                  ? isOpen
                    ? 'bg-red-100 text-red-600'
                    : 'bg-gray-100 text-gray-500'
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
                  <p className="text-sm text-gray-800">
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
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(tx.createdAt)}
                    {tx.dueDate && ` · Due ${formatDate(tx.dueDate)}`}
                    {tx.notes && ` · ${tx.notes}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isOpen && (
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
                      {checkinPendingId === tx.id ? 'Checking in…' : 'Check In'}
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

// ─── Item Detail Drawer Content ───────────────────────────────────────────────

interface ItemDetailContentProps {
  item: InventoryItem
  onEdit: () => void
  onDelete: () => void
  onCheckoutSuccess: () => void
}

function ItemDetailContent({ item, onEdit, onDelete, onCheckoutSuccess }: ItemDetailContentProps) {
  const queryClient = useQueryClient()
  const [showCheckoutForm, setShowCheckoutForm] = useState(false)
  const [checkinPendingId, setCheckinPendingId] = useState<string | null>(null)

  const checkinMutation = useMutation({
    mutationFn: (transactionId: string) =>
      fetchApi(`/api/inventory/${item.id}/checkin`, {
        method: 'POST',
        body: JSON.stringify({ transactionId }),
      }),
    onMutate: (transactionId) => {
      setCheckinPendingId(transactionId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions', item.id] })
      setCheckinPendingId(null)
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
            <h3 className="font-semibold text-gray-900 text-base">{item.name}</h3>
            {item.category && (
              <p className="text-sm text-gray-500 mt-0.5">{item.category}</p>
            )}
            {item.sku && (
              <p className="text-xs text-gray-400 mt-0.5 font-mono">SKU: {item.sku}</p>
            )}
          </div>
          <StockBadge item={item} />
        </div>

        <div className="mt-4 flex items-end gap-1">
          <span className="text-4xl font-bold text-gray-900">{item.quantityOnHand}</span>
          <span className="text-sm text-gray-500 mb-1.5">units</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">Reorder at {item.reorderThreshold}</p>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowCheckoutForm((v) => !v)}
          disabled={item.quantityOnHand === 0}
          className="flex-1 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
        >
          <ArrowDownCircle className="w-4 h-4" aria-hidden="true" />
          Checkout
        </button>
        <button
          onClick={onEdit}
          className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 active:scale-[0.97] transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5"
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
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Checkout Items</h4>
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
          <ClipboardList className="w-4 h-4 text-gray-400" aria-hidden="true" />
          <h4 className="text-sm font-semibold text-gray-700">Transaction History</h4>
        </div>
        <TransactionTimeline
          itemId={item.id}
          onCheckin={(txId) => checkinMutation.mutate(txId)}
          checkinPendingId={checkinPendingId}
        />
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  // ── Auth guard ──
  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth-token')
      const orgId = localStorage.getItem('org-id')
      if (!token || !orgId) router.push('/login')
    }
  }, [router])

  // ── Search / filter state ──
  const [rawSearch, setRawSearch] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [stockOpen, setStockOpen] = useState(false)
  const categoryRef = useRef<HTMLDivElement>(null)
  const stockRef = useRef<HTMLDivElement>(null)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(rawSearch), 300)
    return () => clearTimeout(t)
  }, [rawSearch])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setCategoryOpen(false)
      }
      if (stockRef.current && !stockRef.current.contains(e.target as Node)) {
        setStockOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Drawer state ──
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [formDrawerOpen, setFormDrawerOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // ── Data fetching ──
  const { data: items = [], isLoading } = useQuery({
    queryKey: inventoryKeys.list(search, category),
    queryFn: () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (category) params.set('category', category)
      const qs = params.toString()
      return fetchApi<InventoryItem[]>(`/api/inventory${qs ? `?${qs}` : ''}`)
    },
    staleTime: 30_000,
  })

  // ── Client-side stock filtering ──
  const filteredItems = useMemo(() => {
    if (stockFilter === 'all') return items
    if (stockFilter === 'low-stock') return items.filter((i) => i.quantityOnHand > 0 && i.quantityOnHand <= i.reorderThreshold)
    if (stockFilter === 'out-of-stock') return items.filter((i) => i.quantityOnHand === 0)
    if (stockFilter === 'in-stock') return items.filter((i) => i.quantityOnHand > i.reorderThreshold)
    return items
  }, [items, stockFilter])

  // ── Summary stats ──
  const stats = useMemo(() => {
    const totalItems = items.length
    const totalInStock = items.reduce((sum, i) => sum + i.quantityOnHand, 0)
    const lowStockCount = items.filter((i) => i.quantityOnHand > 0 && i.quantityOnHand <= i.reorderThreshold).length
    const outOfStockCount = items.filter((i) => i.quantityOnHand === 0).length
    return { totalItems, totalInStock, lowStockCount, outOfStockCount }
  }, [items])

  // ── Mutations ──
  const deleteMutation = useMutation({
    mutationFn: (itemId: string) =>
      fetchApi(`/api/inventory/${itemId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      setDeleteTarget(null)
      setDetailDrawerOpen(false)
      setSelectedItem(null)
    },
    onError: () => {
      setDeleteLoading(false)
    },
  })

  // ── Handlers ──
  const handleOpenDetail = useCallback((item: InventoryItem) => {
    setSelectedItem(item)
    setDetailDrawerOpen(true)
  }, [])

  const handleEdit = useCallback((item: InventoryItem) => {
    setEditingItem(item)
    setFormDrawerOpen(true)
  }, [])

  const handleDelete = useCallback((item: InventoryItem) => {
    setDeleteTarget(item)
  }, [])

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    deleteMutation.mutate(deleteTarget.id)
  }

  const handleFormSuccess = useCallback(() => {
    setFormDrawerOpen(false)
    setEditingItem(null)
  }, [])

  const handleCheckoutSuccess = useCallback(() => {
    // After checkout, refresh selected item detail
    if (selectedItem) {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.list('', '') })
    }
  }, [selectedItem, queryClient])

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    )
  }

  const STOCK_FILTER_OPTIONS: { value: StockFilter; label: string }[] = [
    { value: 'all', label: 'All Stock Levels' },
    { value: 'in-stock', label: 'In Stock' },
    { value: 'low-stock', label: 'Low Stock' },
    { value: 'out-of-stock', label: 'Out of Stock' },
  ]

  const selectedStockLabel = STOCK_FILTER_OPTIONS.find((o) => o.value === stockFilter)?.label ?? 'All Stock Levels'
  const selectedCategoryLabel = category || 'All Categories'

  return (
    <DashboardLayout>
      <MotionConfig reducedMotion="user">
        {/* ── Page header ── */}
        <motion.div
          className="flex items-start justify-between mb-6"
          initial="hidden"
          animate="visible"
          variants={staggerContainer(0.07, 0.05)}
        >
          <div>
            <motion.div variants={fadeInUp} className="flex items-center gap-2 mb-0.5">
              <Package className="w-5 h-5 text-gray-400" aria-hidden="true" />
              <h1 className="text-2xl font-semibold text-gray-900">AV Inventory</h1>
            </motion.div>
            <motion.p variants={fadeInUp} className="text-sm text-gray-500">
              Track and manage your A/V equipment and supplies
            </motion.p>
          </div>
          <motion.div variants={fadeInUp}>
            <button
              onClick={() => {
                setEditingItem(null)
                setFormDrawerOpen(true)
              }}
              className="px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all duration-200 flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Add Item
            </button>
          </motion.div>
        </motion.div>

        {/* ── Stat cards ── */}
        <motion.div
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
          initial="hidden"
          animate="visible"
          variants={staggerContainer(0.08, 0.1)}
        >
          {/* Total Items */}
          <motion.div variants={cardEntrance} className="ui-glass p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Total Items</p>
            <p className="text-3xl font-bold text-gray-900">
              <AnimatedCounter value={stats.totalItems} />
            </p>
          </motion.div>

          {/* Total Units */}
          <motion.div variants={cardEntrance} className="ui-glass p-4 text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Total Units</p>
            <p className="text-3xl font-bold text-gray-900">
              <AnimatedCounter value={stats.totalInStock} />
            </p>
          </motion.div>

          {/* Low Stock */}
          <motion.div
            variants={cardEntrance}
            className={`p-4 text-center rounded-xl border ${
              stats.lowStockCount > 0
                ? 'bg-amber-50 border-amber-200'
                : 'ui-glass'
            }`}
          >
            <p className={`text-xs uppercase tracking-wide font-medium mb-1 ${stats.lowStockCount > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
              Low Stock
            </p>
            <p className={`text-3xl font-bold ${stats.lowStockCount > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
              <AnimatedCounter value={stats.lowStockCount} />
            </p>
            {stats.lowStockCount > 0 && (
              <p className="text-xs text-amber-600 mt-1 flex items-center justify-center gap-1">
                <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                Needs reorder
              </p>
            )}
          </motion.div>

          {/* Out of Stock */}
          <motion.div
            variants={cardEntrance}
            className={`p-4 text-center rounded-xl border ${
              stats.outOfStockCount > 0
                ? 'bg-red-50 border-red-200'
                : 'ui-glass'
            }`}
          >
            <p className={`text-xs uppercase tracking-wide font-medium mb-1 ${stats.outOfStockCount > 0 ? 'text-red-700' : 'text-gray-500'}`}>
              Out of Stock
            </p>
            <p className={`text-3xl font-bold ${stats.outOfStockCount > 0 ? 'text-red-700' : 'text-gray-900'}`}>
              <AnimatedCounter value={stats.outOfStockCount} />
            </p>
          </motion.div>
        </motion.div>

        {/* ── Search & filters ── */}
        <motion.div
          className="ui-glass p-4 mb-4 flex flex-wrap gap-3 items-center"
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
        >
          {/* Search */}
          <div className="flex-1 min-w-[180px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              placeholder="Search items…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-200 focus:border-gray-400 transition-colors"
            />
          </div>

          {/* Category filter */}
          <div ref={categoryRef} className="relative">
            <button
              onClick={() => setCategoryOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors cursor-pointer min-w-[160px] justify-between"
              aria-haspopup="listbox"
              aria-expanded={categoryOpen}
            >
              <span className={category ? 'text-gray-900' : 'text-gray-500'}>{selectedCategoryLabel}</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${categoryOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            <AnimatePresence>
              {categoryOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute top-full mt-1 left-0 ui-glass-dropdown z-20 min-w-[180px]"
                  role="listbox"
                >
                  {['', ...INVENTORY_CATEGORIES].map((cat) => (
                    <button
                      key={cat || '__all__'}
                      role="option"
                      aria-selected={category === cat}
                      onClick={() => {
                        setCategory(cat)
                        setCategoryOpen(false)
                      }}
                      className={`block w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
                        category === cat ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {cat || 'All Categories'}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Stock level filter */}
          <div ref={stockRef} className="relative">
            <button
              onClick={() => setStockOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors cursor-pointer min-w-[160px] justify-between"
              aria-haspopup="listbox"
              aria-expanded={stockOpen}
            >
              <span className={stockFilter !== 'all' ? 'text-gray-900' : 'text-gray-500'}>{selectedStockLabel}</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${stockOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            <AnimatePresence>
              {stockOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute top-full mt-1 left-0 ui-glass-dropdown z-20 min-w-[180px]"
                  role="listbox"
                >
                  {STOCK_FILTER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      role="option"
                      aria-selected={stockFilter === opt.value}
                      onClick={() => {
                        setStockFilter(opt.value)
                        setStockOpen(false)
                      }}
                      className={`block w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
                        stockFilter === opt.value ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── Items table ── */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="ui-glass-table overflow-x-auto"
        >
          {isLoading ? (
            <TableSkeleton />
          ) : filteredItems.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
                <Package className="w-8 h-8 text-primary-400" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                {items.length === 0 ? 'No inventory items yet' : 'No items match your filters'}
              </h3>
              <p className="text-sm text-gray-500 mb-6 max-w-xs">
                {items.length === 0
                  ? 'Add your first item to start tracking stock levels and transactions.'
                  : 'Try adjusting your search or filter criteria.'}
              </p>
              {items.length === 0 && (
                <button
                  onClick={() => {
                    setEditingItem(null)
                    setFormDrawerOpen(true)
                  }}
                  className="px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 active:scale-[0.97] transition-all duration-200 flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Add Item
                </button>
              )}
            </div>
          ) : (
            <table className="w-full" role="table">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">SKU</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Qty</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Reorder At</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <motion.tbody initial="hidden" animate="visible" variants={staggerContainer(0.04)}>
                {filteredItems.map((item) => (
                  <motion.tr
                    key={item.id}
                    variants={listItem}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors duration-200 cursor-pointer"
                    onClick={() => handleOpenDetail(item)}
                  >
                    <td className="px-6 py-3.5">
                      <span className="text-sm font-medium text-gray-900">{item.name}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-sm text-gray-500">{item.category || '—'}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className="text-xs text-gray-400 font-mono">{item.sku || '—'}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`text-sm font-semibold tabular-nums ${item.quantityOnHand === 0 ? 'text-red-600' : item.quantityOnHand <= item.reorderThreshold ? 'text-amber-600' : 'text-gray-900'}`}>
                        {item.quantityOnHand}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                      <span className="text-sm text-gray-400 tabular-nums">{item.reorderThreshold}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <StockBadge item={item} />
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenDetail(item)
                          }}
                          disabled={item.quantityOnHand === 0}
                          title="Check out"
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.97] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Checkout
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenDetail(item)
                          }}
                          title="View details"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
                          aria-label={`View details for ${item.name}`}
                        >
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          )}
        </motion.div>

        {/* ── Item Detail Drawer ── */}
        <DetailDrawer
          isOpen={detailDrawerOpen}
          onClose={() => {
            setDetailDrawerOpen(false)
            setSelectedItem(null)
          }}
          title="Item Details"
          width="lg"
        >
          {selectedItem && (
            <ItemDetailContent
              item={selectedItem}
              onEdit={() => {
                setEditingItem(selectedItem)
                setDetailDrawerOpen(false)
                setFormDrawerOpen(true)
              }}
              onDelete={() => handleDelete(selectedItem)}
              onCheckoutSuccess={handleCheckoutSuccess}
            />
          )}
        </DetailDrawer>

        {/* ── Add/Edit Item Drawer ── */}
        <DetailDrawer
          isOpen={formDrawerOpen}
          onClose={() => {
            setFormDrawerOpen(false)
            setEditingItem(null)
          }}
          title={editingItem ? 'Edit Item' : 'Add Item'}
          width="md"
        >
          <ItemForm
            item={editingItem}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setFormDrawerOpen(false)
              setEditingItem(null)
            }}
          />
        </DetailDrawer>

        {/* ── Delete Confirmation ── */}
        <ConfirmDialog
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          title="Delete Item"
          message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
          confirmText="Delete"
          isLoading={deleteLoading}
          loadingText="Deleting…"
          variant="danger"
        />
      </MotionConfig>
    </DashboardLayout>
  )
}
