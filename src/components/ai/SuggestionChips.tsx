'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface SuggestionChipsProps {
  items: string[]
  onSelect: (item: string) => void
}

/**
 * Horizontal scrollable row of suggestion chips shown after a data response.
 * Framer Motion fade-in entrance with AnimatePresence exit animation.
 */
export default function SuggestionChips({ items, onSelect }: SuggestionChipsProps) {
  return (
    <AnimatePresence>
      {items.length > 0 && (
        <motion.div
          className="flex gap-2 overflow-x-auto pb-1 mt-2 px-1"
          style={{ scrollbarWidth: 'none' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {items.map((item) => (
            <button
              key={item}
              onClick={() => onSelect(item)}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors duration-200 cursor-pointer whitespace-nowrap active:scale-[0.97]"
              aria-label={item}
            >
              {item}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
