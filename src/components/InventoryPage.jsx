import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Package, MapPin, Plus, Pencil, Trash2 } from 'lucide-react'
import { LOCATIONS, getTotalAvailable, getItemsByScope, getStockByScope } from '../data/inventoryData'

export default function InventoryPage({ items = [], setItems, stock = [], setStock, inventoryScope = 'facilities' }) {
  const itemList = useMemo(() => getItemsByScope(items ?? [], inventoryScope), [items, inventoryScope])
  const stockList = useMemo(() => getStockByScope(stock ?? [], items ?? [], inventoryScope), [stock, items, inventoryScope])
  const [editingStock, setEditingStock] = useState(null)
  const [newItemName, setNewItemName] = useState('')
  const [addingStock, setAddingStock] = useState(null) // itemId when adding stock for that item

  const addItem = (e) => {
    e.preventDefault()
    const name = newItemName.trim()
    if (!name) return
    const id = String(Date.now())
    setItems((prev) => [...(prev ?? []), { id, name, teamId: inventoryScope }])
    setNewItemName('')
  }

  const removeItem = (itemId) => {
    if (typeof window !== 'undefined' && !window.confirm('Remove this item type? Stock entries will be removed too.')) return
    setItems((prev) => (prev || []).filter((i) => i.id !== itemId))
    setStock((prev) => (prev || []).filter((s) => s.itemId !== itemId))
  }

  const getStockByLocation = (itemId) => {
    return stockList.filter((s) => s.itemId === itemId)
  }

  const saveStockEdit = (entry) => {
    if (!entry.id) {
      const newId = 's' + Date.now()
      setStock((prev) => [...(prev || []), { ...entry, id: newId }])
      setAddingStock(null)
    } else {
      setStock((prev) =>
        prev.map((s) => (s.id === entry.id ? { ...s, location: entry.location, quantity: entry.quantity } : s))
      )
    }
    setEditingStock(null)
  }

  const removeStockEntry = (stockId) => {
    setStock((prev) => (prev || []).filter((s) => s.id !== stockId))
    setEditingStock(null)
    setAddingStock(null)
  }

  const addStockRow = (itemId) => {
    setAddingStock(itemId)
    setEditingStock({ id: null, itemId, location: LOCATIONS[0], quantity: 0 })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {inventoryScope === 'personal'
          ? 'Your personal inventory. Track items and stock by location.'
          : `${inventoryScope === 'av' ? 'A/V' : inventoryScope === 'it' ? 'IT' : 'Facilities'} team inventory. Track items and stock by location.`}
      </p>

      <section className="glass-card overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 dark:border-blue-950/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Item types
            </h2>
          </div>
          <form onSubmit={addItem} className="flex gap-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="e.g. 8' table"
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600"
            >
              <Plus className="w-4 h-4" />
              Add item
            </button>
          </form>
        </div>
        <div className="divide-y divide-zinc-200 dark:divide-zinc-700 dark:divide-blue-950/30">
          {itemList.map((item) => (
            <div key={item.id} className="p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{item.name}</h3>
                <div className="flex items-center gap-2">
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
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-red-500"
                    title="Remove item type"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {getStockByLocation(item.id).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/80"
                  >
                    {editingStock?.id === s.id ? (
                      <>
                        <select
                          value={editingStock.location}
                          onChange={(e) => setEditingStock((prev) => ({ ...prev, location: e.target.value }))}
                          className="select-arrow-padded pl-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
                        >
                          {LOCATIONS.map((loc) => (
                            <option key={loc} value={loc}>{loc}</option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={0}
                          value={editingStock.quantity}
                          onChange={(e) =>
                            setEditingStock((prev) => ({ ...prev, quantity: parseInt(e.target.value, 10) || 0 }))
                          }
                          className="w-16 px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => saveStockEdit(editingStock)}
                          className="text-xs font-medium text-blue-500 hover:underline"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStockEntry(s.id)}
                          className="text-xs font-medium text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <>
                        <MapPin className="w-3.5 h-3.5 text-zinc-500" />
                        <span className="text-sm text-zinc-700 dark:text-zinc-300">
                          {s.location}: {s.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingStock({ ...s })}
                          className="p-0.5 rounded text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                          title="Edit"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
                {addingStock === item.id && editingStock && !editingStock.id && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <select
                      value={editingStock.location}
                      onChange={(e) => setEditingStock((prev) => ({ ...prev, location: e.target.value }))}
                      className="select-arrow-padded pl-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
                    >
                      {LOCATIONS.map((loc) => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={editingStock.quantity}
                      onChange={(e) =>
                        setEditingStock((prev) => ({ ...prev, quantity: parseInt(e.target.value, 10) || 0 }))
                      }
                      className="w-16 px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => saveStockEdit({ ...editingStock, itemId: item.id })}
                      className="text-xs font-medium text-blue-500 hover:underline"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAddingStock(null); setEditingStock(null) }}
                      className="text-xs font-medium text-zinc-500 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        {itemList.length === 0 && (
          <div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No item types yet. Add one above.
          </div>
        )}
      </section>
    </motion.div>
  )
}
