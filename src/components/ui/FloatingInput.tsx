'use client'

import { forwardRef, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode, useState, useRef, useEffect, useCallback } from 'react'

// Shared styles
const borderBase = 'border border-gray-300 rounded-lg bg-white transition-colors'
const borderFocus = 'focus:border-gray-900 focus:ring-1 focus:ring-gray-900/10'
const borderDisabled = 'disabled:bg-gray-50 disabled:text-gray-500 disabled:border-gray-200'
const labelBase = 'absolute left-3 -top-2.5 px-1 bg-white text-xs text-gray-500 font-medium pointer-events-none transition-all duration-200'
const labelInside = 'peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:text-gray-400'
const labelFocused = 'peer-focus:-top-2.5 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:font-medium peer-focus:text-gray-600'

// ─── FloatingInput ────────────────────────────────────────────────────────────

interface FloatingInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
}

export const FloatingInput = forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ label, id, className, required, ...props }, ref) => (
    <div className="relative">
      <input
        ref={ref}
        id={id}
        placeholder={label}
        required={required}
        aria-required={required || undefined}
        className={`peer w-full px-3.5 py-3.5 text-sm text-gray-900 placeholder-transparent outline-none ${borderBase} ${borderFocus} ${borderDisabled} ${className || ''}`}
        {...props}
      />
      <label
        htmlFor={id}
        className={`${labelBase} ${labelInside} ${labelFocused} peer-disabled:bg-gray-50`}
      >
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
    </div>
  )
)
FloatingInput.displayName = 'FloatingInput'

// ─── FloatingSelect ───────────────────────────────────────────────────────────

interface FloatingSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  children: ReactNode
}

const chevronSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%236B7280' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`

