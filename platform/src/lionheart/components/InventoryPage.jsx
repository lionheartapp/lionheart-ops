import { useState, useMemo, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Package, MapPin, Plus, Pencil, Trash2, Search, Grid3x3, List, MoreVertical, X } from 'lucide-react'
import { LOCATIONS, getTotalAvailable, getItemsByScope, getStockByScope } from '../data/inventoryData'
import { getAuthToken, platformFetch, platformPost } from '../services/platformApi'
import AddEquipmentDrawer from './AddEquipmentDrawer'

export default function InventoryPage({ items = [], setItems, stock = [], setStock, inventoryScope = 'facilities', users = [], currentUser }) {
  const itemList = useMemo(() => getItemsByScope(items ?? [], inventoryScope), [items, inventoryScope])
  const stockList = useMemo(() => getStockByScope(stock ?? [], items ?? [], inventoryScope), [stock, items, inventoryScope])
  const [editingStock, setEditingStock] = useState(null)
  const [newItemName, setNewItemName] = useState('')
  const [addingStock, setAddingStock] = useState(null)
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState('name-asc')
  const [viewMode, setViewMode] = useState('card')
  const [openMenuId, setOpenMenuId] = useState(null)
  const [detailItemId, setDetailItemId] = useState(null)
  const [addEquipmentOpen, setAddEquipmentOpen] = useState(false)
  const menuRef = useRef(null)

  const filteredAndSortedItems = useMemo(() => {
    let list = itemList.filter((i) => !search.trim() || i.name.toLowerCase().includes(search.trim().toLowerCase()))
    const byTotal = (a, b) => getTotalAvailable(stockList, b.id) - getTotalAvailable(stockList, a.id)
    if (sortOrder === 'name-asc') list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    else if (sortOrder === 'name-desc') list = [...list].sort((a, b) => b.name.localeCompare(a.name))
    else if (sortOrder === 'total-desc') list = [...list].sort(byTotal)
    else if (sortOrder === 'total-asc') list = [...list].sort((a, b) => -byTotal(a, b))
    return list
  }, [itemList, search, sortOrder, stockList])

  useEffect(() => {
    const onOutside = (e) => {
      if (openMenuId && menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [openMenuId])

  const addItem = async (e) => {
    e.preventDefault()
    const name = newItemName.trim()
    if (!name) return
    if (getAuthToken()) {
      try {
        const res = await platformPost('/api/inventory', { name, teamId: inventoryScope })
        if (res.ok) {
          const item = await res.json()
          setItems((prev) => [...(prev ?? []), item])
          setNewItemName('')
          return
        }
      } catch {
        /* fall through */
      }
    }
    const id = String(Date.now())
    setItems((prev) => [...(prev ?? []), { id, name, teamId: inventoryScope }])
    setNewItemName('')
  }

  const removeItem = async (itemId) => {
    if (typeof window !== 'undefined' && !window.confirm('Remove this item type? Stock entries will be removed too.')) return
    setOpenMenuId(null)
    setDetailItemId((cur) => (cur === itemId ? null : cur))
    if (getAuthToken() && typeof itemId === 'string' && itemId.length >= 10) {
      try {
        const res = await platformFetch(`/api/inventory/items/${itemId}`, { method: 'DELETE' })
        if (res.ok) {
          setItems((prev) => (prev || []).filter((i) => i.id !== itemId))
          setStock((prev) => (prev || []).filter((s) => s.itemId !== itemId))
          return
        }
      } catch {
        /* fall through */
      }
    }
    setItems((prev) => (prev || []).filter((i) => i.id !== itemId))
    setStock((prev) => (prev || []).filter((s) => s.itemId !== itemId))
  }

  const getStockByLocation = (itemId) => stockList.filter((s) => s.itemId === itemId)

  const saveStockEdit = async (entry) => {
    if (!entry.id) {
      if (getAuthToken()) {
        try {
          const res = await platformPost('/api/inventory', {
            itemId: entry.itemId,
            location: entry.location,
            quantity: entry.quantity || 0,
            usageNotes: entry.usageNotes?.trim() || undefined,
          })
          if (res.ok) {
            const created = await res.json()
            setStock((prev) => [...(prev || []), { ...created, usageNotes: created.usageNotes ?? entry.usageNotes }])
            setAddingStock(null)
            setEditingStock(null)
            return
          }
        } catch {
          /* fall through */
        }
      }
      setStock((prev) => [...(prev || []), { ...entry, id: 's' + Date.now() }])
      setAddingStock(null)
    } else {
      if (getAuthToken() && typeof entry.id === 'string') {
        try {
          const res = await platformFetch(`/api/inventory/stock/${entry.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: entry.location,
              quantity: entry.quantity ?? 0,
              usageNotes: entry.usageNotes !== undefined ? (entry.usageNotes?.trim() || null) : undefined,
            }),
          })
          if (res.ok) {
            const updated = await res.json().catch(() => ({}))
            setStock((prev) =>
              prev.map((s) => (s.id === entry.id ? { ...s, ...updated, usageNotes: updated.usageNotes ?? entry.usageNotes } : s))
            )
            setEditingStock(null)
            return
          }
        } catch {
          /* fall through */
        }
      }
      setStock((prev) =>
        prev.map((s) => (s.id === entry.id ? { ...s, location: entry.location, quantity: entry.quantity, usageNotes: entry.usageNotes } : s))
      )
    }
    setEditingStock(null)
  }

  const removeStockEntry = async (stockId) => {
    if (getAuthToken() && typeof stockId === 'string' && stockId.length >= 10) {
      try {
        const res = await platformFetch(`/api/inventory/stock/${stockId}`, { method: 'DELETE' })
        if (res.ok) {
          setStock((prev) => (prev || []).filter((s) => s.id !== stockId))
          setEditingStock(null)
          setAddingStock(null)
          return
        }
      } catch {
        /* fall through */
      }
    }
    setStock((prev) => (prev || []).filter((s) => s.id !== stockId))
    setEditingStock(null)
    setAddingStock(null)
  }

  const addStockRow = (itemId) => {
    setAddingStock(itemId)
    setEditingStock({ id: null, itemId, location: LOCATIONS[0], quantity: 0, usageNotes: '' })
  }

  const scopeLabel = inventoryScope === 'personal' ? 'Personal' : inventoryScope === 'av' ? 'A/V' : inventoryScope === 'it' ? 'IT' : 'Facilities'

  function StockRowBlock({ item }) {
    const byLocation = getStockByLocation(item.id)
    return (
      <div className="flex flex-wrap gap-2">
        {byLocation.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/80"
          >
            {editingStock?.id === s.id ? (
              <>
                <select
                  value={editingStock.location}
                  onChange={(e) => setEditingStock((p) => ({ ...p, location: e.target.value }))}
                  className="pl-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
                >
                  {LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  value={editingStock.quantity}
                  onChange={(e) => setEditingStock((p) => ({ ...p, quantity: parseInt(e.target.value, 10) || 0 }))}
                  className="w-16 px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
                />
                <input
                  type="text"
                  placeholder="Usage"
                  value={editingStock.usageNotes ?? ''}
                  onChange={(e) => setEditingStock((p) => ({ ...p, usageNotes: e.target.value }))}
                  className="min-w-[100px] px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
                />
                <button type="button" onClick={() => saveStockEdit(editingStock)} className="text-xs font-medium text-blue-500 hover:underline">Save</button>
                <button type="button" onClick={() => removeStockEntry(s.id)} className="text-xs font-medium text-red-500 hover:underline">Remove</button>
              </>
            ) : (
              <>
                <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  {s.location}: {s.quantity}
                  {s.usageNotes?.trim() ? ` — ${s.usageNotes.trim()}` : ''}
                </span>
                <button type="button" onClick={() => setEditingStock({ ...s })} className="p-0.5 rounded text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700" title="Edit">
                  <Pencil className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        ))}
        {addingStock === item.id && editingStock && !editingStock.id && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <select
              value={editingStock.location}
              onChange={(e) => setEditingStock((p) => ({ ...p, location: e.target.value }))}
              className="pl-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
            >
              {LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={editingStock.quantity}
              onChange={(e) => setEditingStock((p) => ({ ...p, quantity: parseInt(e.target.value, 10) || 0 }))}
              className="w-16 px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
            />
            <input
              type="text"
              placeholder="Usage"
              value={editingStock.usageNotes ?? ''}
              onChange={(e) => setEditingStock((p) => ({ ...p, usageNotes: e.target.value }))}
              className="min-w-[100px] px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
            />
            <button type="button" onClick={() => saveStockEdit({ ...editingStock, itemId: item.id })} className="text-xs font-medium text-blue-500 hover:underline">Add</button>
            <button type="button" onClick={() => { setAddingStock(null); setEditingStock(null) }} className="text-xs font-medium text-zinc-500 hover:underline">Cancel</button>
          </div>
        )}
      </div>
    )
  }

  const detailItem = detailItemId ? itemList.find((i) => i.id === detailItemId) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {scopeLabel} Inventory
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {inventoryScope === 'personal'
              ? 'Your personal inventory. Track items and stock by location.'
              : `Manage and track ${scopeLabel.toLowerCase()} equipment.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setAddEquipmentOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600"
          >
            <Plus className="w-4 h-4" />
            Add equipment
          </button>
          <form onSubmit={addItem} className="flex gap-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="e.g. 8' table"
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-700"
            >
              <Plus className="w-4 h-4" /> Add item
            </button>
          </form>
        </div>
      </div>

      <AddEquipmentDrawer
        isOpen={addEquipmentOpen}
        onClose={() => setAddEquipmentOpen(false)}
        inventoryScope={inventoryScope}
        users={users}
        currentUser={currentUser}
        onSaved={({ item, stockEntries = [] }) => {
          setItems((prev) => [...(prev ?? []), item])
          setStock((prev) => [...(prev ?? []), ...stockEntries])
        }}
      />

      {itemList.length > 0 && (
        <div className="glass-card overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search item types..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="inv-sort" className="text-sm text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Sort:</label>
              <select
                id="inv-sort"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="name-asc">Name (A–Z)</option>
                <option value="name-desc">Name (Z–A)</option>
                <option value="total-desc">Total (high)</option>
                <option value="total-asc">Total (low)</option>
              </select>
            </div>
            <div className="flex rounded-lg bg-zinc-100 dark:bg-zinc-800/80 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'card' ? 'bg-white dark:bg-zinc-700 text-blue-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                title="Card view"
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-zinc-700 text-blue-500 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {filteredAndSortedItems.length === 0 ? (
        <div className="glass-card rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
          <Package className="w-12 h-12 text-zinc-400 dark:text-zinc-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
            {itemList.length === 0 ? 'No item types yet' : 'No matching items'}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            {search.trim() ? 'Try adjusting your search.' : 'Get started by adding your first item type.'}
          </p>
          {!search.trim() && (
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => setAddEquipmentOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600"
              >
                <Plus className="w-4 h-4" /> Add equipment
              </button>
            </div>
          )}
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedItems.map((item) => {
            const total = getTotalAvailable(stockList, item.id)
            const locationCount = getStockByLocation(item.id).length
            return (
              <div
                key={item.id}
                className="glass-card rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col"
              >
                <div className="p-4 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2">{item.name}</h3>
                    <span className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-medium ${total === 0 ? 'bg-red-500/15 text-red-600 dark:text-red-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}>
                      {total} total
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                    {locationCount} location{locationCount !== 1 ? 's' : ''}
                  </p>
                  <button
                    type="button"
                    onClick={() => setDetailItemId(item.id)}
                    className="w-full py-2.5 px-3 rounded-lg bg-zinc-800 dark:bg-zinc-700 text-white text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-600"
                  >
                    View details
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <section className="glass-card overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div className="divide-y divide-zinc-200 dark:divide-zinc-700 dark:divide-blue-950/30">
            {filteredAndSortedItems.map((item) => (
              <div key={item.id} className="p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{item.name}</h3>
                  <div className="flex items-center gap-2" ref={openMenuId === item.id ? menuRef : null}>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      Total: {getTotalAvailable(stockList, item.id)}
                    </span>
                    <button
                      type="button"
                      onClick={() => addStockRow(item.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-blue-500"
                      title="Add stock at a location"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        aria-label="More options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {openMenuId === item.id && (
                        <div className="absolute right-0 top-full mt-1 w-40 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg z-10">
                          <button
                            type="button"
                            onClick={() => { addStockRow(item.id); setOpenMenuId(null) }}
                            className="w-full px-4 py-2 text-left text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4" /> Add stock
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" /> Remove item
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <StockRowBlock item={item} />
              </div>
            ))}
          </div>
        </section>
      )}

      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setDetailItemId(null)}>
          <div
            className="glass-card rounded-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{detailItem.name}</h2>
              <button type="button" onClick={() => setDetailItemId(null)} className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto">
              {(detailItem.description || detailItem.owner || detailItem.manufacturer || detailItem.model) && (
                <div className="mb-4 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 space-y-1 text-sm">
                  {detailItem.description && <p className="text-zinc-700 dark:text-zinc-300">{detailItem.description}</p>}
                  {detailItem.owner && <p className="text-zinc-500 dark:text-zinc-400">Owner: {detailItem.owner.name || detailItem.owner.email}</p>}
                  {(detailItem.manufacturer || detailItem.model) && (
                    <p className="text-zinc-500 dark:text-zinc-400">{[detailItem.manufacturer, detailItem.model].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
              )}
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">
                Total: {getTotalAvailable(stockList, detailItem.id)} · {getStockByLocation(detailItem.id).length} location{getStockByLocation(detailItem.id).length !== 1 ? 's' : ''}
              </p>
              <StockRowBlock item={detailItem} />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => addStockRow(detailItem.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600"
                >
                  <Plus className="w-4 h-4" /> Add stock at location
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(detailItem.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-red-600 dark:text-red-400 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4" /> Remove item type
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
