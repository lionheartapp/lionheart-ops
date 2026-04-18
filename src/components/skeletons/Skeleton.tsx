'use client'

import type { CSSProperties, HTMLAttributes } from 'react'

type SkeletonShape = 'rect' | 'rounded' | 'circle' | 'pill' | 'text'

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Visual shape preset. Defaults to `rounded` (4px corners). */
  shape?: SkeletonShape
  /** Width — accepts any CSS length. Omit to let Tailwind classes drive it. */
  width?: number | string
  /** Height — accepts any CSS length. Omit to let Tailwind classes drive it. */
  height?: number | string
  /** Tone — `default` for solid-surface contexts, `glass` for translucent cards. */
  tone?: 'default' | 'glass'
}

/**
 * Primitive skeleton block.
 *
 * Audit ref L3: ~100 files reimplement `animate-pulse` rectangles with
 * hand-rolled Tailwind classes, which means sizes, corner radii, and pulse
 * cadence all drift. This primitive centralizes the cadence + default tones
 * so future skeleton work looks uniform without forcing a big-bang refactor.
 *
 * Use the higher-level compositions below (`SkeletonText`, `SkeletonCard`,
 * `SkeletonList`, `SkeletonTable`) for common layouts.
 */
export function Skeleton({
  shape = 'rounded',
  width,
  height,
  tone = 'default',
  className = '',
  style,
  ...rest
}: SkeletonProps) {
  const shapeClass =
    shape === 'circle'
      ? 'rounded-full aspect-square'
      : shape === 'pill'
        ? 'rounded-full'
        : shape === 'text'
          ? 'rounded'
          : shape === 'rect'
            ? ''
            : 'rounded-lg'

  const toneClass = tone === 'glass' ? 'bg-white/60' : 'bg-slate-200/80'

  const finalStyle: CSSProperties = {
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...style,
  }

  return (
    <div
      aria-hidden="true"
      className={`animate-pulse ${toneClass} ${shapeClass} ${className}`}
      style={finalStyle}
      {...rest}
    />
  )
}

interface SkeletonTextProps {
  /** Number of text lines. Defaults to 3. */
  lines?: number
  /** Tone — passed through to each child. */
  tone?: 'default' | 'glass'
  className?: string
}

/** Paragraph-style stack of text skeletons; last line is 3/4 width for realism. */
export function SkeletonText({ lines = 3, tone = 'default', className = '' }: SkeletonTextProps) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          shape="text"
          height={12}
          tone={tone}
          className={i === lines - 1 ? 'w-3/4' : 'w-full'}
        />
      ))}
    </div>
  )
}

interface SkeletonCardProps {
  /** Show a circular avatar block at the top-left. */
  showAvatar?: boolean
  /** Number of body lines. Defaults to 3. */
  lines?: number
  /** Tone — passed through to each child. */
  tone?: 'default' | 'glass'
  className?: string
}

/** Generic content-card skeleton — optional avatar + title + body lines. */
export function SkeletonCard({
  showAvatar = false,
  lines = 3,
  tone = 'default',
  className = '',
}: SkeletonCardProps) {
  return (
    <div
      role="status"
      aria-label="Loading content"
      aria-live="polite"
      className={`bg-white border border-slate-200 rounded-xl p-6 ${className}`}
    >
      <div className="flex items-start gap-3">
        {showAvatar && <Skeleton shape="circle" width={40} height={40} tone={tone} />}
        <div className="flex-1 space-y-3">
          <Skeleton shape="text" height={16} tone={tone} className="w-1/2" />
          <SkeletonText lines={lines} tone={tone} />
        </div>
      </div>
    </div>
  )
}

interface SkeletonListProps {
  /** Number of rows. Defaults to 5. */
  rows?: number
  /** Show a leading circular glyph on each row. */
  showAvatar?: boolean
  /** Tone — passed through to each child. */
  tone?: 'default' | 'glass'
  className?: string
}

/** Vertical list skeleton — rows with optional avatar + 2-line text block. */
export function SkeletonList({
  rows = 5,
  showAvatar = true,
  tone = 'default',
  className = '',
}: SkeletonListProps) {
  return (
    <ul
      role="status"
      aria-label="Loading list"
      aria-live="polite"
      className={`space-y-3 ${className}`}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 p-3">
          {showAvatar && <Skeleton shape="circle" width={36} height={36} tone={tone} />}
          <div className="flex-1 space-y-2">
            <Skeleton shape="text" height={12} tone={tone} className="w-3/4" />
            <Skeleton shape="text" height={10} tone={tone} className="w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  )
}

interface SkeletonTableProps {
  /** Number of rows. Defaults to 6. */
  rows?: number
  /** Number of columns. Defaults to 4. */
  columns?: number
  /** Show the header row. Defaults to true. */
  showHeader?: boolean
  className?: string
}

/** Tabular skeleton — header + N rows of cells. */
export function SkeletonTable({
  rows = 6,
  columns = 4,
  showHeader = true,
  className = '',
}: SkeletonTableProps) {
  return (
    <div
      role="status"
      aria-label="Loading table"
      aria-live="polite"
      className={`w-full ${className}`}
    >
      {showHeader && (
        <div
          className="grid gap-3 pb-3 mb-3 border-b border-slate-200"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={`h-${c}`} shape="text" height={10} className="w-1/2" />
          ))}
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid gap-3 py-2"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={`${r}-${c}`}
                shape="text"
                height={12}
                className={c === 0 ? 'w-5/6' : c === columns - 1 ? 'w-2/5' : 'w-3/5'}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
