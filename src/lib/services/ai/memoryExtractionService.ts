/**
 * Memory Extraction Service
 *
 * Post-conversation pipeline that uses Gemini to extract facts and preferences
 * from completed conversations and stores them as UserMemoryFact records and
 * UserAssistantProfile updates.
 *
 * All operations are fire-and-forget — errors are logged but never thrown.
 */

import { GoogleGenAI } from '@google/genai'
import { rawPrisma } from '@/lib/db'
import { getMessages } from './conversationService'
import { generateAndStoreEmbedding } from './embeddingService'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractedFact {
  text: string
  category: 'preference' | 'pattern' | 'context' | 'instruction'
  importance: number
}

interface ProfileUpdates {
  frequent_topics?: string[]
  common_actions?: string[]
  domain_expertise?: string[]
  tone_preference?: string | null
  response_length?: string | null
  communication_style_notes?: string | null
}

interface GeminiExtractionResult {
  facts: ExtractedFact[]
  profile_updates: ProfileUpdates
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(level: 'info' | 'warn' | 'error', msg: string, data?: Record<string, unknown>) {
  const entry = { service: 'memoryExtractionService', msg, ...data }
  if (level === 'error') console.error(entry)
  else if (level === 'warn') console.warn(entry)
  else console.log(entry)
}

/**
 * Compute rough string overlap ratio between two strings.
 * Used for deduplication — avoids storing semantically identical facts.
 */
function overlapRatio(a: string, b: string): number {
  const aLower = a.toLowerCase()
  const bLower = b.toLowerCase()

  // Simple word overlap
  const aWords = new Set(aLower.split(/\s+/).filter(w => w.length > 3))
  const bWords = new Set(bLower.split(/\s+/).filter(w => w.length > 3))

  if (aWords.size === 0 || bWords.size === 0) return 0

  let intersection = 0
  for (const word of aWords) {
    if (bWords.has(word)) intersection++
  }

  return intersection / Math.max(aWords.size, bWords.size)
}

// ─── Core Extraction ──────────────────────────────────────────────────────────

/**
 * Extract memory facts and profile updates from a completed conversation.
 * Runs as a fire-and-forget background task — never throws.
 */
export async function extractMemoryFromConversation(
  conversationId: string,
  userId: string
): Promise<void> {
  try {
    const apiKey = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY)?.trim()
    if (!apiKey) {
      log('warn', 'Memory extraction skipped — no Gemini API key', { conversationId })
      return
    }

    // 1. Fetch messages
    const allMessages = await getMessages(conversationId, { limit: 100 })

    // 2. Filter to only user + assistant messages
    const dialogMessages = allMessages.filter(
      m => m.role === 'user' || m.role === 'assistant'
    )

    // 3. Skip if fewer than 3 messages (not enough signal)
    if (dialogMessages.length < 3) {
      log('info', 'Memory extraction skipped — too few messages', {
        conversationId,
        messageCount: dialogMessages.length,
      })
      return
    }

    // 4. Build transcript
    const transcript = dialogMessages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n')

    // 5. Call Gemini to extract structured data
    const prompt = `Analyze this conversation between a user and an AI assistant at a school operations platform. Extract the following in JSON format:

{
  "facts": [
    { "text": "specific fact about the user or their work", "category": "preference|pattern|context|instruction", "importance": 0.0-1.0 }
  ],
  "profile_updates": {
    "frequent_topics": ["topic1", "topic2"],
    "common_actions": ["action1"],
    "domain_expertise": ["area1"],
    "tone_preference": "casual|professional|mixed|null",
    "response_length": "short|medium|detailed|null",
    "communication_style_notes": "any notes about how they communicate"
  }
}

Rules:
- Only extract CONCRETE facts, not generic observations
- Facts should be about the user's role, preferences, common tasks, or institutional knowledge
- Importance: 0.9+ for explicit instructions ("always do X"), 0.5-0.8 for preferences, 0.3-0.5 for contextual
- Skip facts that are already obvious from the user's role
- Return empty arrays/null if nothing notable

Conversation:
${transcript}`

    const client = new GoogleGenAI({ apiKey })
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    })

    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    // 6. Parse the response
    let extracted: GeminiExtractionResult
    try {
      extracted = JSON.parse(rawText)
    } catch {
      log('warn', 'Memory extraction: failed to parse Gemini response as JSON', {
        conversationId,
        rawText: rawText.slice(0, 200),
      })
      return
    }

    const facts = extracted?.facts ?? []
    const profileUpdates = extracted?.profile_updates ?? {}

    log('info', 'Memory extraction: extracted facts and profile updates', {
      conversationId,
      userId,
      factCount: facts.length,
    })

    // 7. Store each extracted fact
    for (const fact of facts) {
      if (!fact.text?.trim()) continue

      try {
        // Check for similar existing facts
        const existingFacts = await rawPrisma.userMemoryFact.findMany({
          where: { userId, category: fact.category ?? undefined },
          select: { id: true, factText: true, importance: true },
        })

        const similar = existingFacts.find(
          ef => overlapRatio(ef.factText, fact.text) > 0.8
        )

        if (similar) {
          // Update importance (take higher value)
          const newImportance = Math.max(similar.importance, fact.importance ?? 0.5)
          await rawPrisma.userMemoryFact.update({
            where: { id: similar.id },
            data: { importance: newImportance, updatedAt: new Date() },
          })
        } else {
          // Create new fact
          const created = await rawPrisma.userMemoryFact.create({
            data: {
              userId,
              factText: fact.text,
              category: fact.category ?? null,
              importance: fact.importance ?? 0.5,
              sourceConversationId: conversationId,
            },
            select: { id: true },
          })

          // Generate and store embedding for semantic search
          void generateAndStoreEmbedding('UserMemoryFact', created.id, fact.text)
        }
      } catch (factErr) {
        log('error', 'Memory extraction: error storing fact', {
          conversationId,
          userId,
          factText: fact.text,
          error: String(factErr),
        })
      }
    }

    // 8. Update user profile
    await updateUserProfile(userId, profileUpdates)

    log('info', 'Memory extraction: complete', { conversationId, userId })
  } catch (err) {
    log('error', 'Memory extraction: unhandled error', {
      conversationId,
      userId,
      error: String(err),
    })
  }
}

