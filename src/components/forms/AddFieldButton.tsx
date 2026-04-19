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

const CATEGORIES: { key: FieldTypeMeta['category']; label: string }[] = [
  { key: 'basic', label: 'Basic' },
  { key: 'choice', label: 'Choice' },
  { key: 'special', label: 'Special' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function AddFieldButton({ onAdd }: AddFieldButtonProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full rounded-2xl border border-dashed border-[rgba(17,15,10,0.12)] bg-white px-4 py-3 text-sm text-[#6a6864] hover:border-blue-400/40 hover:text-blue-600 transition-colors duration-200 cursor-pointer flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Add field
      </button>

      {open && (
        <div className="absolute z-20 left-0 right-0 mt-2 rounded-2xl border border-[rgba(17,15,10,0.08)] bg-white shadow-[0_4px_18px_rgba(0,0,0,0.04),0_8px_28px_rgba(0,0,0,0.06)] p-3 animate-[fadeIn_150ms_ease-out]">
          {CATEGORIES.map((cat) => {
            const fields = FIELD_TYPE_META.filter((m) => m.category === cat.key)
            return (
              <div key={cat.key} className="mb-3 last:mb-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#a8a49d] px-2 mb-1.5">
                  {cat.label}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {fields.map((m) => (
                    <button
                      key={m.type}
                      type="button"
                      className="flex items-start gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-[#f5f4f0] cursor-pointer transition-colors duration-150"
                      onClick={() => {
                        onAdd(m.type)
                        setOpen(false)
                      }}
                    >
                      <span className="text-[#6a6864] mt-0.5 shrink-0">
                        {getIcon(m.icon)}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#1a1915] truncate">
                          {m.label}
                        </div>
                        <div className="text-[11px] text-[#a8a49d] leading-tight">
                          {m.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
