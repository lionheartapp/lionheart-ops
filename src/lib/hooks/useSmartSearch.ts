'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface SmartSearchContext {
  schools: Array<{ id: string; name: string }>
  campuses: Array<{ id: string; name: string }>
  categories: Array<{ id: string; name: string }>
  sports: Array<{ id: string; name: string }>
}

export interface ResolvedSearchFilter {
  titleSearch?: string
  schoolIds?: string[]
  campusIds?: string[]
  categoryIds?: string[]
  schoolLevels?: string[]
  sportIds?: string[]
  teamLevels?: string[]
  dateRange?: { start: string; end: string }
  summary?: string
}

interface UseSmartSearchResult {
  aiFilter: ResolvedSearchFilter | null
  isProcessing: boolean
  clearAiFilter: () => void
}

/**
 * Detects if a query looks like natural language (vs a simple title search).
 * Simple heuristic: 3+ words, or contains filter-like keywords.
 */
function looksLikeNaturalLanguage(query: string): boolean {
  const trimmed = query.trim()
  if (trimmed.length < 8) return false

  const words = trimmed.split(/\s+/)
  if (words.length >= 3) return true

  const keywords = [
    'show', 'find', 'any', 'all', 'need', 'needs', 'with', 'without',
    'for', 'that', 'which', 'where', 'when', 'next', 'last', 'this',
    'high school', 'middle school', 'elementary', 'varsity',
    'av', 'a/v', 'facilities', 'admin',
  ]
  const lower = trimmed.toLowerCase()
  return keywords.some((kw) => lower.includes(kw))
}

export function useSmartSearch(
  searchQuery: string,
  context: SmartSearchContext,
  debounceMs = 600,
): UseSmartSearchResult {
  const [aiFilter, setAiFilter] = useState<ResolvedSearchFilter | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearAiFilter = useCallback(() => {
    setAiFilter(null)
  }, [])

  // Stabilize context reference — only recalculate when the serialized value changes
  const contextRef = useRef(context)
  const contextKey = JSON.stringify({
    s: context.schools.map((s) => s.id),
    c: context.campuses.map((c) => c.id),
    cat: context.categories.map((c) => c.id),
    sp: context.sports.map((s) => s.id),
  })
  useEffect(() => { contextRef.current = context }, [contextKey])

  useEffect(() => {
    // Clear previous timer
    if (timerRef.current) clearTimeout(timerRef.current)

    const trimmed = searchQuery.trim()

    // If empty or too short or doesn't look like NL, clear AI filter
    if (!trimmed || !looksLikeNaturalLanguage(trimmed)) {
      setAiFilter(null)
      setIsProcessing(false)
      return
    }

    setIsProcessing(true)

    const ctx = contextRef.current
    timerRef.current = setTimeout(async () => {
      // Abort previous request
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const res = await fetch('/api/ai/parse-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            query: trimmed,
            context: {
              schools: ctx.schools.map((s) => ({ id: s.id, name: s.name })),
              campuses: ctx.campuses.map((c) => ({ id: c.id, name: c.name })),
              categories: ctx.categories.map((c) => ({ id: c.id, name: c.name })),
              sports: ctx.sports.map((s) => ({ id: s.id, name: s.name })),
            },
          }),
          signal: controller.signal,
        })

        if (!res.ok) {
          setIsProcessing(false)
          return
        }

        const json = await res.json()
        if (json.ok && json.data) {
          setAiFilter(json.data as ResolvedSearchFilter)
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
      } finally {
        if (!controller.signal.aborted) {
          setIsProcessing(false)
        }
      }
    }, debounceMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, contextKey, debounceMs])

  return { aiFilter, isProcessing, clearAiFilter }
}
