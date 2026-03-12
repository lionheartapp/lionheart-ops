/**
 * AI Assistant — Memory & Recall Domain Tools
 *
 * Provides semantic search over organizational history:
 *   - recall_context: search tickets, events, inventory, and conversations
 *     using vector similarity (pgvector + Gemini embeddings)
 */

import { registerTools, type ToolRegistryEntry } from './_registry'
import { generateEmbedding, searchSimilar } from '../embeddingService'
import { rawPrisma } from '@/lib/db'

// ─── Time-range helper ────────────────────────────────────────────────────────

function getCutoffDate(timeRange: string): Date | null {
  const now = new Date()
  switch (timeRange) {
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case 'quarter':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    case 'year':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    default:
      return null
  }
}

// ─── Tool ─────────────────────────────────────────────────────────────────────

const tools: Record<string, ToolRegistryEntry> = {
  recall_context: {
    definition: {
      name: 'recall_context',
      description:
        "Search organizational history using semantic similarity. Use this when the user asks about past events, previous tickets, patterns, or \"what happened last time\". Returns the most relevant records from the organization's data.",
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query describing what to find',
          },
          search_scope: {
            type: 'string',
            enum: ['tickets', 'events', 'inventory', 'conversations', 'all'],
            description: 'Which data to search. Default: all',
          },
          time_range: {
            type: 'string',
            enum: ['week', 'month', 'quarter', 'year', 'all'],
            description: 'How far back to search. Default: all',
          },
          limit: {
            type: 'number',
            description: 'Max results to return. Default: 5',
          },
        },
        required: ['query'],
      },
    },
    requiredPermission: null,
    riskTier: 'GREEN',
    execute: async (input, ctx) => {
      const query = String(input.query || '').trim()
      const scope = (input.search_scope as string) || 'all'
      const timeRange = (input.time_range as string) || 'all'
      const limit = Math.min((input.limit as number) || 5, 20)

      if (!query) {
        return JSON.stringify({ error: 'Query is required' })
      }

      // Generate embedding for the search query
      const queryVec = await generateEmbedding(query)
      if (queryVec.length === 0) {
        return JSON.stringify({
          error: 'Semantic search unavailable — GEMINI_API_KEY not configured',
        })
      }

      // Build time-range filter SQL fragment
      const cutoff = getCutoffDate(timeRange)
      const timeFilter = cutoff
        ? `"createdAt" > '${cutoff.toISOString()}'`
        : undefined

      // Search across requested scopes in parallel
      const searchPromises: Array<Promise<Array<{ id: string; similarity: number; _type: string }>>> = []

      if (scope === 'tickets' || scope === 'all') {
        searchPromises.push(
          searchSimilar('Ticket', queryVec, {
            limit,
            orgId: ctx.organizationId,
            filters: timeFilter,
          }).then((rows) => rows.map((r) => ({ ...r, _type: 'ticket' })))
        )
      }

      if (scope === 'events' || scope === 'all') {
        searchPromises.push(
          searchSimilar('CalendarEvent', queryVec, {
            limit,
            orgId: ctx.organizationId,
            filters: timeFilter,
          }).then((rows) => rows.map((r) => ({ ...r, _type: 'event' })))
        )
      }

      if (scope === 'inventory' || scope === 'all') {
        searchPromises.push(
          searchSimilar('InventoryItem', queryVec, {
            limit,
            orgId: ctx.organizationId,
            filters: timeFilter,
          }).then((rows) => rows.map((r) => ({ ...r, _type: 'inventory' })))
        )
      }

      if (scope === 'conversations' || scope === 'all') {
        searchPromises.push(
          searchSimilar('ConversationMessage', queryVec, {
            limit,
            orgId: ctx.organizationId,
            filters: timeFilter,
          }).then((rows) => rows.map((r) => ({ ...r, _type: 'conversation' })))
        )
      }

      const searchResults = await Promise.allSettled(searchPromises)

      // Merge, dedupe, sort by similarity, take top N
      const merged: Array<{ id: string; similarity: number; _type: string }> = []
      for (const result of searchResults) {
        if (result.status === 'fulfilled') {
          merged.push(...result.value)
        }
      }

      const sorted = merged.sort((a, b) => b.similarity - a.similarity).slice(0, limit)

      if (sorted.length === 0) {
        return JSON.stringify({ results: [], total: 0, scope, message: 'No matching records found' })
      }

      // Fetch full record details for each result
      const enriched = await Promise.allSettled(
        sorted.map(async (match) => {
          try {
            if (match._type === 'ticket') {
              const ticket = await rawPrisma.ticket.findUnique({
                where: { id: match.id },
                select: {
                  id: true,
                  title: true,
                  description: true,
                  status: true,
                  category: true,
                  priority: true,
                  createdAt: true,
                },
              })
              if (!ticket) return null
              return {
                type: 'ticket',
                similarity: Math.round(match.similarity * 100) / 100,
                id: ticket.id,
                title: ticket.title,
                description: ticket.description,
                status: ticket.status,
                category: ticket.category,
                priority: ticket.priority,
                createdAt: ticket.createdAt,
              }
            }

            if (match._type === 'event') {
              const event = await rawPrisma.calendarEvent.findUnique({
                where: { id: match.id },
                select: {
                  id: true,
                  title: true,
                  description: true,
                  startTime: true,
                  locationText: true,
                },
              })
              if (!event) return null
              return {
                type: 'calendar_event',
                similarity: Math.round(match.similarity * 100) / 100,
                id: event.id,
                title: event.title,
                description: event.description,
                startTime: event.startTime,
                locationText: event.locationText,
              }
            }

            if (match._type === 'inventory') {
              const item = await rawPrisma.inventoryItem.findUnique({
                where: { id: match.id },
                select: {
                  id: true,
                  name: true,
                  description: true,
                  category: true,
                  quantityOnHand: true,
                },
              })
              if (!item) return null
              return {
                type: 'inventory_item',
                similarity: Math.round(match.similarity * 100) / 100,
                id: item.id,
                name: item.name,
                description: item.description,
                category: item.category,
                quantityOnHand: item.quantityOnHand,
              }
            }

            if (match._type === 'conversation') {
              const message = await rawPrisma.conversationMessage.findUnique({
                where: { id: match.id },
                select: {
                  id: true,
                  content: true,
                  role: true,
                  createdAt: true,
                  conversation: {
                    select: { id: true, title: true },
                  },
                },
              })
              if (!message) return null
              return {
                type: 'conversation_message',
                similarity: Math.round(match.similarity * 100) / 100,
                id: message.id,
                content: message.content.slice(0, 300), // truncate for brevity
                role: message.role,
                createdAt: message.createdAt,
                conversationId: message.conversation?.id,
                conversationTitle: message.conversation?.title,
              }
            }

            return null
          } catch {
            return null
          }
        })
      )

      const results = enriched
        .filter((r) => r.status === 'fulfilled' && r.value !== null)
        .map((r) => (r as PromiseFulfilledResult<unknown>).value)

      return JSON.stringify({
        results,
        total: results.length,
        scope,
        time_range: timeRange,
      })
    },
  },
}

registerTools(tools)
