'use client'

import { useState, useMemo, useCallback, useEffect, useRef, type ComponentProps } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Package,
  Plus,
  Search,
  ChevronDown,
  AlertTriangle,
  Eye,
  Loader2,
  X,
  LayoutGrid,
  List,
  ImageIcon,
} from 'lucide-react'

import DetailDrawer from '@/components/DetailDrawer'
import ConfirmDialog from '@/components/ConfirmDialog'
import AnimatedCounter from '@/components/motion/AnimatedCounter'
import { Input } from '@/components/ui/Input'
import AVEquipmentWizard from '@/components/inventory/AVEquipmentWizard'
import { fetchApi } from '@/lib/api-client'
import { fadeInUp, staggerContainer, listItem, cardEntrance } from '@/lib/animations'
import { INVENTORY_DEPT_CATEGORIES, INVENTORY_DEPT_CONFIG, type InventoryDept } from '@/lib/constants/inventory'
import type { InventoryItem, StockFilter } from './inventory-types'
import { inventoryKeys, STOCK_FILTER_OPTIONS } from './inventory-types'
import { getStockStatus } from './inventory-utils'
import StockBadge from './StockBadge'
import TableSkeleton from './TableSkeleton'
import ItemDetailContent from './ItemDetailContent'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { usePageTitle } from '@/hooks/usePageTitle'
import PagePadding from '@/components/PagePadding'
import { OptimizedImage } from '@/components/ui/OptimizedImage'

