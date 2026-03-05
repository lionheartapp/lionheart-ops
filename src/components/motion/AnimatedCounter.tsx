'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'

interface AnimatedCounterProps {
  value: number
  duration?: number
  className?: string
}

/**
 * Animated number counter that rolls up from 0 to the target value.
 * Uses Framer Motion's spring animation for a natural feel.
 */
export default function AnimatedCounter({ value, duration = 0.8, className }: AnimatedCounterProps) {
  const motionValue = useMotionValue(0)
  const rounded = useTransform(motionValue, (latest) => Math.round(latest))
  const [display, setDisplay] = useState(0)
  const prevValue = useRef(0)

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration,
      ease: [0.25, 0.1, 0.25, 1],
    })

    const unsubscribe = rounded.on('change', (v) => setDisplay(v))
    prevValue.current = value

    return () => {
      controls.stop()
      unsubscribe()
    }
  }, [value, duration, motionValue, rounded])

  return (
    <motion.span className={className}>
      {display}
    </motion.span>
  )
}
