'use client'

export type OrbState = 'idle' | 'listening' | 'thinking' | 'streaming'

interface AnimatedOrbProps {
  state?: OrbState
  /** Diameter in pixels (default 80) */
  size?: number
  className?: string
}

/** Animation speed multipliers per state */
const STATE_CONFIG = {
  idle: { breathe: '3.5s', breatheSlow: '4.5s', spin: '6s', spinReverse: '10s', morph: '6s', auraIntensity: 1 },
  listening: { breathe: '2s', breatheSlow: '2.5s', spin: '3s', spinReverse: '5s', morph: '3.5s', auraIntensity: 1.4 },
  thinking: { breathe: '1.5s', breatheSlow: '2s', spin: '2.5s', spinReverse: '4s', morph: '2.5s', auraIntensity: 1.6 },
  streaming: { breathe: '1.2s', breatheSlow: '1.8s', spin: '1.8s', spinReverse: '3s', morph: '2s', auraIntensity: 1.8 },
} as const

/**
 * Iridescent glass orb for Leo's empty-state and AI activity visualization.
 *
 * Layers:
 * 1. Breathing aura (double-layer radial glow)
 * 2. Morphing white glass sphere base
 * 3. Rotating + morphing iridescent ring (conic gradient, masked to ring shape)
 * 4. Counter-rotating secondary ring for depth
 * 5. Edge definition (inset box-shadow)
 *
 * Animation speed increases with state: idle → listening → thinking → streaming.
 * Shape organically morphs between rounded blob forms.
 */
