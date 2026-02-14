import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Sparkles, Package, Plus, Trash2 } from 'lucide-react'
import ScheduleCheck from './ScheduleCheck'

const LOCATIONS = [
  { value: '', label: 'Select location...' },
  { value: 'gym', label: 'Gym' },
  { value: 'auditorium', label: 'Auditorium' },
  { value: 'cafeteria', label: 'Cafeteria' },
  { value: 'library', label: 'Library' },
  { value: 'classroom', label: 'Classroom' },
]

const GYM_AI_SUGGESTION =
  'Previous events in the Gym required 50+ chairs and a PA system. Would you like to add these to the request?'

const locationLabel = (value) => LOCATIONS.find((o) => o.value === value)?.label || value || ''

export default function FacilitiesRequestForm({
  onSubmit,
  inventoryItems = [],
  inventoryStock = [],
  onInventoryCheck,
  inDrawer = false,
}) {
  const [location, setLocation] = useState('')
  const [details, setDetails] = useState('')
  const [priority, setPriority] = useState('normal')
  const [requestedItems, setRequestedItems] = useState([])
  const [inventoryError, setInventoryError] = useState(null)
  const [showGymToast, setShowGymToast] = useState(false)
  const [gymSuggestionApplied, setGymSuggestionApplied] = useState(false)

  // When user selects Gym, show AI toast (only once per Gym selection, not if they already applied)
  useEffect(() => {
    if (location === 'gym' && !gymSuggestionApplied) {
      setShowGymToast(true)
    }
    if (location !== 'gym') {
      setShowGymToast(false)
      setGymSuggestionApplied(false)
    }
  }, [location, gymSuggestionApplied])

  const handleAddGymSuggestion = () => {
    const addition = '50+ chairs, PA system'
    setDetails((prev) => (prev ? `${prev}; ${addition}` : addition))
    setShowGymToast(false)
    setGymSuggestionApplied(true)
  }

  const handleDismissGymToast = () => {
    setShowGymToast(false)
    setGymSuggestionApplied(true)
  }

  const formContent = (
    <form
          className={inDrawer ? 'space-y-4' : 'p-4 space-y-4'}
          onSubmit={(e) => {
            e.preventDefault()
            setInventoryError(null)
            const itemsToCheck = requestedItems.filter((r) => r.itemId && (r.quantity || 0) > 0)
            if (itemsToCheck.length > 0 && onInventoryCheck) {
              const result = onInventoryCheck(itemsToCheck)
              if (!result.available) {
                setInventoryError(
                  result.shortages?.map((s) => `${s.itemName}: need ${s.needed}, only ${s.available} available`).join('; ') ||
                    'Not enough inventory for requested items.'
                )
                return
              }
            }
            if (!location && !details.trim() && itemsToCheck.length === 0) return
            const title = location ? `${locationLabel(location)} — ${details.trim() || 'Setup/maintenance'}` : (details.trim() || 'Facilities request')
            onSubmit?.({ title, details: details.trim(), priority, requestedItems: itemsToCheck.length ? itemsToCheck : undefined })
            setLocation('')
            setDetails('')
            setPriority('normal')
            setRequestedItems([])
            setGymSuggestionApplied(false)
          }}
        >
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Location
            </label>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="select-arrow-padded w-full pl-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {LOCATIONS.map((opt) => (
                <option key={opt.value || 'empty'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Request details
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder="Describe what you need (e.g. tables, chairs, AV)..."
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {inventoryItems?.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-500" />
                Items needed (from inventory)
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                Request specific items; we'll check availability.
              </p>
              {requestedItems.map((row, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <select
                    value={row.itemId}
                    onChange={(e) =>
                      setRequestedItems((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, itemId: e.target.value } : r))
                      )
                    }
                    className="select-arrow-padded flex-1 pl-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                  >
                    <option value="">Select item...</option>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={row.quantity}
                    onChange={(e) =>
                      setRequestedItems((prev) =>
                        prev.map((r, i) =>
                          i === idx ? { ...r, quantity: parseInt(e.target.value, 10) || 0 } : r
                        )
                      )
                    }
                    className="w-20 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                    placeholder="Qty"
                  />
                  <button
                    type="button"
                    onClick={() => setRequestedItems((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    aria-label="Remove row"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRequestedItems((prev) => [...prev, { itemId: inventoryItems[0]?.id || '', quantity: 1 }])}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-500 hover:underline"
              >
                <Plus className="w-4 h-4" />
                Add item
              </button>
              {inventoryError && (
                <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                  {inventoryError}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="select-arrow-padded w-full pl-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="normal">Normal</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <ScheduleCheck />
          <button
            type="submit"
            className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            Submit request
          </button>
        </form>
  )

  if (inDrawer) {
    return (
      <>
        {formContent}
        {/* AI-style toast when Gym is selected */}
      <AnimatePresence>
        {showGymToast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] w-full max-w-md px-4"
          >
            <div className="glass-card p-4 shadow-xl border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10">
              <div className="flex gap-3">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                    AI Suggestion
                  </p>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    {GYM_AI_SUGGESTION}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleAddGymSuggestion}
                      className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
                    >
                      Add to request
                    </button>
                    <button
                      onClick={handleDismissGymToast}
                      className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                      No thanks
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
    )
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card overflow-hidden"
      >
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 dark:border-blue-950/40">
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-500" />
            New Facilities Request
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Submit a request for setup, equipment, or maintenance
          </p>
        </div>
        {formContent}
      </motion.div>
      <AnimatePresence>
        {showGymToast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
          >
            <div className="glass-card p-4 shadow-xl border-blue-500/30 bg-blue-500/5 dark:bg-blue-500/10">
              <div className="flex gap-3">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                    AI Suggestion
                  </p>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    {GYM_AI_SUGGESTION}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleAddGymSuggestion}
                      className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
                    >
                      Add to request
                    </button>
                    <button
                      onClick={handleDismissGymToast}
                      className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                      No thanks
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
