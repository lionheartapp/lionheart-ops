'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { FIELD_TYPE_META, type FormFieldType, type FieldTypeMeta } from '@/lib/forms/schemas'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AddFieldButtonProps {
  onAdd: (type: FormFieldType) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getIcon(iconName: string) {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[iconName]
  return Icon ? <Icon className="w-4 h-4" /> : null
}

// Common types shown prominently at top
const COMMON_TYPES: FormFieldType[] = ['TEXT', 'TEXTAREA', 'DROPDOWN', 'CHECKBOX']

// ─── Component ────────────────────────────────────────────────────────────────

export default function AddFieldButton({ onAdd }: AddFieldButtonProps) {
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setShowAll(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const commonMeta = COMMON_TYPES.map((t) => FIELD_TYPE_META.find((m) => m.type === t)!).filter(Boolean)
  const moreMeta = FIELD_TYPE_META.filter((m) => !COMMON_TYPES.includes(m.type))

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setShowAll(false) }}
        className="w-full rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Add question
      </button>

      {open && (
        <div className="absolute z-20 left-0 right-0 bottom-full mb-2 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden animate-[fadeIn_100ms_ease-out]">
          {/* Common types — shown first */}
          <div className="p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-1">Common</p>
            <div className="grid grid-cols-2 gap-1">
              {commonMeta.map((m) => (
                <button
                  key={m.type}
                  type="button"
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => { onAdd(m.type); setOpen(false); setShowAll(false) }}
                >
                  <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">
                    {getIcon(m.icon)}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900">{m.label}</div>
                    <div className="text-[11px] text-slate-400">{m.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* More types — expandable */}
          {!showAll ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-600 py-2 border-t border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"
            >
              Show all field types...
            </button>
          ) : (
            <div className="border-t border-slate-100 p-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-1">More</p>
              <div className="grid grid-cols-2 gap-1">
                {moreMeta.map((m) => (
                  <button
                    key={m.type}
                    type="button"
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => { onAdd(m.type); setOpen(false); setShowAll(false) }}
                  >
                    <span className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">
                      {getIcon(m.icon)}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900">{m.label}</div>
                      <div className="text-[11px] text-slate-400">{m.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
