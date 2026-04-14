'use client'

import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { usePathname } from 'next/navigation'

interface MobilePageTransitionProps {
  children: ReactNode
}

/**
 * Lightweight page transition — fast fade only.
 * No AnimatePresence (avoids blocking exit animations that cause perceived lag).
 * Tab switches and navigation both get a quick 120ms fade-in.
 */
export default function MobilePageTransition({ children }: MobilePageTransitionProps) {
  const pathname = usePathname()

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      className="flex flex-col min-h-full"
    >
      {children}
    </motion.div>
  )
}
