'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { Input } from '@/components/ui/Input'
import {
  FIELD_TYPE_META,
  FIELD_CATEGORY_LABELS,
  type FormFieldType,
  type FieldTypeCategory,
} from '@/lib/forms/schemas'

interface FieldPaletteProps {
  onAddField: (type: FormFieldType) => void
}

function getIcon(iconName: string, className = 'w-5 h-5') {
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>)[iconName]
  return Icon ? <Icon className={className} strokeWidth={1.5} /> : null
}

export default function FieldPalette({ onAddField }: FieldPaletteProps) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? FIELD_TYPE_META.filter(
        (m) =>
          m.label.toLowerCase().includes(search.toLowerCase()) ||
          m.description.toLowerCase().includes(search.toLowerCase())
      )
    : FIELD_TYPE_META

  // Group by category
  const groups = new Map<FieldTypeCategory, typeof FIELD_TYPE_META>()
  for (const meta of filtered) {
    const existing = groups.get(meta.category) ?? []
    existing.push(meta)
    groups.set(meta.category, existing)
  }

  return (
    <div className="p-3 space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          size="sm"
          className="w-full h-8 pl-8 text-xs bg-slate-50 focus:ring-slate-900/10"
        />
      </div>

      {/* Grouped field tiles */}
      {Array.from(groups.entries()).map(([category, items]) => (
        <div key={category}>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-0.5">
            {FIELD_CATEGORY_LABELS[category]}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {items.map((meta) => (
              <button
                key={meta.type}
                type="button"
                onClick={() => onAddField(meta.type)}
                className="flex flex-col items-center gap-1 p-2.5 rounded-lg border border-slate-100 bg-white hover:border-slate-300 hover:shadow-sm transition-all duration-150 cursor-pointer group"
                title={meta.description}
              >
                <span className="text-slate-400 group-hover:text-blue-500 transition-colors">
                  {getIcon(meta.icon, 'w-4.5 h-4.5')}
                </span>
                <span className="text-[10px] font-medium text-slate-600 group-hover:text-slate-800 truncate w-full text-center">
                  {meta.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-4">No fields match &ldquo;{search}&rdquo;</p>
      )}
    </div>
  )
}
