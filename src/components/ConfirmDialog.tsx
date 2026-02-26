'use client'

import { ReactNode, useEffect, useState } from 'react'
import { X } from 'lucide-react'

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

  useEffect(() => {
    if (isOpen) {
      setConfirmInput('')
    }
  }, [isOpen])

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
      icon: 'bg-blue-100 text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    },
  }

  const styles = variantStyles[variant]
  const requiresConfirmation = Boolean(requireText)
  const normalizedRequire = requireText?.trim().toLowerCase() || ''
  const normalizedInput = confirmInput.trim().toLowerCase()
  const canConfirm =
    (!requiresConfirmation || normalizedInput === normalizedRequire) && !confirmDisabled

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-xl transform overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl transition-all">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="p-8">
            {/* Title */}
            <div>
              <h3 className="text-2xl font-semibold text-gray-900">
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
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
                      'flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition'
                    }
                  >
                    {extraAction.label}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isLoading}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition ${styles.button}`}
                >
                  {isLoading ? loadingText : confirmText}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
