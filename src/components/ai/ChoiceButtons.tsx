'use client'

import { motion } from 'framer-motion'
import { staggerContainer, listItem } from '@/lib/animations'

interface ChoiceButtonsProps {
  options: string[]
  onSelect: (option: string) => void
  disabled?: boolean
}

/**
 * Tappable pill buttons rendered below an assistant message when Leo presents choices.
 * Framer Motion stagger entrance. Aurora gradient on hover.
 * Clears automatically when user selects or sends a new message.
 */
export default function ChoiceButtons({ options, onSelect, disabled = false }: ChoiceButtonsProps) {
  return (
    <motion.div
      className="flex flex-wrap gap-2 mt-2 px-1"
      variants={staggerContainer(0.06)}
      initial="hidden"
      animate="visible"
    >
      {options.map((option) => (
        <motion.button
          key={option}
          variants={listItem}
          onClick={() => !disabled && onSelect(option)}
          disabled={disabled}
          className={[
            'min-h-[44px] px-4 py-2 text-sm font-medium rounded-full border',
            'transition-colors duration-200 cursor-pointer active:scale-[0.97]',
            disabled
              ? 'bg-blue-50 text-blue-400 border-blue-100 opacity-40 cursor-not-allowed'
              : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-gradient-to-r hover:from-blue-500 hover:to-indigo-500 hover:text-white hover:border-transparent',
          ].join(' ')}
          aria-label={option}
        >
          {option}
        </motion.button>
      ))}
    </motion.div>
  )
}
