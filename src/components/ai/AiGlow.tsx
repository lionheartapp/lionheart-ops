'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface AiGlowProps {
  /** Whether the glow is active (listening or thinking) */
  active: boolean
  /** Shape of the glow — 'circle' for the button, 'rounded' for the panel */
  shape: 'circle' | 'rounded'
  /** Additional CSS classes */
  className?: string
  children: React.ReactNode
}

/**
 * Apple Intelligence-style gradient glow wrapper.
 *
 * When active, renders an animated rainbow gradient border that rotates
 * and pulses, signaling "AI is listening / thinking."
 *
 * The gradient uses the same palette as Apple Intelligence:
 * purple → blue → teal → green → orange → pink → purple
 */
export default function AiGlow({ active, shape, className = '', children }: AiGlowProps) {
  const borderRadius = shape === 'circle' ? '9999px' : '1rem'

  return (
    <div className={`relative ${className}`}>
      {/* Glow layers — rendered behind children */}
      <AnimatePresence>
        {active && (
          <>
            {/* Outer blur glow */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                borderRadius,
                background:
                  'conic-gradient(from var(--glow-angle, 0deg), #7c5bf1, #5b8af1, #4ecdc4, #44d986, #f5a623, #e84393, #7c5bf1)',
                padding: shape === 'circle' ? '4px' : '3px',
                filter: 'blur(12px)',
                opacity: 0.7,
              }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{
                opacity: [0.5, 0.8, 0.5],
                scale: [1, 1.04, 1],
              }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{
                opacity: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                scale: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
              }}
            />

            {/* Sharp gradient border */}
            <motion.div
              className="absolute inset-0 pointer-events-none ai-glow-spin"
              style={{
                borderRadius,
                background:
                  'conic-gradient(from var(--glow-angle, 0deg), #7c5bf1, #5b8af1, #4ecdc4, #44d986, #f5a623, #e84393, #7c5bf1)',
                padding: shape === 'circle' ? '3px' : '2px',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {/* Inner mask — creates the border effect */}
              <div
                className="w-full h-full"
                style={{
                  borderRadius:
                    shape === 'circle'
                      ? '9999px'
                      : 'calc(1rem - 2px)',
                  background: shape === 'circle' ? '#3b82f6' : '#ffffff',
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Actual content */}
      <div className="relative z-10">{children}</div>

      {/* CSS for the rotation animation using @property */}
      <style jsx global>{`
        @property --glow-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }

        .ai-glow-spin {
          animation: glowSpin 3s linear infinite;
        }

        @keyframes glowSpin {
          from {
            --glow-angle: 0deg;
          }
          to {
            --glow-angle: 360deg;
          }
        }
      `}</style>
    </div>
  )
}
