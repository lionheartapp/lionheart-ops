'use client'

import { ReactNode, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useFocusTrap } from '@/lib/hooks/useFocusTrap'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  children?: ReactNode
  requireText?: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
  isLoading?: boolean
  loadingText?: string
  confirmDisabled?: boolean
  extraAction?: {
    label: string
    onClick: () => void
    disabled?: boolean
    className?: string
  }
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  children,
  requireText,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isLoading = false,
  loadingText = 'Working...',
  confirmDisabled = false,
  extraAction,
}: ConfirmDialogProps) {
  const [confirmInput, setConfirmInput] = useState('')
  const focusTrapRef = useFocusTrap(isOpen)

  useEffect(() => {
    if (isOpen) {
      setConfirmInput('')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const variantStyles = {
    danger: {
      icon: 'bg-red-100 text-red-600',
      button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    },
    warning: {
      icon: 'bg-yellow-100 text-yellow-600',
      button: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
    },
    info: {
      icon: 'bg-primary-100 text-primary-600',
      button: 'bg-primary-600 hover:bg-primary-700 focus:ring-primary-500',
    },
  }

  const styles = variantStyles[variant]
  const requiresConfirmation = Boolean(requireText)
  const normalizedRequire = requireText?.trim().toLowerCase() || ''
  const normalizedInput = confirmInput.trim().toLowerCase()
  const canConfirm =
    (!requiresConfirmation || normalizedInput === normalizedRequire) && !confirmDisabled

  return (
    <div className="fixed inset-0 z-modal overflow-y-auto">
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <motion.div
          ref={focusTrapRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          className="relative w-full max-w-xl transform overflow-hidden rounded-2xl ui-glass-overlay"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 ui-icon-muted p-2 min-h-[44px] min-w-[44px] rounded-lg"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>

          {/* Content */}
          <div className="p-8">
            {/* Title */}
            <div>
              <h3 id="confirm-dialog-title" className="text-2xl font-semibold text-gray-900">
                {title}
              </h3>
              <div className="mt-4 h-px w-full bg-gray-200" />
              <p className="mt-4 text-base text-gray-700">
                {message}
              </p>
            </div>

            {children}

            {requiresConfirmation && (
              <div className="mt-6">
                <p className="text-sm text-gray-500">
                  To confirm this, type "{requireText}"
                </p>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    value={confirmInput}
                    onChange={(event) => setConfirmInput(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    placeholder={requireText}
                  />
                  <button
                    type="button"
                    onClick={onConfirm}
                    disabled={isLoading || !canConfirm}
                    className={`w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition ${styles.button}`}
                  >
                    {isLoading ? loadingText : confirmText}
                  </button>
                </div>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isLoading}
                    className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {cancelText}
                  </button>
                </div>
              </div>
            )}

            {!requiresConfirmation && (
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 ui-btn-md ui-btn-outline rounded-lg"
                >
                  {cancelText}
                </button>
                {extraAction && (
                  <button
                    type="button"
                    onClick={extraAction.onClick}
                    disabled={isLoading || extraAction.disabled}
                    className={
                      extraAction.className ||
                      'flex-1 ui-btn-md ui-btn-ghost rounded-lg bg-gray-100 hover:bg-gray-200'
                    }
                  >
                    {extraAction.label}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isLoading}
                  className={`flex-1 ui-btn-md rounded-lg text-white ${styles.button}`}
                >
                  {isLoading ? loadingText : confirmText}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
