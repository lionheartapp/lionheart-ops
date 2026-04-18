'use client'

import { useState, useEffect, useRef } from 'react'
import { useCampusLocations, type CampusLocationOption } from '@/lib/hooks/useCampusLocations'

interface LocationComboboxProps {
  value: string
  buildingId: string | null
  areaId: string | null
  onChange: (locationText: string, buildingId: string | null, areaId: string | null) => void
}

export function LocationCombobox({
  value,
  buildingId,
  areaId,
  onChange,
}: LocationComboboxProps) {
  const { data: locations = [] } = useCampusLocations()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync input display with external value
  useEffect(() => {
    setQuery(value)
  }, [value])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const filtered = locations.filter((loc) =>
    loc.label.toLowerCase().includes(query.toLowerCase())
  )

  const handleSelect = (loc: CampusLocationOption) => {
    onChange(loc.label, loc.buildingId, loc.areaId)
    setQuery(loc.label)
    setOpen(false)
  }

  const handleFreeText = () => {
    onChange(query, null, null)
    setOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (!open) setOpen(true)
    // If user clears or changes text away from a campus location, reset IDs
    if (buildingId || areaId) {
      onChange(val, null, null)
    }
  }

  const showDropdown = open && query.length > 0

  return (
    <div ref={containerRef} className="relative" role="combobox" aria-expanded={open} aria-haspopup="listbox">
      <input
        ref={inputRef}
        type="text"
        placeholder="Location"
        value={query}
        onChange={handleInputChange}
        onFocus={() => { if (query.length > 0 || locations.length > 0) setOpen(true) }}
        className="peer w-full px-3.5 py-3.5 text-sm text-slate-900 placeholder-transparent outline-none border border-slate-300 rounded-lg bg-white transition-colors focus:border-slate-900 focus-visible:ring-1 focus-visible:ring-slate-900/10"
        aria-label="Event location"
        aria-autocomplete="list"
      />
      <label className="absolute left-3 -top-2.5 px-1 bg-white text-xs text-slate-500 font-medium pointer-events-none transition-all duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:text-slate-400 peer-focus:-top-2.5 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:font-medium peer-focus:text-slate-600">
        Location
      </label>

      {open && (locations.length > 0 || query.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white rounded-xl shadow-lg border border-slate-200 z-50 py-1" role="listbox">
          {/* Campus locations section */}
          {filtered.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Campus Locations
              </div>
              {filtered.map((loc) => {
                const isSelected = loc.buildingId === buildingId && loc.areaId === areaId && (loc.buildingId !== null || loc.areaId !== null)
                return (
                  <button
                    key={`${loc.buildingId}-${loc.areaId}`}
                    type="button"
                    onClick={() => handleSelect(loc)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      isSelected
                        ? 'bg-primary-50 text-primary-700 font-medium'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {loc.label}
                  </button>
                )
              })}
            </>
          )}

          {/* Free-text option */}
          {query.trim().length > 0 && (
            <>
              {filtered.length > 0 && <div className="border-t border-slate-100 my-1" />}
              <button
                type="button"
                onClick={handleFreeText}
                className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Use &ldquo;{query}&rdquo; as custom location
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
