'use client'

import { useQuery } from '@tanstack/react-query'
import { BookOpen, ChevronRight, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { fetchApi } from '@/lib/api-client'

interface KBArticleSummary {
  id: string
  title: string
  type: string
  tags: string[]
}

interface KBSuggestionsPanelProps {
  category: string
  title?: string
}

/**
 * Shows relevant KB articles based on ticket category.
 * Renders nothing if no articles match or the query fails.
 */
export default function KBSuggestionsPanel({ category, title }: KBSuggestionsPanelProps) {
  const { data: articles } = useQuery<KBArticleSummary[]>({
    queryKey: ['kb-suggestions', category, title],
    queryFn: async () => {
      const params = new URLSearchParams({ category, limit: '3' })
      if (title) params.set('q', title)
      const result = await fetchApi<KBArticleSummary[]>(`/api/maintenance/knowledge-base/search?${params}`)
      return result ?? []
    },
    staleTime: 5 * 60 * 1000,
  })

  if (!articles || articles.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <BookOpen className="w-3.5 h-3.5 text-slate-400" />
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Related Articles</h4>
      </div>
      <div className="space-y-1">
        {articles.map((article) => (
          <Link
            key={article.id}
            href={`/maintenance/knowledge-base/${article.id}`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors group"
          >
            <span className="text-xs text-slate-700 flex-1 min-w-0 truncate group-hover:text-slate-900" title={article.title}>
              {article.title}
            </span>
            <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
          </Link>
        ))}
        <Link
          href={`/maintenance/knowledge-base`}
          className="flex items-center justify-center gap-1 py-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Browse all articles
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}
