'use client'

import { ArrowLeft, BookOpen, Pencil, ExternalLink, Tag } from 'lucide-react'
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
// Internal tool — XSS risk from trusted org members is acceptable.

function MarkdownContent({ content }: { content: string }) {
  // Convert basic markdown to HTML manually (no external library needed)
  const html = content
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-gray-900 mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-gray-900 mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-gray-900 mt-6 mb-3">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    // Inline code
    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-800">$1</code>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li class="flex items-start gap-2 text-sm text-gray-700 leading-relaxed"><span class="w-1.5 h-1.5 rounded-full bg-gray-400 mt-2 flex-shrink-0"></span><span>$1</span></li>')
    // Ordered lists (simple)
    .replace(/^\d+\. (.+)$/gm, '<li class="text-sm text-gray-700 leading-relaxed list-decimal ml-4">$1</li>')
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p class="text-sm text-gray-700 leading-relaxed mb-3">')
    // Wrap in paragraph tags
  const wrapped = `<p class="text-sm text-gray-700 leading-relaxed mb-3">${html}</p>`

  return (
    <div
      className="prose prose-sm max-w-none"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: wrapped }}
    />
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
        className="inline-flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 transition-colors"
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
            <h1 className="text-xl font-bold text-gray-900">{article.title}</h1>
            <p className="text-xs text-gray-500">
              By {authorName} &middot; Updated {formatArticleDate(article.updatedAt)}
            </p>
          </div>
          {canEdit && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
          )}
        </div>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag className="w-3 h-3 text-gray-400 flex-shrink-0" />
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="border-t border-gray-100 pt-5">
          {article.content ? (
            <MarkdownContent content={article.content} />
          ) : (
            <div className="flex items-center gap-2 py-8 text-center justify-center">
              <BookOpen className="w-6 h-6 text-gray-200" />
              <p className="text-sm text-gray-400">No content yet</p>
            </div>
          )}
        </div>

        {/* Embedded calculator for CALCULATION_TOOL articles */}
        {article.type === 'CALCULATION_TOOL' && article.calculatorType === 'POND_CARE_DOSAGE' && (
          <div className="border-t border-gray-100 pt-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Embedded Calculator
            </p>
            <PondCareDosageCalculator />
          </div>
        )}

        {/* Related asset link */}
        {article.asset && (
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Related Asset
            </p>
            <Link
              href={`/maintenance/assets/${article.asset.id}`}
              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm text-gray-700 transition-colors"
            >
              <span className="font-medium">{article.asset.assetNumber}</span>
              <span>{article.asset.name}</span>
              <ExternalLink className="w-3 h-3 text-gray-400" />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
