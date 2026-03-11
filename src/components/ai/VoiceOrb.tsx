'use client'

import { useRef, useEffect, useMemo } from 'react'
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
 * Audio-reactive orb for voice input visualization.
 *
 * The orb morphs and warps in response to audio amplitude:
 * - At silence (level ~0): gentle organic breathing
 * - At speech (level 0.2–0.8): dynamic warping/bulging
 * - At loud speech (level >0.8): intense pulsing distortion
 *
 * A small stop icon sits in the center.
 *
 * Uses a canvas for smooth 60fps shape rendering with
 * CSS-layered iridescent gradients for the glass effect.
 */
export default function VoiceOrb({
  audioLevel,
  size = 44,
  onClick,
  className = '',
}: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const smoothLevelRef = useRef(0)
  const timeRef = useRef(0)
  const lastTimeRef = useRef(0)

  // Aura size is slightly larger than the orb
  const auraSize = size * 1.5

  // Memoize the style object for the stop button
  const stopBtnStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 10,
  }), [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Use devicePixelRatio for crisp rendering
    const dpr = window.devicePixelRatio || 1
    const canvasSize = auraSize
    canvas.width = canvasSize * dpr
    canvas.height = canvasSize * dpr
    ctx.scale(dpr, dpr)

    const centerX = canvasSize / 2
    const centerY = canvasSize / 2
    const baseRadius = size / 2

    const draw = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp
      const dt = (timestamp - lastTimeRef.current) / 1000
      lastTimeRef.current = timestamp
      timeRef.current += dt

      // Smooth the audio level for organic response
      const targetLevel = audioLevel
      smoothLevelRef.current += (targetLevel - smoothLevelRef.current) * 0.15

      const level = smoothLevelRef.current
      const t = timeRef.current

      // Clear canvas
      ctx.clearRect(0, 0, canvasSize, canvasSize)

      // ── Outer aura glow ──
      const auraRadius = baseRadius * (1.2 + level * 0.4)
      const auraGrad = ctx.createRadialGradient(
        centerX, centerY, baseRadius * 0.5,
        centerX, centerY, auraRadius * 1.3
      )
      const auraOpacity = 0.2 + level * 0.4
      auraGrad.addColorStop(0, `rgba(140, 160, 255, ${auraOpacity})`)
      auraGrad.addColorStop(0.5, `rgba(160, 130, 255, ${auraOpacity * 0.6})`)
      auraGrad.addColorStop(1, 'rgba(140, 160, 255, 0)')
      ctx.fillStyle = auraGrad
      ctx.beginPath()
      ctx.arc(centerX, centerY, auraRadius * 1.3, 0, Math.PI * 2)
      ctx.fill()

      // ── Main orb shape (warped circle using bezier curves) ──
      // Generate control points that warp based on audio level
      const numPoints = 8
      const points: { x: number; y: number }[] = []

      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2
        // Each point gets a unique distortion based on time + audio
        const freq1 = Math.sin(t * 2.5 + i * 1.7) * level * 0.25
        const freq2 = Math.cos(t * 3.1 + i * 2.3) * level * 0.15
        const freq3 = Math.sin(t * 1.8 + i * 0.9) * 0.03 // baseline breathing
        const distortion = freq1 + freq2 + freq3

        const r = baseRadius * (1 + distortion)
        points.push({
          x: centerX + Math.cos(angle) * r,
          y: centerY + Math.sin(angle) * r,
        })
      }

      // Draw the warped shape using smooth bezier curves
      ctx.beginPath()
      for (let i = 0; i < numPoints; i++) {
        const curr = points[i]
        const next = points[(i + 1) % numPoints]
        const prev = points[(i - 1 + numPoints) % numPoints]
        const nextNext = points[(i + 2) % numPoints]

        if (i === 0) {
          ctx.moveTo(curr.x, curr.y)
        }

        // Catmull-Rom to bezier control points
        const cp1x = curr.x + (next.x - prev.x) / 6
        const cp1y = curr.y + (next.y - prev.y) / 6
        const cp2x = next.x - (nextNext.x - curr.x) / 6
        const cp2y = next.y - (nextNext.y - curr.y) / 6

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, next.x, next.y)
      }
      ctx.closePath()

      // White glass fill
      const glassGrad = ctx.createRadialGradient(
        centerX - baseRadius * 0.15, centerY - baseRadius * 0.15, 0,
        centerX, centerY, baseRadius * 1.1
      )
      glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)')
      glassGrad.addColorStop(0.5, 'rgba(250, 252, 255, 0.95)')
      glassGrad.addColorStop(1, 'rgba(240, 245, 252, 0.88)')
      ctx.fillStyle = glassGrad
      ctx.fill()

      // ── Iridescent ring overlay ──
      ctx.save()
      ctx.clip() // clip to the orb shape

      // Rotating conic-like gradient ring (simulated with arc segments)
      const ringInner = baseRadius * 0.65
      const ringOuter = baseRadius * 0.95
      const rotAngle = t * 1.2

      const ringColors = [
        { angle: 0, color: `rgba(120, 100, 220, ${0.7 + level * 0.3})` },
        { angle: Math.PI * 0.5, color: `rgba(100, 180, 255, ${0.5 + level * 0.3})` },
        { angle: Math.PI, color: 'rgba(255, 255, 255, 0)' },
        { angle: Math.PI * 1.5, color: `rgba(140, 100, 240, ${0.6 + level * 0.3})` },
      ]

      for (let s = 0; s < ringColors.length; s++) {
        const segStart = ringColors[s].angle + rotAngle
        const segEnd = ringColors[(s + 1) % ringColors.length].angle + rotAngle + (s === ringColors.length - 1 ? Math.PI * 2 : 0)

        ctx.beginPath()
        ctx.arc(centerX, centerY, ringOuter, segStart, segEnd)
        ctx.arc(centerX, centerY, ringInner, segEnd, segStart, true)
        ctx.closePath()
        ctx.fillStyle = ringColors[s].color
        ctx.fill()
      }

      ctx.restore()

      // ── Edge highlight / shadow ──
      ctx.save()
      // Redraw the orb path for stroke
      ctx.beginPath()
      for (let i = 0; i < numPoints; i++) {
        const curr = points[i]
        const next = points[(i + 1) % numPoints]
        const prev = points[(i - 1 + numPoints) % numPoints]
        const nextNext = points[(i + 2) % numPoints]

        if (i === 0) ctx.moveTo(curr.x, curr.y)

        const cp1x = curr.x + (next.x - prev.x) / 6
        const cp1y = curr.y + (next.y - prev.y) / 6
        const cp2x = next.x - (nextNext.x - curr.x) / 6
        const cp2y = next.y - (nextNext.y - curr.y) / 6

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, next.x, next.y)
      }
      ctx.closePath()
      ctx.strokeStyle = `rgba(160, 180, 255, ${0.3 + level * 0.3})`
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.restore()

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [audioLevel, size, auraSize])

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center justify-center cursor-pointer transition-transform active:scale-95 ${className}`}
      style={{ width: size, height: size }}
      aria-label="Stop listening"
      title="Stop listening"
    >
      {/* Canvas for the animated orb */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          width: auraSize,
          height: auraSize,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      {/* Stop icon in the center */}
      <div style={stopBtnStyle}>
        <Square
          className="text-indigo-600/70"
          style={{
            width: size * 0.28,
            height: size * 0.28,
            fill: 'currentColor',
          }}
        />
      </div>
    </button>
  )
}
