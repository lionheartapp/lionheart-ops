'use client'

import { useState } from 'react'
import { Plus, FileText } from 'lucide-react'
import SortableList from '@/components/forms/SortableList'
import { Input } from '@/components/ui/Input'
import type { FormPageData } from './FormBuilder'

interface PageListProps {
  pages: FormPageData[]
  activePageId: string | null
  onSelectPage: (pageId: string) => void
  onAddPage: () => void
  onReorder: (pages: FormPageData[]) => void
  onRenamePage: (pageId: string, title: string) => void
}

export default function PageList({
  pages,
  activePageId,
  onSelectPage,
  onAddPage,
  onReorder,
  onRenamePage,
}: PageListProps) {
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="p-3 space-y-2">
      <SortableList
        items={pages}
        keyFn={(p) => p.id}
        onReorder={onReorder}
        className="space-y-1"
        renderItem={(page, _index, { listeners, attributes }) => (
          <div
            role="button"
            tabIndex={0}
            onClick={() => onSelectPage(page.id)}
            onDoubleClick={() => setEditingId(page.id)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSelectPage(page.id) }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
              activePageId === page.id
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span
              className="touch-none cursor-grab active:cursor-grabbing"
              {...listeners}
              {...attributes}
            >
              <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${
                activePageId === page.id ? 'text-white/60' : 'text-slate-400'
              }`} />
            </span>
            <div className="flex-1 min-w-0">
              {editingId === page.id ? (
                <Input
                  type="text"
                  value={page.title}
                  onChange={(e) => onRenamePage(page.id, e.target.value)}
                  onBlur={() => setEditingId(null)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setEditingId(null); e.stopPropagation() }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  className={`h-auto min-h-0 text-xs font-medium w-full bg-transparent border-0 border-b p-0 shadow-none focus:ring-0 ${
                    activePageId === page.id
                      ? 'text-white border-white/30 placeholder:text-white/40'
                      : 'text-slate-700 border-slate-300 placeholder:text-slate-400'
                  }`}
                  placeholder="Page name"
                />
              ) : (
                <p className="text-xs font-medium truncate">{page.title}</p>
              )}
              <p className={`text-[10px] ${
                activePageId === page.id ? 'text-white/50' : 'text-slate-400'
              }`}>
                {page.fields.length} field{page.fields.length === 1 ? '' : 's'}
                {page.isOptional ? ' · Optional' : ''}
              </p>
            </div>
          </div>
        )}
      />

      <button
        type="button"
        onClick={onAddPage}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 border border-dashed border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Page
      </button>
    </div>
  )
}
