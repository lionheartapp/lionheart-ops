'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseFilterOptions<TFilters extends Record<string, string>> {
  /** Default filter values */
  defaults: TFilters
  /** Debounce delay in ms for search field (default: 300) */
  debounceMs?: number
  /** Whether to sync filters to URL search params (default: false) */
  syncUrl?: boolean
  /** Fields to debounce (default: ['search']) */
  debounceFields?: (keyof TFilters)[]
}

export interface UseFilterReturn<TFilters extends Record<string, string>> {
  /** Current filter values (debounced for debounce fields) */
  filters: TFilters
  /** Raw (non-debounced) values for controlled inputs */
  rawValues: TFilters
  /** Set a single filter value */
  setFilter: <K extends keyof TFilters>(key: K, value: TFilters[K]) => void
  /** Set multiple filter values at once */
  setFilters: (partial: Partial<TFilters>) => void
  /** Reset all filters to defaults */
  resetFilters: () => void
  /** Whether any filter differs from default */
  hasActiveFilters: boolean
  /** Number of active (non-default) filters */
  activeFilterCount: number
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFilter<TFilters extends Record<string, string>>(
  options: UseFilterOptions<TFilters>
): UseFilterReturn<TFilters> {
  const {
    defaults,
    debounceMs = 300,
    syncUrl = false,
    debounceFields = ['search'] as (keyof TFilters)[],
  } = options

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Initialize from URL params if syncUrl is enabled
  const initialValues = useMemo((): TFilters => {
    if (!syncUrl) return { ...defaults }
    const fromUrl = { ...defaults }
    for (const key of Object.keys(defaults)) {
      const urlVal = searchParams.get(key)
      if (urlVal !== null) {
        (fromUrl as Record<string, string>)[key] = urlVal
      }
    }
    return fromUrl
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Raw values — updated immediately on every keystroke
  const [rawValues, setRawValues] = useState<TFilters>(initialValues)

  // Debounced values — updated after delay for debounce fields
  const [debouncedValues, setDebouncedValues] = useState<TFilters>(initialValues)

  // Debounce timer ref
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce effect
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      setDebouncedValues((prev) => {
        const next = { ...prev }
        for (const field of debounceFields) {
          (next as Record<string, string>)[field as string] = rawValues[field]
        }
        return next
      })
    }, debounceMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [rawValues, debounceMs, debounceFields])

  // Compute the merged "filters" — debounced fields use debouncedValues, rest use rawValues
  const filters = useMemo((): TFilters => {
    const result = { ...rawValues }
    for (const field of debounceFields) {
      (result as Record<string, string>)[field as string] = debouncedValues[field]
    }
    return result
  }, [rawValues, debouncedValues, debounceFields])

  // Sync to URL when filters change
  useEffect(() => {
    if (!syncUrl) return
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
      if (value && value !== defaults[key as keyof TFilters]) {
        params.set(key, value)
      }
    }
    const qs = params.toString()
    const newUrl = qs ? `${pathname}?${qs}` : pathname
    router.replace(newUrl, { scroll: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, syncUrl])

  const setFilter = useCallback(<K extends keyof TFilters>(key: K, value: TFilters[K]) => {
    setRawValues((prev) => ({ ...prev, [key]: value }))
    // Non-debounced fields update immediately
    if (!debounceFields.includes(key)) {
      setDebouncedValues((prev) => ({ ...prev, [key]: value }))
    }
  }, [debounceFields])

  const setFilters = useCallback((partial: Partial<TFilters>) => {
    setRawValues((prev) => ({ ...prev, ...partial }))
    // Update non-debounced fields immediately
    const immediate: Partial<TFilters> = {}
    for (const [k, v] of Object.entries(partial)) {
      if (!debounceFields.includes(k as keyof TFilters)) {
        (immediate as Record<string, string>)[k] = v as string
      }
    }
    if (Object.keys(immediate).length > 0) {
      setDebouncedValues((prev) => ({ ...prev, ...immediate }))
    }
  }, [debounceFields])

  const resetFilters = useCallback(() => {
    setRawValues({ ...defaults })
    setDebouncedValues({ ...defaults })
  }, [defaults])

  const hasActiveFilters = useMemo(
    () => Object.keys(defaults).some((key) => filters[key as keyof TFilters] !== defaults[key as keyof TFilters]),
    [filters, defaults]
  )

  const activeFilterCount = useMemo(
    () => Object.keys(defaults).filter((key) => filters[key as keyof TFilters] !== defaults[key as keyof TFilters]).length,
    [filters, defaults]
  )

  return {
    filters,
    rawValues,
    setFilter,
    setFilters,
    resetFilters,
    hasActiveFilters,
    activeFilterCount,
  }
}