export const FloatingSelect = forwardRef<HTMLSelectElement, FloatingSelectProps>(
  ({ label, id, className, children, required, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        id={id}
        required={required}
        aria-required={required || undefined}
        className={`peer w-full px-3.5 py-3.5 pr-10 text-sm text-gray-900 outline-none appearance-none bg-no-repeat ${borderBase} ${borderFocus} ${borderDisabled} ${className || ''}`}
        style={{
          backgroundImage: chevronSvg,
          backgroundSize: '16px 16px',
          backgroundPosition: 'right 12px center',
        }}
        {...props}
      >
        {children}
      </select>
      <label
        htmlFor={id}
        className={`${labelBase} peer-disabled:bg-gray-50`}
      >
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
    </div>
  )
)
FloatingSelect.displayName = 'FloatingSelect'

// ─── FloatingDropdown ────────────────────────────────────────────────────────

export type DropdownOption = {
  value: string
  label: string
  group?: string
  color?: string
  disabled?: boolean
}

interface FloatingDropdownProps {
  id?: string
  label: string
  value: string
  onChange: (value: string) => void
  options: DropdownOption[]
  renderSelected?: (option: DropdownOption) => ReactNode
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

export function FloatingDropdown({
  id,
  label,
  value,
  onChange,
  options,
  renderSelected,
  placeholder,
  required,
  disabled,
  className,
}: FloatingDropdownProps) {
  const [open, setOpen] = useState(false)
  const [focusIdx, setFocusIdx] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  // Selectables: non-disabled options only (for keyboard nav)
  const selectables = options.filter((o) => !o.disabled)

  // Group options: collect unique group names in order, ungrouped last
  const groupOrder: (string | undefined)[] = []
  const seen = new Set<string | undefined>()
  for (const opt of options) {
    if (!seen.has(opt.group)) {
      seen.add(opt.group)
      groupOrder.push(opt.group)
    }
  }

  // Close on click outside
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // Reset focus index when opening
  useEffect(() => {
    if (open) {
      const idx = selectables.findIndex((o) => o.value === value)
      setFocusIdx(idx >= 0 ? idx : 0)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll focused item into view
  useEffect(() => {
    if (!open || focusIdx < 0 || !listRef.current) return
    const items = listRef.current.querySelectorAll('[data-dropdown-item]')
    items[focusIdx]?.scrollIntoView({ block: 'nearest' })
  }, [focusIdx, open])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusIdx((prev) => Math.min(prev + 1, selectables.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusIdx((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (focusIdx >= 0 && focusIdx < selectables.length) {
          onChange(selectables[focusIdx].value)
          setOpen(false)
          triggerRef.current?.focus()
        }
        break
      case 'Home':
        e.preventDefault()
        setFocusIdx(0)
        break
      case 'End':
        e.preventDefault()
        setFocusIdx(selectables.length - 1)
        break
    }
  }, [open, focusIdx, selectables, onChange])

  const hasValue = !!selected

  return (
    <div ref={containerRef} className={`relative ${className || ''}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => !disabled && setOpen((p) => !p)}
        onKeyDown={handleKeyDown}
        className={`w-full px-3.5 py-3.5 pr-10 text-sm text-left outline-none bg-no-repeat ${borderBase} ${
          open ? 'border-gray-900 ring-1 ring-gray-900/10' : ''
        } ${disabled ? 'bg-gray-50 text-gray-500 border-gray-200 cursor-not-allowed' : 'cursor-pointer'}`}
        style={{
          backgroundImage: chevronSvg,
          backgroundSize: '16px 16px',
          backgroundPosition: 'right 12px center',
        }}
      >
        {hasValue ? (
          renderSelected ? (
            renderSelected(selected!)
          ) : (
            <span className="flex items-center gap-2 text-gray-900">
              {selected!.color && (
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: selected!.color }}
                />
              )}
              {selected!.label}
            </span>
          )
        ) : (
          <span className="text-gray-400">{placeholder || label}</span>
        )}
      </button>
      <label
        htmlFor={id}
        className={`${labelBase} ${disabled ? 'bg-gray-50' : ''}`}
      >
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto ui-glass-dropdown z-50 py-1"
        >
          {groupOrder.map((groupName) => {
            const groupOptions = options.filter((o) => o.group === groupName)
            return (
              <div key={groupName ?? '__ungrouped'}>
                {groupName && (
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider select-none">
                    {groupName}
                  </div>
                )}
                {groupOptions.map((opt) => {
                  const selectableIdx = selectables.indexOf(opt)
                  const isFocused = selectableIdx === focusIdx
                  const isSelected = opt.value === value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      data-dropdown-item
                      disabled={opt.disabled}
                      onClick={() => {
                        if (opt.disabled) return
                        onChange(opt.value)
                        setOpen(false)
                        triggerRef.current?.focus()
                      }}
                      onMouseEnter={() => {
                        if (!opt.disabled) setFocusIdx(selectableIdx)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                        opt.disabled
                          ? 'text-gray-300 cursor-not-allowed'
                          : isSelected
                            ? 'bg-primary-50 text-primary-700 font-medium'
                            : isFocused
                              ? 'bg-gray-50 text-gray-900'
                              : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {opt.color && (
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: opt.color }}
                        />
                      )}
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── FloatingTextarea ─────────────────────────────────────────────────────────

interface FloatingTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
}

export const FloatingTextarea = forwardRef<HTMLTextAreaElement, FloatingTextareaProps>(
  ({ label, id, className, ...props }, ref) => (
    <div className="relative">
      <textarea
        ref={ref}
        id={id}
        placeholder={label}
        className={`peer w-full px-3.5 pt-5 pb-3 text-sm text-gray-900 placeholder-transparent outline-none resize-none ${borderBase} ${borderFocus} ${borderDisabled} ${className || ''}`}
        {...props}
      />
      <label
        htmlFor={id}
        className={`${labelBase} peer-placeholder-shown:top-4 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:text-gray-400 ${labelFocused} peer-disabled:bg-gray-50`}
      >
        {label}
      </label>
    </div>
  )
)
FloatingTextarea.displayName = 'FloatingTextarea'
