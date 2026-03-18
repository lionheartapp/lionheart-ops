'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { X, Search } from 'lucide-react'
import type {
  WorkOrdersFilterState,
  MaintenanceStatus,
  MaintenancePriority,
  MaintenanceCategory,
} from './WorkOrdersFilters'
import { DEFAULT_FILTERS } from './WorkOrdersFilters'

interface Technician {
  id: string
  firstName: string
  lastName: string
}

interface FilterBottomSheetProps {
  open: boolean
  onClose: () => void
  filters: WorkOrdersFilterState
  onChange: (filters: WorkOrdersFilterState) => void
  technicians: Technician[]
}

const STATUS_OPTIONS: { value: MaintenanceStatus; label: string }[] = [
  { value: 'BACKLOG', label: 'Backlog' },
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_HOLD', label: 'On Hold' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'QA', label: 'QA' },
  { value: 'DONE', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

const PRIORITY_OPTIONS: { value: MaintenancePriority; label: string }[] = [
  { value: 'URGENT', label: 'Urgent' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
]

const CATEGORY_OPTIONS: { value: MaintenanceCategory; label: string }[] = [
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'PLUMBING', label: 'Plumbing' },
  { value: 'HVAC', label: 'HVAC' },
  { value: 'STRUCTURAL', label: 'Structural' },
  { value: 'CUSTODIAL_BIOHAZARD', label: 'Custodial / Biohazard' },
  { value: 'GROUNDS', label: 'Grounds' },
  { value: 'IT_AV', label: 'IT / AV' },
  { value: 'OTHER', label: 'Other' },
]

const selectClass = 'ui-select w-full !py-2.5 cursor-pointer'

export default function FilterBottomSheet({
  open,
  onClose,
  filters,
  onChange,
  technicians,
}: FilterBottomSheetProps) {
  const searchRef = useRef<HTMLInputElement>(null)
  const dragControls = useDragControls()

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  function update(patch: Partial<WorkOrdersFilterState>) {
    onChange({ ...filters, ...patch })
  }

  function clearAll() {
    const searchInput = searchRef.current
    if (searchInput) searchInput.value = ''
    onChange({ ...DEFAULT_FILTERS, schoolId: filters.schoolId })
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-[61] bg-white rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0 }}
            dragElastic={0.1}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100) onClose()
            }}
          >
            {/* Drag handle */}
            <div
              className="flex items-center justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Filters</h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close filters"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Scrollable filter controls */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Status */}
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => update({ status: e.target.value as MaintenanceStatus | '' })}
                  className={selectClass}
                >
                  <option value="">All Statuses</option>
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
                  Priority
                </label>
                <select
                  value={filters.priority}
                  onChange={(e) => update({ priority: e.target.value as MaintenancePriority | '' })}
                  className={selectClass}
                >
                  <option value="">All Priorities</option>
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
                  Category
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => update({ category: e.target.value as MaintenanceCategory | '' })}
                  className={selectClass}
                >
                  <option value="">All Categories</option>
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Technician */}
              {technicians.length > 0 && (
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
                    Technician
                  </label>
                  <select
                    value={filters.assignedToId}
                    onChange={(e) => update({ assignedToId: e.target.value })}
                    className={selectClass}
                  >
                    <option value="">All Technicians</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.firstName} {t.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search */}
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    ref={searchRef}
                    type="text"
                    defaultValue={filters.search}
                    onChange={(e) => update({ search: e.target.value })}
                    placeholder="Search tickets..."
                    className="ui-input w-full !py-2.5 pl-9"
                  />
                </div>
              </div>

              {/* Unassigned toggle */}
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none py-1">
                <input
                  type="checkbox"
                  checked={filters.unassigned}
                  onChange={(e) => update({ unassigned: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-slate-900 focus-visible:ring-slate-400 cursor-pointer"
                />
                Unassigned only
              </label>
            </div>

            {/* Footer actions */}
            <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100 bg-white">
              <button
                onClick={clearAll}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Clear All
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Apply
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
