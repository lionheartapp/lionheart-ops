'use client'

import { type ReactNode } from 'react'

type DetailDrawerProps = {
  children?: ReactNode
  isOpen: boolean
  onClose: () => void
  title: string
  width?: string
}

export default function DetailDrawer({ children, isOpen, onClose, title, width }: DetailDrawerProps) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <div
        className={`relative bg-white shadow-xl ${width === 'lg' ? 'max-w-2xl' : 'max-w-md'} w-full h-full overflow-auto`}
        role="dialog"
        aria-label={title}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-gray-100" aria-label="Close">
            ×
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