export default function AnimatedOrb({ state = 'idle', size = 80, className = '' }: AnimatedOrbProps) {
  const config = STATE_CONFIG[state]
  const auraSize = size * 1.4

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <style>{`
        @keyframes leoOrbRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes leoBreathe {
          0%, 100% {
            transform: scale(0.75);
            opacity: 0.2;
          }
          50% {
            transform: scale(1.15);
            opacity: 0.7;
          }
        }

        @keyframes leoBreatheSlow {
          0%, 100% {
            transform: scale(0.8);
            opacity: 0.15;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.55;
          }
        }

        @keyframes leoMorph {
          0%, 100% {
            border-radius: 60% 40% 55% 45% / 55% 45% 50% 50%;
            transform: scale(0.95) rotate(0deg);
          }
          20% {
            border-radius: 45% 55% 40% 60% / 60% 40% 55% 45%;
            transform: scale(1.05) rotate(2deg);
          }
          40% {
            border-radius: 55% 45% 60% 40% / 45% 55% 45% 55%;
            transform: scale(0.92) rotate(-1deg);
          }
          60% {
            border-radius: 40% 60% 45% 55% / 50% 50% 60% 40%;
            transform: scale(1.03) rotate(1deg);
          }
          80% {
            border-radius: 50% 50% 55% 45% / 40% 60% 45% 55%;
            transform: scale(0.97) rotate(-2deg);
          }
        }

        @keyframes leoMorphRing {
          0%, 100% {
            border-radius: 60% 40% 55% 45% / 55% 45% 50% 50%;
          }
          20% {
            border-radius: 45% 55% 40% 60% / 60% 40% 55% 45%;
          }
          40% {
            border-radius: 55% 45% 60% 40% / 45% 55% 45% 55%;
          }
          60% {
            border-radius: 40% 60% 45% 55% / 50% 50% 60% 40%;
          }
          80% {
            border-radius: 50% 50% 55% 45% / 40% 60% 45% 55%;
          }
        }
      `}</style>

      <div
        style={{
          position: 'relative',
          width: auraSize,
          height: auraSize,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Breathing aura — outer */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: `radial-gradient(
              circle at center,
              rgba(160, 150, 255, ${0.4 * config.auraIntensity}) 15%,
              rgba(140, 170, 255, ${0.3 * config.auraIntensity}) 35%,
              rgba(170, 150, 255, ${0.15 * config.auraIntensity}) 50%,
              rgba(130, 160, 255, ${0.05 * config.auraIntensity}) 65%,
              transparent 75%
            )`,
            filter: 'blur(6px)',
            animation: `leoBreathe ${config.breathe} ease-in-out infinite`,
          }}
        />

        {/* Breathing aura — inner */}
        <div
          style={{
            position: 'absolute',
            inset: '10%',
            borderRadius: '50%',
            background: `radial-gradient(
              circle at center,
              rgba(140, 160, 255, ${0.35 * config.auraIntensity}) 20%,
              rgba(170, 140, 255, ${0.25 * config.auraIntensity}) 40%,
              rgba(150, 170, 255, ${0.1 * config.auraIntensity}) 55%,
              transparent 70%
            )`,
            filter: 'blur(4px)',
            animation: `leoBreatheSlow ${config.breatheSlow} ease-in-out infinite 0.3s`,
          }}
        />

        {/* Main orb container */}
        <div
          style={{
            position: 'relative',
            width: size,
            height: size,
          }}
        >
          {/* White glass base — morphing */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: `radial-gradient(
                ellipse 85% 85% at 45% 45%,
                rgba(255, 255, 255, 0.98) 0%,
                rgba(250, 252, 255, 0.95) 40%,
                rgba(245, 248, 255, 0.9) 70%,
                rgba(240, 245, 252, 0.85) 100%
              )`,
              animation: `leoMorph ${config.morph} ease-in-out infinite`,
            }}
          />

          {/* Subtle bottom shadow — morphing */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: `radial-gradient(
                ellipse 90% 90% at 60% 60%,
                transparent 50%,
                rgba(140, 160, 255, 0.1) 80%,
                rgba(120, 140, 240, 0.18) 100%
              )`,
              animation: `leoMorphRing ${config.morph} ease-in-out infinite`,
            }}
          />

          {/* Primary rotating + morphing iridescent ring */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              animation: `leoOrbRotate ${config.spin} linear infinite, leoMorphRing ${config.morph} ease-in-out infinite`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 'inherit',
                background: `conic-gradient(
                  from 0deg,
                  rgba(120, 100, 220, 0.85) 0deg,
                  rgba(160, 120, 255, 0.75) 45deg,
                  rgba(100, 180, 255, 0.65) 90deg,
                  transparent 135deg,
                  transparent 200deg,
                  rgba(80, 150, 255, 0.55) 240deg,
                  rgba(140, 100, 240, 0.75) 280deg,
                  rgba(180, 120, 255, 0.85) 320deg,
                  rgba(120, 100, 220, 0.85) 360deg
                )`,
                mask: `radial-gradient(circle at center, transparent 62%, black 72%, black 92%, transparent 100%)`,
                WebkitMask: `radial-gradient(circle at center, transparent 62%, black 72%, black 92%, transparent 100%)`,
              }}
            />
          </div>

          {/* Secondary counter-rotating + morphing ring */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              animation: `leoOrbRotate ${config.spinReverse} linear infinite reverse, leoMorphRing ${config.morph} ease-in-out infinite`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 'inherit',
                background: `conic-gradient(
                  from 180deg,
                  transparent 0deg,
                  rgba(100, 200, 255, 0.45) 60deg,
                  rgba(180, 140, 255, 0.55) 120deg,
                  transparent 180deg,
                  transparent 240deg,
                  rgba(140, 180, 255, 0.45) 300deg,
                  transparent 360deg
                )`,
                mask: `radial-gradient(circle at center, transparent 55%, black 68%, black 88%, transparent 100%)`,
                WebkitMask: `radial-gradient(circle at center, transparent 55%, black 68%, black 88%, transparent 100%)`,
              }}
            />
          </div>

          {/* Edge definition — morphing */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              boxShadow: `
                inset 0 0 ${size * 0.1}px rgba(140, 160, 255, 0.3),
                inset -${size * 0.03}px -${size * 0.03}px ${size * 0.1}px rgba(160, 140, 255, 0.2),
                0 0 ${size * 0.06}px rgba(160, 180, 255, 0.35)
              `,
              animation: `leoMorphRing ${config.morph} ease-in-out infinite`,
            }}
          />
        </div>
      </div>
    </div>
  )
}
