'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, MapPin, X, ChevronRight, Building2 } from 'lucide-react'
import { useCampusLocations, type CampusLocationOption } from '@/lib/hooks/useCampusLocations'
import { dropdownVariants } from '@/lib/animations'

interface StepLocationProps {
  buildingId: string | null
  areaId: string | null
  roomId: string | null
  locationLabel: string
  onSelect: (option: CampusLocationOption) => void
  onClear: () => void
}

export default function StepLocation({
  buildingId,
  areaId,
  roomId,
  locationLabel,
  onSelect,
  onClear,
}: StepLocationProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const deferredQuery = useDeferredValue(query)

  const { data: locations, isLoading } = useCampusLocations()

  const hasSelection = !!(buildingId || areaId || roomId)

  const filtered = useMemo(() => {
    if (!locations || !deferredQuery.trim()) return []
    const q = deferredQuery.toLowerCase()
    return locations.filter((loc) => {
      if (loc.label.toLowerCase().includes(q)) return true
      if (loc.hierarchy?.some((h) => h.toLowerCase().includes(q))) return true
      return false
    }).slice(0, 20)
  }, [locations, deferredQuery])

  // Group results by building (hierarchy[0])
  const grouped = useMemo(() => {
    const map = new Map<string, CampusLocationOption[]>()
    for (const loc of filtered) {
      const group = loc.hierarchy?.[0] ?? 'Other'
      if (!map.has(group)) map.set(group, [])
      map.get(group)!.push(loc)
    }
    return map
  }, [filtered])

  const handleSelect = (option: CampusLocationOption) => {
    onSelect(option)
    setQuery('')
    setIsOpen(false)
  }

  const handleClear = () => {
    onClear()
    setQuery('')
    setIsOpen(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">Where is the issue?</h3>
        <p className="text-sm text-slate-500">Search for a room, area, or building</p>
      </div>

      {hasSelection ? (
        /* Selected location card */
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="ui-glass rounded-xl p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin className="w-4 h-4 text-primary-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 mb-1.5">{locationLabel}</p>
                {/* Hierarchy chips */}
                <div className="flex flex-wrap items-center gap-1">
                  {(locations?.find((l) =>
                    l.buildingId === buildingId &&
                    l.areaId === areaId &&
                    l.roomId === roomId
                  )?.hierarchy ?? locationLabel.split(' — ')).map((part, i, arr) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-md font-medium">
                        {part}
                      </span>
                      {i < arr.length - 1 && (
                        <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      )}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer flex-shrink-0"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      ) : (
        /* Search input */
        <div className="relative">
          {isLoading ? (
            /* Loading skeleton */
            <div className="animate-pulse">
              <div className="h-11 bg-slate-100 rounded-xl" />
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setIsOpen(true)
                  }}
                  onFocus={() => setIsOpen(true)}
                  onBlur={() => setTimeout(() => setIsOpen(false), 150)}
                  placeholder="Search rooms, areas, or buildings..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus:border-transparent transition-shadow"
                />
              </div>

              <AnimatePresence>
                {isOpen && filtered.length > 0 && (
                  <motion.div
                    key="dropdown"
                    variants={dropdownVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="absolute z-50 mt-1.5 w-full ui-glass-dropdown max-h-64 overflow-y-auto"
                  >
                    {Array.from(grouped.entries()).map(([groupName, items]) => (
                      <div key={groupName}>
                        <div className="px-3 pt-2.5 pb-1 flex items-center gap-1.5">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                            {groupName}
                          </span>
                        </div>
                        {items.map((opt) => (
                          <button
                            key={`${opt.buildingId}-${opt.areaId}-${opt.roomId}`}
                            type="button"
                            onMouseDown={() => handleSelect(opt)}
                            className="w-full text-left px-3 py-2 hover:bg-primary-50 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${
                                opt.type === 'room' ? 'text-primary-500' :
                                opt.type === 'area' ? 'text-blue-400' : 'text-slate-400'
                              }`} />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">
                                  {opt.type === 'room' && opt.hierarchy ? opt.hierarchy[opt.hierarchy.length - 1] : opt.label}
                                </p>
                                {opt.hierarchy && opt.hierarchy.length > 1 && (
                                  <p className="text-xs text-slate-500 truncate">
                                    {opt.hierarchy.slice(0, -1).join(' › ')}
                                  </p>
                                )}
                              </div>
                              <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-md flex-shrink-0 ${
                                opt.type === 'room' ? 'bg-primary-100 text-primary-700' :
                                opt.type === 'area' ? 'bg-blue-100 text-blue-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {opt.type}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ))}
                  </motion.div>
                )}

                {isOpen && query.trim() && filtered.length === 0 && (
                  <motion.div
                    key="no-results"
                    variants={dropdownVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="absolute z-50 mt-1.5 w-full ui-glass-dropdown py-4 text-center"
                  >
                    <p className="text-sm text-slate-500">No locations found for &ldquo;{query}&rdquo;</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      )}

      {!hasSelection && !isLoading && (
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" />
          Select a room, area, or building to continue
        </p>
      )}
    </div>
  )
}
