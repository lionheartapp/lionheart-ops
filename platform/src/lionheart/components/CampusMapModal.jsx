import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { PLATFORM_URL } from '../services/platformApi'

export default function CampusMapModal({ isOpen, onClose }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-4 sm:inset-[5%] z-[70] flex flex-col rounded-2xl bg-zinc-50 dark:bg-zinc-900 shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between shrink-0 p-4 border-b border-zinc-200 dark:border-zinc-700">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                Campus Map
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <iframe
                src={`${PLATFORM_URL}/campus`}
                title="Campus Map"
                className="w-full h-full border-0"
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
