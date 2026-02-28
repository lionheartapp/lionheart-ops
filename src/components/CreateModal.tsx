'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

interface CreateModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  requestType?: string | null
}

export default function CreateModal({ isOpen, onClose, title, children, requestType }: CreateModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [shouldShow, setShouldShow] = useState(false)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      setIsAnimating(true)
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
      
      // Trigger animation after component mounts
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setShouldShow(true)
        })
      })
      
      // Focus trap - focus first interactive element
      setTimeout(() => {
        const firstInput = contentRef.current?.querySelector(
          'input, textarea, select, button, [tabindex]'
        ) as HTMLElement
        firstInput?.focus()
      }, 100)
    } else {
      setShouldShow(false)
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen && !isAnimating) return null

  const handleTransitionEnd = () => {
    if (!isOpen) {
      setIsAnimating(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-modal overflow-hidden"
      role="presentation"
      aria-hidden={!isOpen}
    >
      {/* Overlay with backdrop blur */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 cursor-pointer ${
          shouldShow ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        role="presentation"
      />

      {/* Modal Container - Full width bottom slide up to 80px from top */}
      <div
        ref={modalRef}
        className={`fixed inset-x-0 bottom-0 top-20 bg-white rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out z-modal ${
          shouldShow ? 'translate-y-0' : 'translate-y-full'
        }`}
        onTransitionEnd={handleTransitionEnd}
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
            className="ui-icon-muted p-2 min-h-[44px] min-w-[44px] rounded-lg"
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
