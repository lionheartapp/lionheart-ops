/**
 * AI Assistant — Knowledge Base Domain Tools
 *
 * Read-only tools for searching and retrieving knowledge base articles.
 */

import { registerTools, type ToolRegistryEntry } from './_registry'
import { PERMISSIONS } from '@/lib/permissions'
import { searchArticles, getArticleById, getArticles } from '@/lib/services/knowledgeBaseService'
import type { KnowledgeArticleType } from '@prisma/client'

const VALID_TYPES: KnowledgeArticleType[] = [
  'EQUIPMENT_GUIDE', 'PROCEDURE_SOP', 'CALCULATION_TOOL',
  'SAFETY_PROTOCOL', 'VENDOR_CONTACT', 'ASSET_NOTE',
]

const tools: Record<string, ToolRegistryEntry> = {
  // ── GREEN: Search Knowledge Base ────────────────────────────────────────
  search_knowledge_base: {
    definition: {
      name: 'search_knowledge_base',
      description:
        'Search the knowledge base for articles, SOPs, equipment guides, safety protocols, and vendor contacts. Returns title, type, tags, and a content preview. Use this when users ask "how do I...", "what\'s the procedure for...", or need reference material.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search keywords (e.g. "AV setup", "fire drill procedure", "HVAC filter")' },
          type: {
            type: 'string',
            description: 'Filter by article type (optional): EQUIPMENT_GUIDE, PROCEDURE_SOP, CALCULATION_TOOL, SAFETY_PROTOCOL, VENDOR_CONTACT, ASSET_NOTE',
          },
          limit: { type: 'number', description: 'Max results to return (default: 10, max: 25)' },
        },
        required: ['query'],
      },
    },
    requiredPermission: PERMISSIONS.KB_READ,
    riskTier: 'GREEN',
    execute: async (input) => {
      const query = String(input.query || '').trim()
      if (!query) return JSON.stringify({ error: 'A search query is required.' })

      const limit = Math.min((input.limit as number) || 10, 25)
      const typeFilter = input.type ? String(input.type).toUpperCase() : undefined

      let articles: any[]

      if (typeFilter && VALID_TYPES.includes(typeFilter as KnowledgeArticleType)) {
        // Use getArticles with keyword + type filter
        articles = await getArticles({
          keyword: query,
          type: typeFilter as KnowledgeArticleType,
          isPublished: true,
        })
        articles = articles.slice(0, limit)
      } else {
        // Use full-text search (title-priority)
        articles = await searchArticles(query, limit)
      }

      return JSON.stringify({
        articles: articles.map((a: any) => ({
          id: a.id,
          title: a.title,
          type: a.type,
          tags: a.tags || [],
          preview: a.content ? a.content.slice(0, 500) + (a.content.length > 500 ? '...' : '') : '',
          author: a.createdBy
            ? `${a.createdBy.firstName || ''} ${a.createdBy.lastName || ''}`.trim()
            : undefined,
          updatedAt: a.updatedAt,
        })),
        count: articles.length,
        query,
      })
    },
  },

  // ── GREEN: Get Knowledge Article ────────────────────────────────────────
  get_knowledge_article: {
    definition: {
      name: 'get_knowledge_article',
      description:
        'Get the full content of a specific knowledge base article by ID. Use after search_knowledge_base to retrieve the complete article.',
      parameters: {
        type: 'object',
        properties: {
          article_id: { type: 'string', description: 'The article ID to retrieve' },
        },
        required: ['article_id'],
      },
    },
    requiredPermission: PERMISSIONS.KB_READ,
    riskTier: 'GREEN',
    execute: async (input) => {
      const articleId = String(input.article_id || '').trim()
      if (!articleId) return JSON.stringify({ error: 'article_id is required.' })

      const article = await getArticleById(articleId)
      if (!article) return JSON.stringify({ error: `Article not found: ${articleId}` })

      return JSON.stringify({
        id: article.id,
        title: article.title,
        type: article.type,
        content: article.content,
        tags: article.tags || [],
        author: article.createdBy
          ? `${(article.createdBy as any).firstName || ''} ${(article.createdBy as any).lastName || ''}`.trim()
          : undefined,
        asset: article.asset
          ? { name: (article.asset as any).name, assetNumber: (article.asset as any).assetNumber }
          : undefined,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
      })
    },
  },
}

registerTools(tools)
