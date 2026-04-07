/**
 * Context Assembly Service
 *
 * Assembles the 4-layer personalized context for Leo's system prompt:
 * 1. User profile (response style, tone, frequent topics, domain expertise)
 * 2. Semantically relevant memory facts (based on current message embedding)
 * 3. Recent conversation summaries (for continuity across sessions)
 *
 * This context is injected into the system prompt before each conversation turn,
 * making Leo aware of who the user is and what they care about.
 */

import { rawPrisma } from '@/lib/db'
import { generateEmbedding, searchSimilar } from './embeddingService'
import { logger } from '@/lib/logger'

const log = logger.child({ service: 'contextAssemblyService' })

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssembledContext {
  userProfile: {
    responseLength?: string | null
    tonePreference?: string | null
    frequentTopics: string[]
    domainExpertise: string[]
    communicationStyle?: Record<string, unknown> | null
  } | null
  relevantFacts: Array<{
    factText: string
    category: string | null
    importance: number
  }>
  recentSummaries: Array<{
    summaryText: string
    conversationTitle?: string | null
  }>
}

// ─── Assembly ─────────────────────────────────────────────────────────────────

/**
 * Assemble the full personalized context for a Leo conversation turn.
 * Gracefully degrades: if Gemini API is unavailable, falls back to
 * importance-ranked facts (no semantic search).
 *
 * @param conversationId - Optional active conversation ID. When provided,
 *   the current conversation's summary is prioritized in the L3 layer so
 *   long conversations stay coherent even when the older portion is compressed.
 */
export async function assembleContext(
  userId: string,
  _orgId: string,
  currentMessage: string,
  conversationId?: string
): Promise<AssembledContext> {
  const result: AssembledContext = {
    userProfile: null,
    relevantFacts: [],
    recentSummaries: [],
  }

  // Run all three lookups in parallel, never throw
  const [profileResult, factsResult, summariesResult] = await Promise.allSettled([
    loadUserProfile(userId),
    loadRelevantFacts(userId, currentMessage),
    loadRecentSummaries(userId, conversationId),
  ])

  if (profileResult.status === 'fulfilled') {
    result.userProfile = profileResult.value
  } else {
    log.warn({ userId, error: String(profileResult.reason) }, 'Failed to load user profile')
  }

  if (factsResult.status === 'fulfilled') {
    result.relevantFacts = factsResult.value
  } else {
    log.warn({ userId, error: String(factsResult.reason) }, 'Failed to load relevant facts')
  }

  if (summariesResult.status === 'fulfilled') {
    result.recentSummaries = summariesResult.value
  } else {
    log.warn({
      userId,
      error: String(summariesResult.reason),
    }, 'Failed to load recent summaries')
  }

  return result
}

// ─── Layer: User Profile ──────────────────────────────────────────────────────

async function loadUserProfile(
  userId: string
): Promise<AssembledContext['userProfile']> {
  const profile = await rawPrisma.userAssistantProfile.findUnique({
    where: { userId },
    select: {
      responseLength: true,
      tonePreference: true,
      frequentTopics: true,
      domainExpertise: true,
      communicationStyle: true,
    },
  })

  if (!profile) return null

  return {
    responseLength: profile.responseLength,
    tonePreference: profile.tonePreference,
    frequentTopics: profile.frequentTopics,
    domainExpertise: profile.domainExpertise,
    communicationStyle: profile.communicationStyle as Record<string, unknown> | null,
  }
}

// ─── Layer: Relevant Memory Facts ─────────────────────────────────────────────

async function loadRelevantFacts(
  userId: string,
  currentMessage: string
): Promise<AssembledContext['relevantFacts']> {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY)?.trim()

  if (apiKey && currentMessage.trim()) {
    // Semantic search: generate embedding for current message and find similar facts
    try {
      const queryEmbedding = await generateEmbedding(currentMessage)

      if (queryEmbedding.length > 0) {
        const similar = await searchSimilar('UserMemoryFact', queryEmbedding, {
          limit: 10,
          filters: `"userId" = '${userId.replace(/'/g, "''")}'`,
        })

        if (similar.length > 0) {
          // Fetch full records for matching IDs
          const ids = similar.map(s => s.id)
          const facts = await rawPrisma.userMemoryFact.findMany({
            where: { id: { in: ids }, userId },
            select: { id: true, factText: true, category: true, importance: true },
          })

          // Score by (similarity * importance), take top 5
          const scored = facts
            .map(f => {
              const match = similar.find(s => s.id === f.id)
              const score = (match?.similarity ?? 0) * f.importance
              return { ...f, score }
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)

          return scored.map(f => ({
            factText: f.factText,
            category: f.category,
            importance: f.importance,
          }))
        }
      }
    } catch (err) {
      log.warn({
        userId,
        error: String(err),
      }, 'Semantic fact search failed, falling back to importance rank')
    }
  }

  // Fallback: top 5 facts by importance (no semantic search)
  const topFacts = await rawPrisma.userMemoryFact.findMany({
    where: { userId },
    orderBy: { importance: 'desc' },
    take: 5,
    select: { factText: true, category: true, importance: true },
  })

  return topFacts.map(f => ({
    factText: f.factText,
    category: f.category,
    importance: f.importance,
  }))
}

// ─── Layer: Recent Summaries ──────────────────────────────────────────────────

async function loadRecentSummaries(
  userId: string,
  activeConversationId?: string
): Promise<AssembledContext['recentSummaries']> {
  // If we have an active conversation, prioritize its summary first (most recent),
  // then fill remaining slots from other recent conversations (up to 2 more).
  // This ensures long active conversations stay coherent via their compressed summary.

  const results: AssembledContext['recentSummaries'] = []

  if (activeConversationId) {
    // Fetch the current conversation's most recent summary
    const activeSummary = await rawPrisma.conversationSummary.findFirst({
      where: {
        conversationId: activeConversationId,
        conversation: { userId, deletedAt: null },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        summaryText: true,
        conversation: { select: { title: true } },
      },
    })

    if (activeSummary) {
      results.push({
        summaryText: activeSummary.summaryText,
        conversationTitle: activeSummary.conversation.title,
      })
    }
  }

  // Fill remaining slots with other recent summaries (exclude the active conversation)
  const remainingSlots = 3 - results.length
  if (remainingSlots > 0) {
    const otherSummaries = await rawPrisma.conversationSummary.findMany({
      where: {
        conversation: {
          userId,
          deletedAt: null,
          ...(activeConversationId ? { id: { not: activeConversationId } } : {}),
        },
      },
      orderBy: { createdAt: 'desc' },
      take: remainingSlots,
      select: {
        summaryText: true,
        conversation: { select: { title: true } },
      },
    })

    for (const s of otherSummaries) {
      results.push({
        summaryText: s.summaryText,
        conversationTitle: s.conversation.title,
      })
    }
  }

  return results
}
