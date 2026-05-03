/**
 * UI Component Kit — reusable primitives for building CRUD interfaces fast.
 *
 * Usage:
 *   import { DataTable, SearchFilterBar, FormDrawer, Pagination } from '@/components/ui'
 *   import type { Column, FilterTab } from '@/components/ui'
 */

export { default as DataTable } from './DataTable'
export type { Column, DataTableProps } from './DataTable'

export { default as SearchFilterBar } from './SearchFilterBar'
export type { FilterTab, SearchFilterBarProps } from './SearchFilterBar'

export { default as FormDrawer } from './FormDrawer'
export type { FormDrawerProps } from './FormDrawer'

export { default as Pagination } from './Pagination'
export type { PaginationProps } from './Pagination'

export { default as EmptyState } from './EmptyState'

// Re-export existing UI components for convenience
export { FloatingInput, FloatingSelect, FloatingDropdown, FloatingTextarea } from './FloatingInput'
export { default as TabIndicator } from './TabIndicator'