// ─── Profile Update ───────────────────────────────────────────────────────────

/**
 * Upsert the user's assistant profile with learned preferences.
 * Array fields are merged and deduplicated; scalar fields only overwrite if non-null.
 */
export async function updateUserProfile(
  userId: string,
  updates: ProfileUpdates
): Promise<void> {
  try {
    const existing = await rawPrisma.userAssistantProfile.findUnique({
      where: { userId },
      select: {
        frequentTopics: true,
        commonActions: true,
        domainExpertise: true,
        conversationCount: true,
      },
    })

    // Merge array fields (keep most recent 20 items)
    const mergeArrays = (existing: string[], incoming: string[] | undefined): string[] => {
      if (!incoming || incoming.length === 0) return existing
      const merged = [...new Set([...existing, ...incoming])]
      return merged.slice(-20)
    }

    const frequentTopics = mergeArrays(
      existing?.frequentTopics ?? [],
      updates.frequent_topics
    )
    const commonActions = mergeArrays(
      existing?.commonActions ?? [],
      updates.common_actions
    )
    const domainExpertise = mergeArrays(
      existing?.domainExpertise ?? [],
      updates.domain_expertise
    )

    const updateData: Record<string, unknown> = {
      frequentTopics,
      commonActions,
      domainExpertise,
      conversationCount: (existing?.conversationCount ?? 0) + 1,
      lastUpdated: new Date(),
    }

    // Only overwrite scalar fields if non-null
    if (updates.tone_preference != null) {
      updateData.tonePreference = updates.tone_preference
    }
    if (updates.response_length != null) {
      updateData.responseLength = updates.response_length
    }
    if (updates.communication_style_notes != null) {
      updateData.communicationStyle = { notes: updates.communication_style_notes }
    }

    await rawPrisma.userAssistantProfile.upsert({
      where: { userId },
      create: {
        userId,
        frequentTopics,
        commonActions,
        domainExpertise,
        tonePreference: updates.tone_preference ?? null,
        responseLength: updates.response_length ?? null,
        communicationStyle: updates.communication_style_notes
          ? { notes: updates.communication_style_notes }
          : undefined,
        conversationCount: 1,
        lastUpdated: new Date(),
      },
      update: updateData,
    })

    log('info', 'User profile updated', { userId })
  } catch (err) {
    log('error', 'updateUserProfile: error', { userId, error: String(err) })
  }
}

// ─── Decay ────────────────────────────────────────────────────────────────────

/**
 * Reduce importance of all UserMemoryFacts by 5% over time.
 * Facts below 0.1 importance can be pruned in a future cleanup job.
 * Utility for future scheduled use — not called automatically.
 */
export async function decayMemoryImportance(userId: string): Promise<void> {
  try {
    await rawPrisma.$executeRawUnsafe(
      'UPDATE "UserMemoryFact" SET importance = importance * 0.95 WHERE "userId" = $1 AND importance > 0.1',
      userId
    )
    log('info', 'Memory importance decayed', { userId })
  } catch (err) {
    log('error', 'decayMemoryImportance: error', { userId, error: String(err) })
  }
}
