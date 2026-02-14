import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

/**
 * Full-page drawer modal that slides up from the bottom (same pattern as Create Event).
 * Use for Create Facilities Request, Create IT Request, etc.
 * Rendered via portal so backdrop covers entire viewport including TopBar.
 */
export default function DrawerModal({ isOpen, onClose, title, children }) {
  if (!isOpen) return null

  return createPortal(
    <AnimatePresence>
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60]"
        />
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="fixed top-0 inset-x-0 h-20 z-[70] flex items-center justify-end px-6 pointer-events-none"
        >
          <button
            onClick={onClose}
            className="pointer-events-auto p-2 rounded-xl bg-zinc-900/80 text-zinc-100 hover:bg-zinc-900 transition-colors shadow-lg shadow-black/30"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </motion.div>
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed inset-x-0 bottom-0 top-0 sm:top-20 z-[70] flex flex-col rounded-t-3xl bg-zinc-50 dark:bg-zinc-900 shadow-2xl border border-b-0 border-zinc-200 dark:border-zinc-800 overflow-hidden"
        >
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0 sm:hidden">
            <div className="w-12 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" aria-hidden />
          </div>
          <div className="flex-shrink-0 px-6 lg:px-8 py-4 border-b border-zinc-200 dark:border-zinc-700">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-6 lg:p-8">
            <div className="max-w-[800px] mx-auto">
              {children}
            </div>
          </div>
        </motion.div>
      </>
    </AnimatePresence>,
    document.body
  )
}
