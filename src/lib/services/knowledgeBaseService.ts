/**
 * Knowledge Base Service
 *
 * Provides CRUD, search, and AI-relevance querying for KnowledgeArticle records.
 * All operations run inside an org-scoped Prisma context (prisma from @/lib/db).
 */

import { z } from 'zod'
import { prisma } from '@/lib/db'
import type { KnowledgeArticleType } from '@prisma/client'

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

export const CreateArticleSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum([
    'EQUIPMENT_GUIDE',
    'PROCEDURE_SOP',
    'CALCULATION_TOOL',
    'SAFETY_PROTOCOL',
    'VENDOR_CONTACT',
    'ASSET_NOTE',
  ]),
  content: z.string().min(1),
  tags: z.array(z.string()).default([]),
  assetId: z.string().optional().nullable(),
  calculatorType: z.string().optional().nullable(),
  isPublished: z.boolean().default(true),
  createdById: z.string(),
})

export const UpdateArticleSchema = CreateArticleSchema.partial().omit({ createdById: true })

export type CreateArticleInput = z.infer<typeof CreateArticleSchema> & { organizationId?: string }
export type UpdateArticleInput = z.infer<typeof UpdateArticleSchema>

// ─── Filters ─────────────────────────────────────────────────────────────────

export interface ArticleFilters {
  type?: KnowledgeArticleType
  tags?: string[]
  assetId?: string
  isPublished?: boolean
  keyword?: string
}

// ─── Select shape for list queries ───────────────────────────────────────────

const articleListSelect = {
  id: true,
  title: true,
  type: true,
  content: true,
  tags: true,
  assetId: true,
  calculatorType: true,
  isPublished: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  asset: {
    select: { id: true, name: true, assetNumber: true },
  },
} as const

// ─── createArticle ────────────────────────────────────────────────────────────

export async function createArticle(input: CreateArticleInput) {
  const data = CreateArticleSchema.parse(input)
  // organizationId is injected by the org-scoped Prisma client at runtime.
  // We pass a placeholder here to satisfy TypeScript; the actual value is set via AsyncLocalStorage.
  const orgId = input.organizationId ?? 'ORG_CONTEXT'
  return prisma.knowledgeArticle.create({
    data: {
      organizationId: orgId,
      title: data.title,
      type: data.type as KnowledgeArticleType,
      content: data.content,
      tags: data.tags,
      assetId: data.assetId ?? undefined,
      calculatorType: data.calculatorType ?? undefined,
      isPublished: data.isPublished,
      createdById: data.createdById,
    },
    select: articleListSelect,
  })
}

// ─── getArticles ──────────────────────────────────────────────────────────────

export async function getArticles(filters: ArticleFilters = {}) {
  const where: Record<string, unknown> = {
    deletedAt: null,
  }

  if (filters.type) {
    where.type = filters.type
  }

  if (filters.isPublished !== undefined) {
    where.isPublished = filters.isPublished
  }

  if (filters.assetId) {
    where.assetId = filters.assetId
  }

  if (filters.tags && filters.tags.length > 0) {
    where.tags = { hasSome: filters.tags }
  }

  if (filters.keyword) {
    const kw = filters.keyword.trim()
    where.OR = [
      { title: { contains: kw, mode: 'insensitive' } },
      { content: { contains: kw, mode: 'insensitive' } },
      { tags: { hasSome: [kw] } },
    ]
  }

  return prisma.knowledgeArticle.findMany({
    where,
    select: articleListSelect,
    orderBy: { updatedAt: 'desc' },
  })
}

// ─── getArticleById ───────────────────────────────────────────────────────────

export async function getArticleById(id: string) {
  return prisma.knowledgeArticle.findFirst({
    where: { id, deletedAt: null },
    select: {
      ...articleListSelect,
      // Full content already included in select above
    },
  })
}

// ─── updateArticle ────────────────────────────────────────────────────────────

export async function updateArticle(id: string, input: UpdateArticleInput) {
  const data = UpdateArticleSchema.parse(input)

  const updateData: Record<string, unknown> = {}
  if (data.title !== undefined) updateData.title = data.title
  if (data.type !== undefined) updateData.type = data.type
  if (data.content !== undefined) updateData.content = data.content
  if (data.tags !== undefined) updateData.tags = data.tags
  if (data.assetId !== undefined) updateData.assetId = data.assetId
  if (data.calculatorType !== undefined) updateData.calculatorType = data.calculatorType
  if (data.isPublished !== undefined) updateData.isPublished = data.isPublished

  return prisma.knowledgeArticle.update({
    where: { id },
    data: updateData,
    select: articleListSelect,
  })
}

// ─── deleteArticle ────────────────────────────────────────────────────────────

export async function deleteArticle(id: string) {
  // Soft-delete via the org-scoped client (which converts .delete() → stamp deletedAt)
  return prisma.knowledgeArticle.delete({ where: { id } })
}

// ─── searchArticles ───────────────────────────────────────────────────────────

/**
 * Search articles across title, content, and tags.
 * Title matches are prioritized: title-matching articles come first in results.
 * Returns up to `limit` (default 10) published, non-deleted articles.
 */
export async function searchArticles(query: string, limit = 10) {
  const q = query.trim()
  if (!q) return []

  const [titleMatches, contentMatches] = await Promise.all([
    prisma.knowledgeArticle.findMany({
      where: {
        deletedAt: null,
        isPublished: true,
        title: { contains: q, mode: 'insensitive' },
      },
      select: articleListSelect,
      orderBy: { updatedAt: 'desc' },
      take: limit,
    }),
    prisma.knowledgeArticle.findMany({
      where: {
        deletedAt: null,
        isPublished: true,
        OR: [
          { content: { contains: q, mode: 'insensitive' } },
          { tags: { hasSome: [q] } },
        ],
        // Exclude articles already caught by titleMatches
        NOT: {
          title: { contains: q, mode: 'insensitive' },
        },
      },
      select: articleListSelect,
      orderBy: { updatedAt: 'desc' },
      take: limit,
    }),
  ])

  const combined = [...titleMatches, ...contentMatches]
  return combined.slice(0, limit)
}

// ─── findRelevantArticles ─────────────────────────────────────────────────────

/**
 * Find KB articles relevant to a maintenance ticket using keyword matching.
 * Combines category + title words as search keywords.
 * No Gemini call — pure keyword matching is fast and sufficient.
 * Returns up to 5 published articles.
 */
export async function findRelevantArticles(
  category: string,
  title: string,
  keywords: string[] = []
): Promise<typeof articleListSelect extends object ? Array<Record<string, unknown>> : never> {
  // Build search terms from category, title words, and extra keywords
  const words = [
    ...category.split(/[\s_-]+/).filter(w => w.length > 2),
    ...title.split(/\s+/).filter(w => w.length > 2),
    ...keywords,
  ]

  // Deduplicate and limit
  const uniqueTerms = [...new Set(words.map(w => w.toLowerCase()))].slice(0, 8)

  if (uniqueTerms.length === 0) return [] as never

  const orClauses = uniqueTerms.flatMap(term => [
    { title: { contains: term, mode: 'insensitive' as const } },
    { content: { contains: term, mode: 'insensitive' as const } },
    { tags: { hasSome: [term] } },
  ])

  return prisma.knowledgeArticle.findMany({
    where: {
      deletedAt: null,
      isPublished: true,
      OR: orClauses,
    },
    select: articleListSelect,
    orderBy: { updatedAt: 'desc' },
    take: 5,
  }) as never
}
