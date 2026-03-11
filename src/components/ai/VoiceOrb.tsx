'use client'

import { useRef, useEffect, useState } from 'react'
import { Square } from 'lucide-react'

interface VoiceOrbProps {
  /** Audio level 0–1, updated at ~60fps */
  audioLevel: number
  /** Diameter in pixels (default 44) */
  size?: number
  /** Click handler — typically stops listening */
  onClick?: () => void
  className?: string
}

/**
 * Audio-reactive version of Leo's AnimatedOrb for voice input.
 *
 * Uses the exact same CSS layer approach as AnimatedOrb:
 * breathing aura, morphing glass base, rotating iridescent rings,
 * edge shadows — but animation speeds and scale respond to audioLevel.
 *
 * A small stop icon sits in the center.
 */
export default function VoiceOrb({
  audioLevel,
  size = 44,
  onClick,
  className = '',
}: VoiceOrbProps) {
  // Smooth the audio level for organic response
  const [smoothLevel, setSmoothLevel] = useState(0)
  const rafRef = useRef<number>(0)
  const smoothRef = useRef(0)

  useEffect(() => {
    const tick = () => {
      smoothRef.current += (audioLevel - smoothRef.current) * 0.12
      setSmoothLevel(smoothRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [audioLevel])

  const level = smoothLevel

  // Audio-reactive config — maps level to animation speeds
  // At silence: gentle idle-like breathing. At loud speech: intense fast animation
  const breathe = `${2.5 - level * 1.5}s`       // 2.5s → 1s
  const breatheSlow = `${3.0 - level * 1.5}s`   // 3.0s → 1.5s
  const spin = `${4.0 - level * 2.5}s`           // 4.0s → 1.5s
  const spinReverse = `${6.0 - level * 3.0}s`   // 6.0s → 3.0s
  const morph = `${3.5 - level * 2.0}s`          // 3.5s → 1.5s

  // Audio-reactive scale: orb grows slightly with volume
  const scale = 1 + level * 0.15
  const auraIntensity = 1.3 + level * 0.7 // 1.3 → 2.0

  const auraSize = size * 1.5

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center justify-center cursor-pointer active:scale-95 transition-transform ${className}`}
      style={{ width: auraSize, height: auraSize }}
      aria-label="Stop listening"
      title="Stop listening"
    >
      {/* Reuse the same keyframes as AnimatedOrb */}
      <style>{`
        @keyframes voiceOrbRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes voiceBreathe {
          0%, 100% { transform: scale(0.8); opacity: 0.25; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }
        @keyframes voiceBreatheSlow {
          0%, 100% { transform: scale(0.85); opacity: 0.2; }
          50% { transform: scale(1.15); opacity: 0.6; }
        }
        @keyframes voiceMorph {
          0%, 100% {
            border-radius: 60% 40% 55% 45% / 55% 45% 50% 50%;
            transform: scale(0.95) rotate(0deg);
          }
          20% {
            border-radius: 45% 55% 40% 60% / 60% 40% 55% 45%;
            transform: scale(1.08) rotate(3deg);
          }
          40% {
            border-radius: 55% 45% 60% 40% / 45% 55% 45% 55%;
            transform: scale(0.90) rotate(-2deg);
          }
          60% {
            border-radius: 40% 60% 45% 55% / 50% 50% 60% 40%;
            transform: scale(1.06) rotate(2deg);
          }
          80% {
            border-radius: 50% 50% 55% 45% / 40% 60% 45% 55%;
            transform: scale(0.93) rotate(-3deg);
          }
        }
        @keyframes voiceMorphRing {
          0%, 100% { border-radius: 60% 40% 55% 45% / 55% 45% 50% 50%; }
          20% { border-radius: 45% 55% 40% 60% / 60% 40% 55% 45%; }
          40% { border-radius: 55% 45% 60% 40% / 45% 55% 45% 55%; }
          60% { border-radius: 40% 60% 45% 55% / 50% 50% 60% 40%; }
          80% { border-radius: 50% 50% 55% 45% / 40% 60% 45% 55%; }
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
          transform: `scale(${scale})`,
          transition: 'transform 0.15s ease-out',
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
              rgba(160, 150, 255, ${0.4 * auraIntensity}) 15%,
              rgba(140, 170, 255, ${0.3 * auraIntensity}) 35%,
              rgba(170, 150, 255, ${0.15 * auraIntensity}) 50%,
              rgba(130, 160, 255, ${0.05 * auraIntensity}) 65%,
              transparent 75%
            )`,
            filter: 'blur(5px)',
            animation: `voiceBreathe ${breathe} ease-in-out infinite`,
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
              rgba(140, 160, 255, ${0.35 * auraIntensity}) 20%,
              rgba(170, 140, 255, ${0.25 * auraIntensity}) 40%,
              rgba(150, 170, 255, ${0.1 * auraIntensity}) 55%,
              transparent 70%
            )`,
            filter: 'blur(3px)',
            animation: `voiceBreatheSlow ${breatheSlow} ease-in-out infinite 0.3s`,
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
              animation: `voiceMorph ${morph} ease-in-out infinite`,
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
                rgba(140, 160, 255, 0.12) 80%,
                rgba(120, 140, 240, 0.2) 100%
              )`,
              animation: `voiceMorphRing ${morph} ease-in-out infinite`,
            }}
          />

          {/* Primary rotating + morphing iridescent ring */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              animation: `voiceOrbRotate ${spin} linear infinite, voiceMorphRing ${morph} ease-in-out infinite`,
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
                mask: `radial-gradient(circle at center, transparent 60%, black 70%, black 90%, transparent 100%)`,
                WebkitMask: `radial-gradient(circle at center, transparent 60%, black 70%, black 90%, transparent 100%)`,
              }}
            />
          </div>

          {/* Secondary counter-rotating + morphing ring */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              animation: `voiceOrbRotate ${spinReverse} linear infinite reverse, voiceMorphRing ${morph} ease-in-out infinite`,
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
                mask: `radial-gradient(circle at center, transparent 53%, black 66%, black 86%, transparent 100%)`,
                WebkitMask: `radial-gradient(circle at center, transparent 53%, black 66%, black 86%, transparent 100%)`,
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
                inset 0 0 ${size * 0.1}px rgba(140, 160, 255, 0.35),
                inset -${size * 0.03}px -${size * 0.03}px ${size * 0.1}px rgba(160, 140, 255, 0.25),
                0 0 ${size * 0.08}px rgba(160, 180, 255, 0.4)
              `,
              animation: `voiceMorphRing ${morph} ease-in-out infinite`,
            }}
          />

          {/* Stop icon centered */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
          >
            <Square
              style={{
                width: size * 0.26,
                height: size * 0.26,
                color: 'rgba(99, 102, 241, 0.7)',
                fill: 'rgba(99, 102, 241, 0.6)',
              }}
            />
          </div>
        </div>
      </div>
    </button>
  )
}
