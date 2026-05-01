'use client'

import { ArrowLeft, BookOpen, Pencil, ExternalLink, Tag } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import Link from 'next/link'
import PondCareDosageCalculator from '@/components/maintenance/calculators/PondCareDosageCalculator'
import { KBArticleTypeBadge, formatArticleDate } from '@/components/maintenance/KnowledgeBaseList'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KBArticle {
  id: string
  title: string
  type: string
  content: string
  tags: string[]
  assetId?: string | null
  calculatorType?: string | null
  isPublished: boolean
  createdAt: string
  updatedAt: string
  createdBy?: {
    id: string
    firstName?: string | null
    lastName?: string | null
    email: string
  } | null
  asset?: {
    id: string
    name: string
    assetNumber: string
  } | null
}

interface KnowledgeBaseArticleViewerProps {
  article: KBArticle
  canEdit?: boolean
  onEdit?: () => void
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm prose-slate max-w-none">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KnowledgeBaseArticleViewer({
  article,
  canEdit = false,
  onEdit,
}: KnowledgeBaseArticleViewerProps) {
  const authorName = article.createdBy
    ? [article.createdBy.firstName, article.createdBy.lastName].filter(Boolean).join(' ') ||
      article.createdBy.email
    : 'Unknown'

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/maintenance/knowledge-base"
        className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Knowledge Base
      </Link>

      {/* Article card */}
      <div className="ui-glass rounded-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            <KBArticleTypeBadge type={article.type} />
            <h1 className="text-xl font-bold text-slate-900">{article.title}</h1>
            <p className="text-xs text-slate-500">
              By {authorName} &middot; Updated {formatArticleDate(article.updatedAt)}
            </p>
          </div>
          {canEdit && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="ui-btn-sm ui-btn-outline"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          )}
        </div>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag className="w-3 h-3 text-slate-400 flex-shrink-0" />
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="border-t border-slate-100 pt-5">
          {article.content ? (
            <MarkdownContent content={article.content} />
          ) : (
            <div className="flex items-center gap-2 py-8 text-center justify-center">
              <BookOpen className="w-6 h-6 text-slate-200" />
              <p className="text-sm text-slate-400">No content yet</p>
            </div>
          )}
        </div>

        {/* Embedded calculator for CALCULATION_TOOL articles */}
        {article.type === 'CALCULATION_TOOL' && article.calculatorType === 'POND_CARE_DOSAGE' && (
          <div className="border-t border-slate-100 pt-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Embedded Calculator
            </p>
            <PondCareDosageCalculator />
          </div>
        )}

        {/* Related asset link */}
        {article.asset && (
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Related Asset
            </p>
            <Link
              href={`/maintenance/assets/${article.asset.id}`}
              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-sm text-slate-700 transition-colors"
            >
              <span className="font-medium">{article.asset.assetNumber}</span>
              <span>{article.asset.name}</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
