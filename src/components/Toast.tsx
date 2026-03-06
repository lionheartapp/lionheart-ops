'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { toastSlideIn } from '@/lib/animations'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastOptions {
  duration?: number
  action?: ToastAction
}

interface Toast {
  id: string
  message: string
  variant: ToastVariant
  duration?: number
  action?: ToastAction
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant, options?: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

const ICONS: Record<ToastVariant, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const STYLES: Record<ToastVariant, string> = {
  success: 'bg-white/80 backdrop-blur-md border-green-200/30 text-green-800',
  error: 'bg-white/80 backdrop-blur-md border-red-200/30 text-red-800',
  warning: 'bg-white/80 backdrop-blur-md border-yellow-200/30 text-yellow-800',
  info: 'bg-white/80 backdrop-blur-md border-gray-200/30 text-gray-800',
}

const ICON_STYLES: Record<ToastVariant, string> = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-gray-500',
}

const DEFAULT_DURATION = 4000

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const Icon = ICONS[t.variant]

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(t.id), t.duration || DEFAULT_DURATION)
    return () => clearTimeout(timer)
  }, [t.id, t.duration, onDismiss])

  return (
    <motion.div
      layout
      variants={toastSlideIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-medium ${STYLES[t.variant]}`}
      role="status"
      aria-live="polite"
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${ICON_STYLES[t.variant]}`} />
      <p className="text-sm font-medium flex-1">{t.message}</p>
      {t.action && (
        <button
          onClick={() => {
            t.action!.onClick()
            onDismiss(t.id)
          }}
          className="text-sm font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
          {t.action.label}
        </button>
      )}
      <button
        onClick={() => onDismiss(t.id)}
        className="p-0.5 rounded-md hover:bg-black/5 transition-colors flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 opacity-50" />
      </button>
    </motion.div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, variant: ToastVariant = 'success', options?: ToastOptions) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setToasts((prev) => [...prev, { id, message, variant, duration: options?.duration, action: options?.action }])
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-toast flex flex-col gap-2 max-w-sm" aria-label="Notifications">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
