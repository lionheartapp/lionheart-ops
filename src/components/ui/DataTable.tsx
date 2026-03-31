'use client'

import { ReactNode } from 'react'
import { motion, type Variants } from 'framer-motion'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Column<T> {
  /** Unique key for the column */
  key: string
  /** Column header label */
  header: string
  /** Render cell content — receives the row item */
  render: (item: T) => ReactNode
  /** Optional: column width class (e.g. 'w-48', 'w-1/3') */
  width?: string
  /** Optional: hide on mobile */
  hideOnMobile?: boolean
  /** Optional: text alignment */
  align?: 'left' | 'center' | 'right'
}

export interface DataTableProps<T> {
  /** Column definitions */
  columns: Column<T>[]
  /** Data rows */
  data: T[]
  /** Unique key extractor for each row */
  getRowKey: (item: T) => string
  /** Loading state — shows skeleton */
  isLoading?: boolean
  /** Number of skeleton rows to show while loading */
  skeletonRows?: number
  /** Content to show when data is empty and not loading */
  emptyState?: ReactNode
  /** Called when a row is clicked */
  onRowClick?: (item: T) => void
  /** Render an action menu for each row */
  renderRowActions?: (item: T) => ReactNode
  /** Render mobile card for responsive layout (if not provided, table is used at all sizes) */
  renderMobileCard?: (item: T) => ReactNode
  /** Optional className for the table wrapper */
  className?: string
}

// ---------------------------------------------------------------------------
// Skeleton Row
// ---------------------------------------------------------------------------

function SkeletonRow({ columns }: { columns: Column<unknown>[] }) {
  return (
    <tr className="border-b border-slate-100">
      {columns.map((col) => (
        <td
          key={col.key}
          className={`py-3 px-4 ${col.hideOnMobile ? 'hidden md:table-cell' : ''}`}
        >
          <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
        </td>
      ))}
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
}

const rowVariant: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } },
}

export default function DataTable<T>({
  columns,
  data,
  getRowKey,
  isLoading = false,
  skeletonRows = 5,
  emptyState,
  onRowClick,
  renderRowActions,
  renderMobileCard,
  className = '',
}: DataTableProps<T>) {
  const alignClass = (align?: string) => {
    if (align === 'center') return 'text-center'
    if (align === 'right') return 'text-right'
    return 'text-left'
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={`ui-glass-table overflow-hidden ${className}`}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider ${alignClass(col.align)} ${col.hideOnMobile ? 'hidden md:table-cell' : ''} ${col.width ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
              {renderRowActions && <th className="w-12" />}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: skeletonRows }, (_, i) => (
              <SkeletonRow key={i} columns={columns as Column<unknown>[]} />
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className={className}>
        {emptyState ?? (
          <div className="text-center py-12 text-slate-400">
            No items found
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Mobile card layout */}
      {renderMobileCard && (
        <motion.div
          className={`md:hidden space-y-3 ${className}`}
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {data.map((item) => (
            <motion.div
              key={getRowKey(item)}
              variants={rowVariant}
              className={onRowClick ? 'cursor-pointer' : ''}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
            >
              {renderMobileCard(item)}
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Desktop table */}
      <div className={`${renderMobileCard ? 'hidden md:block' : ''} ui-glass-table overflow-hidden ${className}`}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`py-3 px-4 text-xs font-medium text-slate-400 uppercase tracking-wider ${alignClass(col.align)} ${col.hideOnMobile ? 'hidden md:table-cell' : ''} ${col.width ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
              {renderRowActions && <th className="w-12" />}
            </tr>
          </thead>
          <motion.tbody
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {data.map((item) => (
              <motion.tr
                key={getRowKey(item)}
                variants={rowVariant}
                className={`border-b border-slate-100 transition-colors duration-200 ${
                  onRowClick ? 'hover:bg-slate-50 cursor-pointer' : ''
                }`}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`py-3 px-4 text-sm text-slate-700 ${alignClass(col.align)} ${col.hideOnMobile ? 'hidden md:table-cell' : ''}`}
                  >
                    {col.render(item)}
                  </td>
                ))}
                {renderRowActions && (
                  <td className="py-3 px-2" onClick={(e) => e.stopPropagation()}>
                    {renderRowActions(item)}
                  </td>
                )}
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>
    </>
  )
}
