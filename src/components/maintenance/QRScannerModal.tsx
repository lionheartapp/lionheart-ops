'use client'

import dynamic from 'next/dynamic'
import { X, QrCode } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { scaleIn } from '@/lib/animations'

// ─── Critical: SSR=false to avoid window/navigator crash ─────────────────────

const QRScannerInner = dynamic(() => import('./QRScannerInner'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 bg-slate-100 rounded-xl">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Starting camera...</p>
      </div>
    </div>
  ),
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface QRScannerModalProps {
  isOpen: boolean
  onClose: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function QRScannerModal({ isOpen, onClose }: QRScannerModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.2 }}
            className="ui-glass-overlay rounded-2xl p-5 w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                  <QrCode className="w-4 h-4 text-primary-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Scan Asset QR</h3>
                  <p className="text-xs text-slate-400">Point camera at equipment label</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Scanner — only rendered when open (dynamic import handles SSR) */}
            <QRScannerInner onClose={onClose} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
