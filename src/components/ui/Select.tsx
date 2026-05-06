'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check } from 'lucide-react'
import {
  triggerClasses,
  FIELD_TRIGGER_DISABLED,
  FIELD_OPEN,
  PANEL_CLASSES,
  PANEL_ROW_BASE,
  PANEL_ROW_SELECTED,
  PANEL_ROW_HOVER,
  type FieldSize,
} from './form-tokens'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SelectOption<T extends string = string> {
  value: T
  label: string
  /** Smaller line under the label */
  subtitle?: string
  /** Icon rendered before the label (lucide icon component or any node) */
  icon?: React.ReactNode
}

interface SelectProps<T extends string = string> {
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  placeholder?: string
  disabled?: boolean
  /** Field size variant. `default` = 52px tall (forms). `sm` = 36px tall (tables). */
  size?: FieldSize
  /** Optional left-aligned icon shown in the trigger */
  triggerIcon?: React.ReactNode
}

// ─── Component ──────────────────────────────────────────────────────────────

export function Select<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled,
  size = 'default',
  triggerIcon,
}: SelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value) ?? null

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  // Escape to close
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen])

  function pick(next: T) {
    onChange(next)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((v) => !v)}
        disabled={disabled}
        className={`${triggerClasses(size)} ${disabled ? FIELD_TRIGGER_DISABLED : ''} ${isOpen ? FIELD_OPEN : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {triggerIcon ?? selected?.icon}
          {selected ? (
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-900 truncate">{selected.label}</p>
              {selected.subtitle && (
                <p className="text-[11px] text-slate-500 truncate">{selected.subtitle}</p>
              )}
            </div>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className={PANEL_CLASSES}
          >
            <div className="max-h-72 overflow-y-auto py-1">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => pick(option.value)}
                  className={`${PANEL_ROW_BASE} ${
                    option.value === value ? PANEL_ROW_SELECTED : PANEL_ROW_HOVER
                  }`}
                >
                  {option.icon && (
                    <span className="flex-shrink-0">{option.icon}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{option.label}</p>
                    {option.subtitle && (
                      <p className="text-[11px] text-slate-500 truncate">{option.subtitle}</p>
                    )}
                  </div>
                  {option.value === value && (
                    <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
