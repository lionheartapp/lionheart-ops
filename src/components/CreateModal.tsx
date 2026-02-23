'use client'

import { ReactNode, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface CreateModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export default function CreateModal({ isOpen, onClose, title, children }: CreateModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
      // Focus trap - focus first interactive element
      setTimeout(() => {
        const firstInput = contentRef.current?.querySelector(
          'input, textarea, select, button, [tabindex]'
        ) as HTMLElement
        firstInput?.focus()
      }, 100)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="presentation"
      aria-hidden={!isOpen}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
        role="presentation"
      />

      {/* Modal Container - Full width bottom slide */}
      <div
        ref={modalRef}
        className={`fixed inset-x-0 bottom-0 max-h-[90vh] bg-white rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 z-50 ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        role="dialog"
        aria-labelledby="modal-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
          <h2
            id="modal-title"
            className="text-lg sm:text-xl font-bold text-gray-900"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 min-h-[44px] min-w-[44px] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8"
        >
          {children}
        </div>
      </div>
    </div>
  )
}
