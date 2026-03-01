'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface DetailDrawerProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: 'sm' | 'md' | 'lg' | 'xl'
  onEdit?: () => void
}

const widths = {
  sm: 'w-full sm:w-80',
  md: 'w-full sm:w-96',
  lg: 'w-full sm:w-[32rem]',
  xl: 'w-full sm:w-[40rem]',
} as const

export default function DetailDrawer({
  isOpen,
  onClose,
  title,
  children,
  width = 'md',
  onEdit,
}: DetailDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [shouldShow, setShouldShow] = useState(false)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    if (isOpen) {
      setIsAnimating(true)
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflowY = 'hidden'
      
      // Double requestAnimationFrame for proper animation timing
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setShouldShow(true)
        })
      })
      
      // Focus trap - focus first interactive element
      setTimeout(() => {
        const firstButton = drawerRef.current?.querySelector(
          'button, [tabindex]:not([tabindex="-1"])'
        ) as HTMLElement
        firstButton?.focus()
      }, 100)
    } else if (isAnimating) {
      setShouldShow(false)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflowY = 'unset'
    }
  }, [isOpen, isAnimating])

  const handleClose = () => {
    setShouldShow(false)
    setTimeout(() => {
      setIsAnimating(false)
      onClose()
    }, 300)
  }

  if (!isOpen && !isAnimating) return null

  return createPortal(
    <div
      className="fixed inset-0 z-modal overflow-hidden"
      role="presentation"
      aria-hidden={!isOpen}
    >
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity duration-300 cursor-pointer ${
          shouldShow ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
        role="presentation"
      />

      {/* Drawer - Right side slide */}
      <div
        ref={drawerRef}
        className={`fixed right-0 top-0 bottom-0 w-full sm:right-4 sm:top-4 sm:bottom-4 ${widths[width]} bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out z-modal sm:rounded-2xl ${
          shouldShow ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-labelledby="drawer-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
          <h2
            id="drawer-title"
            className="text-xs text-gray-400 uppercase tracking-wide font-medium truncate"
          >
            {title}
          </h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label="Close drawer"
          >
            <X className="w-4 h-4 text-gray-400" aria-hidden="true" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto px-6 pt-3 pb-6"
        >
          {children}
        </div>

        {/* Footer with Edit button */}
        {onEdit && (
          <div className="px-6 pb-6 pt-2 flex-shrink-0">
            <button
              onClick={onEdit}
              className="w-full py-3.5 text-sm font-semibold text-white bg-gray-900 rounded-full hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-400 transition"
            >
              Edit
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
