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
  sm: 'w-80',
  md: 'w-96',
  lg: 'w-[32rem]',
  xl: 'w-[40rem]',
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
      {/* Overlay - Darker with backdrop blur like CreateModal */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 cursor-pointer ${
          shouldShow ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
        role="presentation"
      />

      {/* Drawer - Right side slide */}
      <div
        ref={drawerRef}
        className={`fixed right-0 top-0 h-screen ${widths[width]} bg-white shadow-lg flex flex-col transition-transform duration-300 ease-out z-modal ${
          shouldShow ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-labelledby="drawer-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
          <h2
            id="drawer-title"
            className="text-lg sm:text-xl font-bold text-gray-900 truncate"
          >
            {title}
          </h2>
          <button
            onClick={handleClose}
            className="ui-icon-muted p-2 min-h-[44px] min-w-[44px] rounded-lg flex-shrink-0"
            aria-label="Close drawer"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6"
        >
          {children}
        </div>

        {/* Footer with Edit button */}
        {onEdit && (
          <div className="border-t border-gray-200 p-4 sm:p-6 flex-shrink-0">
            <button
              onClick={onEdit}
              className="w-full px-4 py-3 min-h-[44px] bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
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
