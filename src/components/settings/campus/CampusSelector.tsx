'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import { Edit2, Trash2, MoreVertical } from 'lucide-react'
import TabIndicator from '@/components/ui/TabIndicator'
import { useAnimatedTabIndicator } from '@/lib/hooks/useAnimatedTabIndicator'
import type { Campus } from './types'

type CampusSelectorProps = {
  campuses: Campus[]
  selectedCampusId: string | null
  onSelectCampus: (id: string) => void
  onEditCampus: (campus: Campus) => void
  onDeleteCampus: (campus: Campus) => void
}

export default function CampusSelector({
  campuses,
  selectedCampusId,
  onSelectCampus,
  onEditCampus,
  onDeleteCampus,
}: CampusSelectorProps) {
  const { containerRef, setTabRef, indicatorStyle } = useAnimatedTabIndicator(
    selectedCampusId ?? '',
    [campuses.length],
  )
  const [menuOpen, setMenuOpen] = React.useState<string | null>(null)
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number } | null>(null)

  const closeMenu = () => {
    setMenuOpen(null)
    setMenuPos(null)
  }

  return (
    <div ref={containerRef} role="tablist" aria-label="Campus selector" className="relative flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
      {campuses.map((campus) => (
        <div key={campus.id} className="relative flex items-center">
          <button
            ref={(el) => setTabRef(campus.id, el)}
            role="tab"
            aria-selected={selectedCampusId === campus.id}
            onClick={() => onSelectCampus(campus.id)}
            className={`px-4 py-3 text-sm font-medium transition whitespace-nowrap ${
              selectedCampusId === campus.id
                ? 'text-slate-900'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {campus.name}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (menuOpen === campus.id) {
                closeMenu()
              } else {
                const rect = e.currentTarget.getBoundingClientRect()
                setMenuPos({ top: rect.bottom + 4, left: rect.right - 176 })
                setMenuOpen(campus.id)
              }
            }}
            className={`p-2.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition ${
              selectedCampusId === campus.id ? 'visible' : 'invisible'
            }`}
            tabIndex={selectedCampusId === campus.id ? 0 : -1}
            aria-label="Campus options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen === campus.id && menuPos && createPortal(
            <>
              <div className="fixed inset-0 z-popover" onClick={closeMenu} />
              <div
                className="fixed z-[76] w-44 ui-glass-dropdown py-1"
                style={{ top: menuPos.top, left: menuPos.left }}
              >
                <button
                  onClick={() => { onEditCampus(campus); closeMenu() }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 whitespace-nowrap"
                  style={{ minHeight: 'auto' }}
                >
                  <Edit2 className="w-3.5 h-3.5 flex-shrink-0" /> Edit Campus
                </button>
                <button
                  onClick={() => { onDeleteCampus(campus); closeMenu() }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 whitespace-nowrap"
                  style={{ minHeight: 'auto' }}
                >
                  <Trash2 className="w-3.5 h-3.5 flex-shrink-0" /> Delete Campus
                </button>
              </div>
            </>,
            document.body,
          )}
        </div>
      ))}
      <TabIndicator style={indicatorStyle} />
    </div>
  )
}
