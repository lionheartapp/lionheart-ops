'use client'

import { motion } from 'framer-motion'
import type { MotionValue } from 'framer-motion'

interface TabIndicatorProps {
  style: {
    left: MotionValue<number>
    width: MotionValue<number>
    opacity: MotionValue<number>
    background: string
    boxShadow: string
  }
}

export default function TabIndicator({ style }: TabIndicatorProps) {
  return (
    <motion.div
      className="absolute bottom-0 h-0.5 rounded-full pointer-events-none"
      style={style}
    />
  )
}
