'use client'

import type { ReactNode } from 'react'
import BottomSheet from './BottomSheet'

interface ActionSheetItem {
  icon?: ReactNode
  label: string
  description?: string
  onClick: () => void
  destructive?: boolean
  /** Optional badge (e.g. notification count) */
  badge?: number
}

interface ActionSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  items: ActionSheetItem[]
  /** Optional header content above the action list */
  header?: ReactNode
}

export default function ActionSheet({
  open,
  onClose,
  title,
  items,
  header,
}: ActionSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="px-2 py-2">
        {header && <div className="px-3 pb-3">{header}</div>}

        <div className="space-y-0.5">
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => {
                onClose()
                // Navigate immediately — don't wait for sheet close animation
                item.onClick()
              }}
              className={`w-full flex items-center gap-3 px-4 py-3.5 min-h-[48px] rounded-xl transition-colors cursor-pointer ${
                item.destructive
                  ? 'text-red-600 hover:bg-red-50 active:bg-red-100'
                  : 'text-slate-700 hover:bg-slate-100/80 active:bg-slate-200/60'
              }`}
            >
              {item.icon && (
                <span className={`flex-shrink-0 w-5 h-5 ${item.destructive ? 'text-red-500' : 'text-slate-400'}`}>
                  {item.icon}
                </span>
              )}
              <div className="flex-1 text-left">
                <span className="text-sm font-medium">{item.label}</span>
                {item.description && (
                  <span className="block text-xs text-slate-400 mt-0.5">{item.description}</span>
                )}
              </div>
              {item.badge != null && item.badge > 0 && (
                <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold bg-primary-500 text-white">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  )
}
