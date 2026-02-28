'use client'

import { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface AnimatedFormFieldProps {
  children: ReactNode
  highlight?: boolean
}

const fieldVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } },
}

export default function AnimatedFormField({ children, highlight }: AnimatedFormFieldProps) {
  return (
    <motion.div
      variants={fieldVariants}
      className={`transition-shadow duration-300 rounded-lg ${
        highlight ? 'shadow-[0_0_0_4px_rgba(37,99,235,0.15)]' : ''
      }`}
    >
      {children}
    </motion.div>
  )
}
