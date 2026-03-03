'use client'

import type { ReactNode } from 'react'

// ─── Shape definitions ───────────────────────────────────────────────

interface ShapeDefinition {
  name: string
  render: (color: string, size: number) => ReactNode
}

export const CAMPUS_SHAPES: ShapeDefinition[] = [
  {
    name: 'circle',
    render: (color, size) => (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill={color} />
      </svg>
    ),
  },
  {
    name: 'square',
    render: (color, size) => (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
        <rect x="2" y="2" width="12" height="12" rx="1.5" fill={color} />
      </svg>
    ),
  },
  {
    name: 'diamond',
    render: (color, size) => (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
        <rect x="2.34" y="2.34" width="11.31" height="11.31" rx="1.5" transform="rotate(45 8 8)" fill={color} />
      </svg>
    ),
  },
  {
    name: 'triangle',
    render: (color, size) => (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
        <polygon points="8,1.5 15,14 1,14" fill={color} />
      </svg>
    ),
  },
  {
    name: 'hexagon',
    render: (color, size) => (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
        <polygon points="8,1 14,4.5 14,11.5 8,15 2,11.5 2,4.5" fill={color} />
      </svg>
    ),
  },
]

// ─── Component ───────────────────────────────────────────────────────

interface CampusShapeIndicatorProps {
  shapeIndex: number
  color: string
  size?: number
  className?: string
}

export default function CampusShapeIndicator({
  shapeIndex,
  color,
  size = 8,
  className = '',
}: CampusShapeIndicatorProps) {
  const shape = CAMPUS_SHAPES[shapeIndex % CAMPUS_SHAPES.length]
  return (
    <span className={`inline-flex flex-shrink-0 ${className}`}>
      {shape.render(color, size)}
    </span>
  )
}

// ─── Helper: build campus → shape index map ──────────────────────────

export function buildCampusShapeMap(
  calendars: Array<{ campus?: { id: string; name: string } | null }>
): Map<string, number> {
  const campusIds = [...new Set(
    calendars.map((c) => c.campus?.id).filter((id): id is string => !!id)
  )]
  campusIds.sort()
  return new Map(campusIds.map((id, i) => [id, i % CAMPUS_SHAPES.length]))
}

/**
 * Get the shape index for a given event's campus.
 * Returns 0 (circle) for events with no campus (org-wide).
 */
export function getShapeIndex(
  campusShapeMap: Map<string, number>,
  campusId?: string | null
): number {
  if (!campusId) return 0
  return campusShapeMap.get(campusId) ?? 0
}
