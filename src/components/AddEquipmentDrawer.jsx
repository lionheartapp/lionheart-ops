import { useState } from 'react'
import { Plus, Save, X, Upload, Image as ImageIcon, FileText } from 'lucide-react'
import DrawerModal from './DrawerModal'
import { LOCATIONS } from '../data/inventoryData'
import { getAuthToken, platformPost } from '../services/platformApi'

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500'
const labelClass = 'block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1'
const sectionTitleClass = 'text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-3'

export default function AddEquipmentDrawer({
  isOpen,
  onClose,
  inventoryScope = 'facilities',
  users = [],
  currentUser,
  onSaved,
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [locationRows, setLocationRows] = useState([{ quantity: 1, location: LOCATIONS[0], usage: '' }])
  const [allowCheckout, setAllowCheckout] = useState(false)
  const [category, setCategory] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const totalQuantity = locationRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)

  const addLocationRow = () => {
    setLocationRows((prev) => [...prev, { quantity: 1, location: LOCATIONS[0], usage: '' }])
  }

  const updateRow = (index, field, value) => {
    setLocationRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    )
  }

  const removeRow = (index) => {
    if (locationRows.length <= 1) return
    setLocationRows((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    try {
      if (getAuthToken()) {
        const itemRes = await platformPost('/api/inventory', {
          name: trimmedName,
          teamId: inventoryScope,
        })
        if (!itemRes.ok) {
          const err = await itemRes.json().catch(() => ({}))
          throw new Error(err.error || 'Failed to create item')
        }
        const item = await itemRes.json()
        const createdStock = []
        for (const row of locationRows) {
          const qty = Math.max(0, Math.floor(Number(row.quantity) || 0))
          if (qty > 0 && row.location?.trim()) {
            const stockRes = await platformPost('/api/inventory', {
              itemId: item.id,
              location: row.location.trim(),
              quantity: qty,
            })
            if (stockRes.ok) {
              const stockEntry = await stockRes.json()
              createdStock.push(stockEntry)
            }
          }
        }
        onSaved?.({ item, stockEntries: createdStock })
      } else {
        const id = 'i' + Date.now()
        const newItem = { id, name: trimmedName, teamId: inventoryScope }
        const mockStock = locationRows
          .filter((r) => (Number(r.quantity) || 0) > 0 && r.location?.trim())
          .map((r, i) => ({
            id: 's' + Date.now() + i,
            itemId: id,
            location: r.location.trim(),
            quantity: Math.max(0, Math.floor(Number(r.quantity) || 0)),
          }))
        onSaved?.({ item: newItem, stockEntries: mockStock })
      }
      onClose()
      setName('')
      setDescription('')
      setLocationRows([{ quantity: 1, location: LOCATIONS[0], usage: '' }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (!saving) {
      setName('')
      setDescription('')
      setLocationRows([{ quantity: 1, location: LOCATIONS[0], usage: '' }])
      setError('')
      onClose()
    }
  }

  return (
    <DrawerModal isOpen={isOpen} onClose={handleClose} title="Add New Equipment">
      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Basic information */}
        <section className="space-y-4">
          <h3 className={sectionTitleClass}>Basic information</h3>
          <div className="glass-card rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
            <div>
              <label htmlFor="eq-name" className={labelClass}>Name *</label>
              <input
                id="eq-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., LED Par Light"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="eq-desc" className={labelClass}>Description</label>
              <textarea
                id="eq-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the equipment..."
                rows={3}
                className={inputClass}
              />
            </div>
            {users?.length > 0 && (
              <div>
                <label htmlFor="eq-owner" className={labelClass}>Owner</label>
                <select id="eq-owner" className={inputClass}>
                  <option value="">None</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email || ''})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Receives an email when someone requests to check out this equipment.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Inventory & locations */}
        <section className="space-y-4">
          <h3 className={sectionTitleClass}>Inventory & locations</h3>
          <div className="glass-card rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Add items by quantity, location, and usage. Total quantity is calculated automatically.
            </p>
            {locationRows.map((row, index) => (
              <div key={index} className="flex flex-wrap items-center gap-3">
                <div className="w-20">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">Quantity</label>
                  <input
                    type="number"
                    min={0}
                    value={row.quantity}
                    onChange={(e) => updateRow(index, 'quantity', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">Location</label>
                  <select
                    value={row.location}
                    onChange={(e) => updateRow(index, 'location', e.target.value)}
                    className={inputClass}
                  >
                    {LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">Usage</label>
                  <input
                    type="text"
                    value={row.usage}
                    onChange={(e) => updateRow(index, 'usage', e.target.value)}
                    placeholder="e.g., For basketball games"
                    className={inputClass}
                  />
                </div>
                <div className="flex items-end gap-1">
                  <button
                    type="button"
                    onClick={addLocationRow}
                    className="p-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600"
                    title="Add row"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  {locationRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="p-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      title="Remove row"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Total quantity: {totalQuantity}
            </p>
          </div>
        </section>

        {/* Checkout */}
        <section className="space-y-4">
          <h3 className={sectionTitleClass}>Checkout</h3>
          <div className="glass-card rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allowCheckout}
                onChange={(e) => setAllowCheckout(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 text-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Allow staff to checkout</span>
            </label>
            <div>
              <label className={labelClass}>Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={inputClass}
              >
                <option value="">None</option>
                <option value="audio">Audio</option>
                <option value="lighting">Lighting</option>
                <option value="video">Video</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        </section>

        {/* Product details */}
        <section className="space-y-4">
          <h3 className={sectionTitleClass}>Product details</h3>
          <div className="glass-card rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
            <div>
              <label className={labelClass}>Manufacturer</label>
              <input
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="e.g., Chauvet, Shure"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g., COLORado 1-Quad"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Serial numbers</label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                Add one serial number per item (e.g., 6 speakers = 6 serial numbers).
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter serial number and press Enter"
                  className={inputClass}
                  readOnly
                  disabled
                />
                <button
                  type="button"
                  disabled
                  className="shrink-0 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-sm"
                >
                  <Plus className="w-4 h-4 inline mr-1" /> Add
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Media & documents */}
        <section className="space-y-4">
          <h3 className={sectionTitleClass}>Media & documents</h3>
          <div className="glass-card rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
            <div>
              <label className={labelClass}>Product image</label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                Upload an image file or paste from clipboard (Cmd+V / Ctrl+V).
              </p>
              <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl p-8 text-center bg-zinc-50 dark:bg-zinc-800/50">
                <ImageIcon className="w-10 h-10 text-zinc-400 mx-auto mb-2" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Upload image</p>
              </div>
            </div>
            <div>
              <label className={labelClass}>Documentation</label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                Upload files or add links to manuals, specifications, and other documentation.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-sm">
                  <Upload className="w-4 h-4" /> Upload document
                </button>
                <button type="button" disabled className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-sm">
                  <FileText className="w-4 h-4" /> Add external link
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Tags */}
        <section className="space-y-4">
          <h3 className={sectionTitleClass}>Tags</h3>
          <div className="glass-card rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">Add tags to categorize this equipment.</p>
            <button type="button" disabled className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-sm">
              <Plus className="w-3.5 h-3.5" /> New tag
            </button>
          </div>
        </section>

        {/* Footer */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:pointer-events-none"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save equipment'}
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50"
          >
            <X className="w-4 h-4" /> Cancel
          </button>
        </div>
      </form>
    </DrawerModal>
  )
}
