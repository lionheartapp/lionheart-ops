'use client'

import { useEffect, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { X } from 'lucide-react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  /** Maximum height as viewport percentage (0-1). Default: 0.85 */
  maxHeight?: number
}

export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  maxHeight = 0.85,
}: BottomSheetProps) {
  const dragControls = useDragControls()

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Escape to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleKeyDown])

  if (typeof window === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-lightbox bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="fixed inset-x-0 bottom-0 z-lightbox flex flex-col rounded-t-2xl shadow-2xl"
            style={{
              maxHeight: `${maxHeight * 100}vh`,
              background: '#fdfcfb',
              paddingBottom: 'var(--safe-area-bottom)',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0, transition: { type: 'spring', stiffness: 500, damping: 35 } }}
            exit={{ y: '100%', transition: { duration: 0.15, ease: 'easeIn' } }}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0 }}
            dragElastic={0.1}
            onDragEnd={(_, info) => {
              // Dismiss on significant drag or high velocity
              if (info.offset.y > 100 || info.velocity.y > 300) {
                onClose()
              }
            }}
            role="dialog"
            aria-modal="true"
            aria-label={title || 'Bottom sheet'}
          >
            {/* Drag handle */}
            <div
              className="flex items-center justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>

            {/* Header */}
            {title && (
              <div className="flex items-center justify-between px-5 pb-3 border-b" style={{ borderColor: 'rgba(17, 15, 10, 0.06)' }}>
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="border-t px-5 py-4" style={{ borderColor: 'rgba(17, 15, 10, 0.06)', background: '#fdfcfb' }}>
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
