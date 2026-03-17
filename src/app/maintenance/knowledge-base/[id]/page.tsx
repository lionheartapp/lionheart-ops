'use client'

import { useState } from 'react'
import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import DashboardLayout from '@/components/DashboardLayout'
import KnowledgeBaseArticleViewer from '@/components/maintenance/KnowledgeBaseArticleViewer'
import KnowledgeBaseArticleEditor from '@/components/maintenance/KnowledgeBaseArticleEditor'
import { fetchApi } from '@/lib/api-client'
import type { KBArticle } from '@/components/maintenance/KnowledgeBaseArticleViewer'

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ViewerSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      {/* Back link skeleton */}
      <div className="h-4 w-32 bg-gray-200 rounded" />
      {/* Card skeleton */}
      <div className="ui-glass rounded-2xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-5 w-28 bg-gray-200 rounded-full" />
            <div className="h-7 w-3/4 bg-gray-200 rounded" />
            <div className="h-3 w-48 bg-gray-100 rounded" />
          </div>
        </div>
        <div className="border-t border-gray-100 pt-5 space-y-3">
          <div className="h-3 bg-gray-100 rounded w-full" />
          <div className="h-3 bg-gray-100 rounded w-4/5" />
          <div className="h-3 bg-gray-100 rounded w-full" />
          <div className="h-3 bg-gray-100 rounded w-3/4" />
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KnowledgeBaseArticlePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [editorOpen, setEditorOpen] = useState(false)

  const { data: article, isLoading, refetch } = useQuery<KBArticle>({
    queryKey: ['knowledge-base', id],
    queryFn: () => fetchApi<KBArticle>(`/api/maintenance/knowledge-base/${id}`),
    staleTime: 30_000,
  })

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        {isLoading ? (
          <ViewerSkeleton />
        ) : article ? (
          <div className="p-6">
            <KnowledgeBaseArticleViewer
              article={article}
              canEdit={true}
              onEdit={() => setEditorOpen(true)}
            />
          </div>
        ) : (
          <div className="p-6 text-center py-16">
            <p className="text-sm text-gray-500">Article not found.</p>
          </div>
        )}

        {/* Editor drawer for updating article */}
        {article && (
          <KnowledgeBaseArticleEditor
            isOpen={editorOpen}
            onClose={() => setEditorOpen(false)}
            editArticle={article}
            onSaved={() => {
              refetch()
              setEditorOpen(false)
            }}
          />
        )}
      </div>
    </DashboardLayout>
  )
}
