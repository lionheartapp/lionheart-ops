'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { X } from 'lucide-react'
import type {
  WorkOrdersFilterState,
  MaintenanceStatus,
  MaintenancePriority,
  MaintenanceCategory,
} from './WorkOrdersFilters'
import { DEFAULT_FILTERS } from './WorkOrdersFilters'
import { FloatingDropdown } from '@/components/ui/FloatingInput'
import { SearchInput } from '@/components/ui/SearchInput'
import { Checkbox } from '@/components/ui/Checkbox'

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
              <FloatingDropdown
                label="Status"
                value={filters.status}
                onChange={(value) => update({ status: value as MaintenanceStatus | '' })}
                options={[
                  { value: '', label: 'All Statuses' },
                  ...STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
                ]}
              />

              <FloatingDropdown
                label="Priority"
                value={filters.priority}
                onChange={(value) => update({ priority: value as MaintenancePriority | '' })}
                options={[
                  { value: '', label: 'All Priorities' },
                  ...PRIORITY_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
                ]}
              />

              <FloatingDropdown
                label="Category"
                value={filters.category}
                onChange={(value) => update({ category: value as MaintenanceCategory | '' })}
                options={[
                  { value: '', label: 'All Categories' },
                  ...CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
                ]}
              />

              {technicians.length > 0 && (
                <FloatingDropdown
                  label="Technician"
                  value={filters.assignedToId}
                  onChange={(value) => update({ assignedToId: value })}
                  options={[
                    { value: '', label: 'All Technicians' },
                    ...technicians.map((t) => ({
                      value: t.id,
                      label: `${t.firstName} ${t.lastName}`,
                    })),
                  ]}
                />
              )}

              {/* Search */}
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5 block">
                  Search
                </label>
                <SearchInput
                  ref={searchRef}
                  value={filters.search}
                  onChange={(e) => update({ search: e.target.value })}
                  onClear={() => update({ search: '' })}
                  placeholder="Search tickets..."
                  size="sm"
                />
              </div>

              {/* Unassigned toggle */}
              <Checkbox
                checked={filters.unassigned}
                onChange={(e) => update({ unassigned: e.target.checked })}
                label="Unassigned only"
                className="py-1"
              />
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
