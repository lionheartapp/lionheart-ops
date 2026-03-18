'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  BookOpen,
  Plus,
  Wrench,
  ClipboardList,
  FlaskConical,
  ShieldAlert,
  Phone,
  StickyNote,
} from 'lucide-react'
import { fetchApi } from '@/lib/api-client'
import { cardEntrance, staggerContainer } from '@/lib/animations'
import { IllustrationKnowledgeBase } from '@/components/illustrations'

// ─── Article type configuration ───────────────────────────────────────────────

export const ARTICLE_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
  EQUIPMENT_GUIDE: {
    label: 'Equipment Guide',
    color: 'text-teal-700',
    bgColor: 'bg-teal-100',
    icon: Wrench,
  },
  PROCEDURE_SOP: {
    label: 'Procedure SOP',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: ClipboardList,
  },
  CALCULATION_TOOL: {
    label: 'Calculation Tool',
    color: 'text-amber-700',
    bgColor: 'bg-amber-100',
    icon: FlaskConical,
  },
  SAFETY_PROTOCOL: {
    label: 'Safety Protocol',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    icon: ShieldAlert,
  },
  VENDOR_CONTACT: {
    label: 'Vendor Contact',
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    icon: Phone,
  },
  ASSET_NOTE: {
    label: 'Asset Note',
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    icon: StickyNote,
  },
}

export function KBArticleTypeBadge({ type }: { type: string }) {
  const config = ARTICLE_TYPE_CONFIG[type] ?? ARTICLE_TYPE_CONFIG['ASSET_NOTE']
  const Icon = config.icon
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${config.bgColor} ${config.color}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  )
}

export function formatArticleDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Article {
  id: string
  title: string
  type: string
  content: string
  tags: string[]
  isPublished: boolean
  updatedAt: string
  createdBy?: { firstName?: string | null; lastName?: string | null; email: string } | null
  asset?: { id: string; name: string; assetNumber: string } | null
}

interface KnowledgeBaseListProps {
  searchQuery: string
  onCreateNew?: () => void
}

// ─── Type filter tabs ─────────────────────────────────────────────────────────

const FILTER_TABS = [
  { value: '', label: 'All' },
  { value: 'EQUIPMENT_GUIDE', label: 'Equipment' },
  { value: 'PROCEDURE_SOP', label: 'Procedure SOP' },
  { value: 'CALCULATION_TOOL', label: 'Calculations' },
  { value: 'SAFETY_PROTOCOL', label: 'Safety' },
  { value: 'VENDOR_CONTACT', label: 'Vendors' },
  { value: 'ASSET_NOTE', label: 'Asset Notes' },
]

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ArticleSkeleton() {
  return (
    <div className="animate-pulse ui-glass rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-5 w-24 bg-slate-200 rounded-full" />
      </div>
      <div className="h-4 bg-slate-200 rounded w-3/4" />
      <div className="h-3 bg-slate-100 rounded w-full" />
      <div className="h-3 bg-slate-100 rounded w-4/5" />
      <div className="flex gap-2 pt-1">
        <div className="h-5 w-12 bg-slate-100 rounded-full" />
        <div className="h-5 w-16 bg-slate-100 rounded-full" />
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onCreateNew }: { onCreateNew?: () => void }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-center gap-4">
      <IllustrationKnowledgeBase className="w-48 h-40" />
      <div>
        <p className="text-base font-semibold text-slate-700">No articles yet</p>
        <p className="text-sm text-slate-500 mt-1">Share your team&apos;s knowledge with the first article.</p>
      </div>
      {onCreateNew && (
        <button
          type="button"
          onClick={onCreateNew}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer active:scale-[0.97]"
        >
          <Plus className="w-4 h-4" />
          Create Article
        </button>
      )}
    </div>
  )
}

// ─── Article card ─────────────────────────────────────────────────────────────

function ArticleCard({ article }: { article: Article }) {
  const preview = article.content
    ? article.content.replace(/[#*`]/g, '').trim().slice(0, 140)
    : ''
  const hasMoreContent = article.content && article.content.length > 140

  return (
    <motion.div variants={cardEntrance}>
      <Link
        href={`/maintenance/knowledge-base/${article.id}`}
        className="block ui-glass-hover rounded-2xl p-5 space-y-3 h-full"
      >
        {/* Type badge */}
        <KBArticleTypeBadge type={article.type} />

        {/* Title */}
        <h3 className="text-sm font-semibold text-slate-900 line-clamp-2">{article.title}</h3>

        {/* Content preview */}
        {preview && (
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {preview}
            {hasMoreContent && '…'}
          </p>
        )}

        {/* Footer: tags + date */}
        <div className="flex items-end justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-1.5">
            {article.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 text-[10px] rounded-md bg-slate-100 text-slate-500"
              >
                {tag}
              </span>
            ))}
            {article.tags.length > 3 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-md bg-slate-100 text-slate-500">
                +{article.tags.length - 3}
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 flex-shrink-0">
            {formatArticleDate(article.updatedAt)}
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function KnowledgeBaseList({
  searchQuery,
  onCreateNew,
}: KnowledgeBaseListProps) {
  const [activeType, setActiveType] = useState('')

  // Build query params
  const params = new URLSearchParams()
  if (activeType) params.set('type', activeType)
  if (searchQuery) params.set('keyword', searchQuery)

  const { data: articles, isLoading } = useQuery<Article[]>({
    queryKey: ['knowledge-base', activeType, searchQuery],
    queryFn: () =>
      fetchApi<Article[]>(`/api/maintenance/knowledge-base?${params.toString()}`),
    staleTime: 30_000,
  })

  return (
    <div className="space-y-5">
      {/* Type filter tabs — sliding pill via Framer Motion layoutId */}
      <div className="mb-4 inline-flex gap-1 rounded-full bg-slate-100 p-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveType(tab.value)}
            className={`relative px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 cursor-pointer ${
              activeType === tab.value
                ? 'text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {activeType === tab.value && (
              <motion.div
                layoutId="kbFilterPill"
                className="absolute inset-0 rounded-full bg-slate-900"
                transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Grid */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <ArticleSkeleton key={i} />
            ))}
          </div>
        ) : articles && articles.length > 0 ? (
          <motion.div
            key={`${activeType}-${searchQuery}`}
            variants={staggerContainer(0.06, 0)}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1">
            <EmptyState onCreateNew={onCreateNew} />
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
