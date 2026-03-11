'use client'

import { motion } from 'framer-motion'

export type OrbState = 'idle' | 'listening' | 'thinking' | 'streaming'

interface AnimatedOrbProps {
  state?: OrbState
  /** Diameter in pixels (default 80) */
  size?: number
  className?: string
}

/**
 * Animated glass orb for Leo's empty-state and AI activity visualization.
 *
 * Three visual layers:
 * 1. Outer glow — soft blurred rainbow ring
 * 2. Gradient sphere — conic gradient body with 3D radial highlights
 * 3. Inner highlight — glass refraction overlay
 *
 * Each layer animates differently per state (idle → listening → thinking → streaming).
 * Uses CSS `@property --orb-angle` for gradient rotation, Framer Motion for scale/opacity.
 */
export default function AnimatedOrb({ state = 'idle', size = 80, className = '' }: AnimatedOrbProps) {
  // Animation config per state
  const config = STATE_CONFIG[state]

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* Layer 1: Outer glow */}
      <motion.div
        className="absolute inset-0 rounded-full orb-spin"
        style={{
          background:
            'conic-gradient(from var(--orb-angle, 0deg), #7c5bf1, #5b8af1, #4ecdc4, #44d986, #f5a623, #e84393, #7c5bf1)',
          filter: `blur(${size * 0.18}px)`,
          animationDuration: config.spinDuration,
        }}
        animate={{
          opacity: config.glowOpacity,
          scale: config.glowScale,
        }}
        transition={{
          opacity: { duration: config.pulseDuration, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' },
          scale: { duration: config.pulseDuration, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' },
        }}
      />

      {/* Layer 2: Gradient sphere body */}
      <motion.div
        className="absolute inset-[6%] rounded-full orb-spin"
        style={{
          background: `
            radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35) 0%, transparent 50%),
            radial-gradient(circle at 65% 70%, rgba(124,91,241,0.25) 0%, transparent 50%),
            conic-gradient(from var(--orb-angle, 0deg), #7c5bf1, #5b8af1, #4ecdc4, #44d986, #f5a623, #e84393, #7c5bf1)
          `,
          boxShadow: `
            inset 0 -${size * 0.06}px ${size * 0.15}px rgba(0,0,0,0.15),
            inset 0 ${size * 0.04}px ${size * 0.1}px rgba(255,255,255,0.25),
            0 0 ${size * 0.2}px rgba(99,102,241,0.15)
          `,
          animationDuration: config.spinDuration,
        }}
        animate={{ scale: config.bodyScale }}
        transition={{
          scale: {
            duration: config.scaleDuration,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut',
          },
        }}
      />

      {/* Layer 3: Glass highlight / refraction */}
      <div
        className="absolute inset-[6%] rounded-full pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 38% 28%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.08) 50%, transparent 70%),
            radial-gradient(ellipse 40% 30% at 60% 75%, rgba(255,255,255,0.1) 0%, transparent 60%)
          `,
          mixBlendMode: 'overlay',
        }}
      />

      {/* CSS for orb-specific gradient rotation */}
      <style jsx global>{`
        @property --orb-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }

        .orb-spin {
          animation: orbSpin 4s linear infinite;
        }

        @keyframes orbSpin {
          from { --orb-angle: 0deg; }
          to { --orb-angle: 360deg; }
        }
      `}</style>
    </div>
  )
}

/** Per-state animation configuration */
const STATE_CONFIG = {
  idle: {
    spinDuration: '6s',
    glowOpacity: [0.25, 0.4] as [number, number],
    glowScale: [1, 1.06] as [number, number],
    bodyScale: [1, 1.02] as [number, number],
    pulseDuration: 3,
    scaleDuration: 4,
  },
  listening: {
    spinDuration: '3.5s',
    glowOpacity: [0.45, 0.75] as [number, number],
    glowScale: [1, 1.12] as [number, number],
    bodyScale: [1, 1.06] as [number, number],
    pulseDuration: 1.5,
    scaleDuration: 1.8,
  },
  thinking: {
    spinDuration: '2.5s',
    glowOpacity: [0.4, 0.65] as [number, number],
    glowScale: [1, 1.1] as [number, number],
    bodyScale: [1, 1.04] as [number, number],
    pulseDuration: 2,
    scaleDuration: 2.2,
  },
  streaming: {
    spinDuration: '1.8s',
    glowOpacity: [0.5, 0.85] as [number, number],
    glowScale: [1, 1.14] as [number, number],
    bodyScale: [1, 1.05] as [number, number],
    pulseDuration: 1,
    scaleDuration: 1.2,
  },
} as const