// Types, constants, utils, and sub-components are imported from co-located files:
// - inventory-types.ts    (InventoryItem, StockFilter, inventoryKeys, STOCK_FILTER_OPTIONS)
// - inventory-utils.ts    (getStockStatus, formatActorName, formatDate)
// - StockBadge.tsx, TableSkeleton.tsx, ItemForm.tsx, CheckoutForm.tsx
// - TransactionTimeline.tsx, ItemDetailContent.tsx

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  usePageTitle('Inventory')
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  // ── Dept context — drives title, categories, and default API filter ──
  const rawDept = searchParams.get('dept')
  const dept: InventoryDept = (rawDept === 'maintenance' || rawDept === 'it') ? rawDept : 'av'
  const deptConfig = INVENTORY_DEPT_CONFIG[dept]
  const deptCategories = INVENTORY_DEPT_CATEGORIES[dept]

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

  // ── Pagination state ──
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  // ── Search / filter state ──
  const [rawSearch, setRawSearch] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [stockOpen, setStockOpen] = useState(false)
  const categoryRef = useRef<HTMLDivElement>(null)
  const stockRef = useRef<HTMLDivElement>(null)

  // Reset category filter and page when dept changes (so AV categories don't bleed into Maintenance)
  useEffect(() => {
    setCategory('')
    setPage(1)
  }, [dept])

  // Debounce search — also reset page
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(rawSearch)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [rawSearch])

  // Audit ref L2: surface the debounce window in the UI so the input doesn't
  // look "broken" while the user is mid-typing.
  const isSearchDebouncing = rawSearch !== search

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

  // Audit ref M2: Escape closes whichever dropdown is open. If both are open
  // (shouldn't happen since the outside-click handler enforces one-at-a-time,
  // but defensive) we close both.
  useEscapeKey(categoryOpen || stockOpen, () => {
    setCategoryOpen(false)
    setStockOpen(false)
  })

  // ── View mode ──
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // ── Drawer state ──
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [formDrawerOpen, setFormDrawerOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null)
  const [formPending, setFormPending] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // ── Data fetching (paginated) ──
  const { data: inventoryResponse, isLoading } = useQuery({
    queryKey: [...inventoryKeys.list(search, category), dept, page],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (category) {
        params.set('category', category)
      } else {
        params.set('categories', deptCategories.join(','))
      }
      params.set('page', String(page))
      params.set('limit', String(PAGE_SIZE))
      const qs = params.toString()
      const res = await fetch(`/api/inventory${qs ? `?${qs}` : ''}`, {
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('auth-token') : ''}`,
          'x-org-id': typeof window !== 'undefined' ? localStorage.getItem('org-id') || '' : '',
        },
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error?.message || 'Failed to load inventory')
      return { items: json.data as InventoryItem[], meta: json.meta as { total: number; page: number; limit: number; totalPages: number } | undefined }
    },
    staleTime: 30_000,
  })

  const items = useMemo(() => inventoryResponse?.items ?? [], [inventoryResponse?.items])
  const paginationMeta = inventoryResponse?.meta
  const totalPages = paginationMeta?.totalPages ?? 1
  const totalItems = paginationMeta?.total ?? items.length

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
    const displayTotal = totalItems
    const totalInStock = items.reduce((sum, i) => sum + i.quantityOnHand, 0)
    const lowStockCount = items.filter((i) => i.quantityOnHand > 0 && i.quantityOnHand <= i.reorderThreshold).length
    const outOfStockCount = items.filter((i) => i.quantityOnHand === 0).length
    return { totalItems: displayTotal, totalInStock, lowStockCount, outOfStockCount }
  }, [items, totalItems])

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    )
  }

  const selectedStockLabel = STOCK_FILTER_OPTIONS.find((o) => o.value === stockFilter)?.label ?? 'All Stock Levels'
  const selectedCategoryLabel = category || 'All Categories'

  return (
    <PagePadding>
    <MotionConfig reducedMotion="user">
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* ── Page header ── */}
        <motion.div
          className="flex items-start justify-between mb-6"
          initial="hidden"
          animate="visible"
          variants={staggerContainer(0.07, 0.05)}
        >
          <div>
            <motion.div variants={fadeInUp} className="flex items-center gap-2 mb-0.5">
              <Package className="w-5 h-5 text-slate-400" aria-hidden="true" />
              <h1 className="text-2xl font-semibold text-slate-900">{deptConfig.title}</h1>
            </motion.div>
            <motion.p variants={fadeInUp} className="text-sm text-slate-500">
              {deptConfig.subtitle}
            </motion.p>
          </div>
          <motion.div variants={fadeInUp}>
            <button
              onClick={() => {
                setEditingItem(null)
                setFormDrawerOpen(true)
              }}
              className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all duration-200 flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              {deptConfig.addLabel}
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
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Total Items</p>
            <p className="text-3xl font-bold text-slate-900">
              <AnimatedCounter value={stats.totalItems} />
            </p>
          </motion.div>

          {/* Total Units */}
          <motion.div variants={cardEntrance} className="ui-glass p-4 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">Total Units</p>
            <p className="text-3xl font-bold text-slate-900">
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
            <p className={`text-xs uppercase tracking-wide font-medium mb-1 ${stats.lowStockCount > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
              Low Stock
            </p>
            <p className={`text-3xl font-bold ${stats.lowStockCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
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
            <p className={`text-xs uppercase tracking-wide font-medium mb-1 ${stats.outOfStockCount > 0 ? 'text-red-700' : 'text-slate-500'}`}>
              Out of Stock
            </p>
            <p className={`text-3xl font-bold ${stats.outOfStockCount > 0 ? 'text-red-700' : 'text-slate-900'}`}>
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
          {/* Search — Audit ref L2: show a debounce spinner while the 300ms
              timer is in flight so users know the results will update; show a
              clear (X) button once the query has settled so they can reset
              without selecting-all + delete. */}
          <div className="flex-1 min-w-[180px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" aria-hidden="true" />
            <Input
              type="text"
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              placeholder="Search items…"
              aria-label="Search items"
              size="sm"
              className="w-full pl-9 pr-9 text-sm focus-visible:ring-slate-200 focus:border-slate-400"
            />
            {isSearchDebouncing ? (
              <span
                role="status"
                aria-live="polite"
                aria-label="Updating search results"
                className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center"
              >
                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" aria-hidden="true" />
              </span>
            ) : rawSearch ? (
              <button
                type="button"
                onClick={() => setRawSearch('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {/* Category filter */}
          <div ref={categoryRef} className="relative">
            <button
              onClick={() => setCategoryOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors cursor-pointer min-w-[160px] justify-between"
              aria-haspopup="listbox"
              aria-expanded={categoryOpen}
            >
              <span className={category ? 'text-slate-900' : 'text-slate-500'}>{selectedCategoryLabel}</span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${categoryOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
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
                  {['', ...deptCategories].map((cat) => (
                    <button
                      key={cat || '__all__'}
                      role="option"
                      aria-selected={category === cat}
                      onClick={() => {
                        setCategory(cat)
                        setCategoryOpen(false)
                        setPage(1)
                      }}
                      className={`block w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
                        category === cat ? 'bg-slate-100 text-slate-900 font-medium' : 'text-slate-700 hover:bg-slate-50'
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
              className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors cursor-pointer min-w-[160px] justify-between"
              aria-haspopup="listbox"
              aria-expanded={stockOpen}
            >
              <span className={stockFilter !== 'all' ? 'text-slate-900' : 'text-slate-500'}>{selectedStockLabel}</span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${stockOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
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
                        setPage(1)
                      }}
                      className={`block w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
                        stockFilter === opt.value ? 'bg-slate-100 text-slate-900 font-medium' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* View mode toggle */}
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden ml-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors duration-200 cursor-pointer ${viewMode === 'grid' ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
            >
              <LayoutGrid className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors duration-200 cursor-pointer ${viewMode === 'list' ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
            >
              <List className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </motion.div>

        {/* ── Items (grid or list) ── */}
        {isLoading ? (
          <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="ui-glass-table overflow-hidden">
            <TableSkeleton />
          </motion.div>
        ) : filteredItems.length === 0 ? (
          <motion.div initial="hidden" animate="visible" variants={fadeInUp} className="ui-glass-table overflow-hidden">
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
                <Package className="w-8 h-8 text-primary-400" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">
                {items.length === 0 ? 'No inventory items yet' : 'No items match your filters'}
              </h3>
              <p className="text-sm text-slate-500 mb-6 max-w-xs">
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
                  className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 active:scale-[0.97] transition-all duration-200 flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Add Item
                </button>
              )}
            </div>
          </motion.div>
        ) : viewMode === 'grid' ? (
          /* ── Grid view ── */
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer(0.05)}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {filteredItems.map((item) => {
              const totalQty = item.quantityOnHand
              return (
                <motion.div
                  key={item.id}
                  variants={cardEntrance}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer group flex flex-col"
                  onClick={() => handleOpenDetail(item)}
                >
                  {/* Image area */}
                  <div className="relative aspect-square bg-white overflow-hidden">
                    {item.imageUrl ? (
                      <OptimizedImage
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-16 h-16 text-slate-300" aria-hidden="true" />
                      </div>
                    )}
                    {/* Availability badge */}
                    <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      totalQty === 0
                        ? 'bg-red-100 text-red-700'
                        : totalQty <= item.reorderThreshold
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {totalQty} Available
                    </span>
                  </div>

                  {/* Card body */}
                  <div className="p-4 flex flex-col flex-1">
                    {item.manufacturer && (
                      <p className="text-xs text-blue-600 font-medium mb-0.5">{item.manufacturer}</p>
                    )}
                    <h3 className="text-sm font-bold text-slate-900 leading-snug mb-3 line-clamp-2">
                      {item.name}
                    </h3>
                    <div className="mt-auto">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenDetail(item)
                        }}
                        className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.97] transition-all duration-200 cursor-pointer"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        ) : (
          /* ── List view (table) ── */
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            className="ui-glass-table overflow-hidden"
          >
            <table className="w-full" role="table">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden lg:table-cell">SKU</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Qty</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide hidden sm:table-cell">Reorder At</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <motion.tbody initial="hidden" animate="visible" variants={staggerContainer(0.04)}>
                {filteredItems.map((item) => (
                  <motion.tr
                    key={item.id}
                    variants={listItem}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors duration-200 cursor-pointer"
                    onClick={() => handleOpenDetail(item)}
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                          {item.imageUrl ? (
                            <OptimizedImage src={item.imageUrl} alt="" className="w-full h-full object-contain p-1" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-slate-300" aria-hidden="true" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-slate-900">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-sm text-slate-500">{item.category || '—'}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className="text-xs text-slate-400 font-mono">{item.sku || '—'}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className={`text-sm font-semibold tabular-nums ${item.quantityOnHand === 0 ? 'text-red-600' : item.quantityOnHand <= item.reorderThreshold ? 'text-amber-600' : 'text-slate-900'}`}>
                        {item.quantityOnHand}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                      <span className="text-sm text-slate-400 tabular-nums">{item.reorderThreshold}</span>
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
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.97] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          Checkout
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenDetail(item)
                          }}
                          title="View details"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors duration-200 cursor-pointer"
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
          </motion.div>
        )}

        {/* ── Pagination Controls ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-2">
            <p className="text-xs text-slate-500">
              Page {page} of {totalPages} ({totalItems} items)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}

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

        {/* ── Add/Edit Equipment Drawer (2-Step Wizard) ── */}
        <DetailDrawer
          isOpen={formDrawerOpen}
          onClose={() => {
            setFormDrawerOpen(false)
            setEditingItem(null)
          }}
          title={editingItem ? 'Edit Equipment' : 'Add Equipment'}
          width="xl"
          noPadding
        >
          <AVEquipmentWizard
            item={editingItem as unknown as ComponentProps<typeof AVEquipmentWizard>['item']}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setFormDrawerOpen(false)
              setEditingItem(null)
            }}
            onPendingChange={setFormPending}
            defaultCategory={deptCategories[0]}
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
      </div>
    </MotionConfig>
    </PagePadding>
  )
}
