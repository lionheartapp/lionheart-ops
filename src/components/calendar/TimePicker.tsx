'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'

// 96 time slots at 15-minute intervals
export const TIME_OPTIONS: { value: string; label: string }[] = []
for (let h = 0; h < 24; h++) {
  for (const m of [0, 15, 30, 45]) {
    const value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
    const ampm = h < 12 ? 'AM' : 'PM'
    const label = `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
    TIME_OPTIONS.push({ value, label })
  }
}

interface TimePickerProps {
  value: string
  onChange: (v: string) => void
}

export function TimePicker({ value, onChange }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const currentLabel = TIME_OPTIONS.find((o) => o.value === value)?.label || value

  // Auto-scroll to selected item when dropdown opens
  useEffect(() => {
    if (open && listRef.current) {
      const idx = TIME_OPTIONS.findIndex((o) => o.value === value)
      if (idx >= 0) {
        const itemHeight = 36
        listRef.current.scrollTop = Math.max(0, idx * itemHeight - 72) // center-ish
      }
    }
  }, [open, value])

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

  const currentIdx = TIME_OPTIONS.findIndex((o) => o.value === value)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = Math.min(currentIdx + 1, TIME_OPTIONS.length - 1)
      onChange(TIME_OPTIONS[next].value)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = Math.max(currentIdx - 1, 0)
      onChange(TIME_OPTIONS[prev].value)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 min-h-0 px-3 py-1.5 bg-slate-100 rounded-full text-sm font-medium text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
      >
        {currentLabel}
        <ChevronDown className="w-3 h-3 text-slate-400" />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          className="absolute top-full left-0 mt-1 w-36 max-h-52 overflow-y-auto bg-white rounded-xl shadow-lg border border-slate-200 z-50 py-1"
        >
          {TIME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                opt.value === value
                  ? 'bg-primary-50 text-primary-700 font-semibold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
