'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MapPinOff, Plus, Search } from 'lucide-react'
import { Input } from '@/components/ui/Input'

/**
 * Shape the combobox needs from each suggestion. Kept small on purpose so
 * both Building and Area can feed into this component.
 */
export type ComboboxOption = {
  id: string
  name: string
  /** When true, the option renders with a "Not placed" pill. */
  notPlaced?: boolean
  /** Optional secondary line (e.g., "Gym · Shared with MS, HS"). */
  hint?: string
}

type Props = {
  id: string
  label: string
  value: string
  onChange: (nextValue: string) => void
  /** Existing records to search against. Matched by case-insensitive substring on `name`. */
  options: ComboboxOption[]
  /**
   * Fires when the user picks an existing option from the dropdown.
   * The parent decides what to do (e.g., PATCH coords vs. open an edit drawer).
   */
  onSelectExisting: (option: ComboboxOption) => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  required?: boolean
  /** Rendered as a hint above the dropdown (e.g., "We found these — pick one to place it here"). */
  contextHint?: string
}

/**
 * Building/outdoor name search + add combobox.
 *
 * As the user types:
 *  - Matching existing records appear at the top of the dropdown.
 *    Clicking one calls `onSelectExisting` — the parent can then PATCH
 *    coordinates onto an unplaced record instead of creating a duplicate.
 *  - If no exact name match exists, a "+ Add new '{value}'" row appears
 *    at the bottom. Clicking it closes the dropdown and keeps the
 *    typed value in state so the normal submit path creates a new record.
 *
 * This component only manages the visual state of the dropdown — it does
 * NOT call any APIs. All work happens via the two callbacks.
 */
export default function NameCombobox({
  id,
  label,
  value,
  onChange,
  options,
  onSelectExisting,
  placeholder,
  disabled,
  autoFocus,
  required,
  contextHint,
}: Props) {
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter options by case-insensitive substring. Unplaced records rank
  // higher within the results because they're the usual target when the
  // user is trying to assign coordinates.
  const matches = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return options.filter((o) => o.notPlaced).slice(0, 6)
    return options
      .filter((o) => o.name.toLowerCase().includes(q))
      .sort((a, b) => {
        // Exact match first, then unplaced, then alpha
        const aExact = a.name.toLowerCase() === q ? 0 : 1
        const bExact = b.name.toLowerCase() === q ? 0 : 1
        if (aExact !== bExact) return aExact - bExact
        if (!!a.notPlaced !== !!b.notPlaced) return a.notPlaced ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      .slice(0, 6)
  }, [options, value])

  const hasExactMatch = useMemo(() => {
    const q = value.trim().toLowerCase()
    if (!q) return false
    return options.some((o) => o.name.toLowerCase() === q)
  }, [options, value])

  const showAddNew = value.trim().length > 0 && !hasExactMatch

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const showDropdown = open && (matches.length > 0 || showAddNew)

  return (
    <div ref={containerRef} className="relative">
      {/* Floating-label input, styled to match FloatingInput visually */}
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          aria-label={label}
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          onFocus={() => { setFocused(true); setOpen(true) }}
          onBlur={() => setFocused(false)}
          onChange={(e) => { onChange(e.target.value); setOpen(true) }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setOpen(false); (e.target as HTMLInputElement).blur() }
          }}
          className="peer pt-5 pb-2 text-sm focus:ring-0"
        />
        <label
          htmlFor={id}
          className={`absolute left-4 pointer-events-none transition-all duration-150 ${
            value || focused
              ? 'top-1.5 text-[10px] font-medium text-slate-500 uppercase tracking-wide'
              : 'top-1/2 -translate-y-1/2 text-sm text-slate-400'
          }`}
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      </div>

      {showDropdown && (
        <div className="absolute z-30 left-0 right-0 mt-1.5 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          {contextHint && (
            <div className="px-3 py-2 text-[11px] font-medium text-slate-500 bg-slate-50 border-b border-slate-100">
              {contextHint}
            </div>
          )}

          {matches.length > 0 && (
            <div className="py-1 max-h-[240px] overflow-y-auto">
              {matches.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelectExisting(o)
                    setOpen(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate">{o.name}</span>
                      {o.notPlaced && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                          <MapPinOff className="w-3 h-3" />
                          Not placed
                        </span>
                      )}
                    </div>
                    {o.hint && <div className="text-xs text-slate-400 truncate mt-0.5">{o.hint}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {showAddNew && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setOpen(false)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left cursor-pointer ${
                matches.length > 0 ? 'border-t border-slate-100' : ''
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center flex-shrink-0">
                <Plus className="w-3.5 h-3.5" strokeWidth={3} />
              </div>
              <span className="text-sm text-slate-900">
                Add new <span className="font-semibold">&ldquo;{value.trim()}&rdquo;</span>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
