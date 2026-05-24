'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { HelpArticle } from '@/lib/help/types'
import { SearchInput } from '@/components/ui/SearchInput'

interface HelpSearchProps {
  articles: HelpArticle[]
  /** Optional autoFocus on mount — useful on the index page hero. */
  autoFocus?: boolean
  placeholder?: string
}

/**
 * Lightweight client-side search over the article registry. Matches against
 * title, description, category, and the optional keywords array. Ranks an
 * exact title hit above a description hit above a keyword hit.
 */
export function HelpSearch({
  articles,
  autoFocus = false,
  placeholder = 'Search the knowledge base…',
}: HelpSearchProps) {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []

    const scored = articles
      .map((a) => {
        let score = 0
        if (a.title.toLowerCase().includes(q)) score += 10
        if (a.description.toLowerCase().includes(q)) score += 5
        if (a.category.toLowerCase().includes(q)) score += 3
        if (a.keywords?.some((k) => k.toLowerCase().includes(q))) score += 2
        return { article: a, score }
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)

    return scored.map((r) => r.article)
  }, [articles, query])

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <label htmlFor="help-search" className="sr-only">
        Search the knowledge base
      </label>
      <SearchInput
        id="help-search"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => setQuery(e.target.value)}
        onClear={() => setQuery('')}
        placeholder={placeholder}
        className="shadow-sm"
        aria-controls="help-search-results"
        aria-expanded={results.length > 0}
      />

      {results.length > 0 && (
        <div
          id="help-search-results"
          className="absolute left-0 right-0 mt-2 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden z-30"
          role="listbox"
        >
          <ul>
            {results.map((article) => (
              <li key={article.slug}>
                <Link
                  href={`/help/${article.slug}`}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors duration-200 group cursor-pointer"
                  role="option"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {article.title}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {article.description}
                    </p>
                  </div>
                  <ArrowRight
                    className="w-4 h-4 text-slate-300 group-hover:text-slate-900 transition-colors duration-200 mt-0.5"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {query.trim() && results.length === 0 && (
        <div
          className="absolute left-0 right-0 mt-2 rounded-xl border border-slate-200 bg-white shadow-lg p-6 text-center z-30"
          role="status"
        >
          <p className="text-sm text-slate-600">
            No articles matched <span className="font-semibold">&ldquo;{query}&rdquo;</span>.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Try a different word, or browse a category below.
          </p>
        </div>
      )}
    </div>
  )
}
