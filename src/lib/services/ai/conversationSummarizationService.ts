/**
 * Conversation Summarization Service
 *
 * Automatically compresses long conversations (20+ messages) into
 * ConversationSummary records for efficient context window usage.
 *
 * Summarization is fire-and-forget — errors are logged but never thrown.
 * The chat route triggers this check after each response.
 */

import { GoogleGenAI } from '@google/genai'
import { rawPrisma } from '@/lib/db'
import { getMessages } from './conversationService'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(level: 'info' | 'warn' | 'error', msg: string, data?: Record<string, unknown>) {
  const entry = { service: 'conversationSummarizationService', msg, ...data }
  if (level === 'error') console.error(entry)
  else if (level === 'warn') console.warn(entry)
  else console.log(entry)
}

/**
 * Rough token estimate: 4 characters ≈ 1 token (good enough for budgeting).
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}

// ─── Threshold Logic ──────────────────────────────────────────────────────────

/**
 * Determine whether a conversation should be summarized.
 *
 * Returns true if:
 * - The conversation has 20 or more messages, AND
 * - No summary exists, OR the most recent summary covers fewer than
 *   (current count - 10) messages (i.e., 10+ new messages since last summary)
 *
 * The -10 buffer prevents re-summarizing after every single new message.
 */
export async function shouldSummarize(conversationId: string): Promise<boolean> {
  try {
    const messageCount = await rawPrisma.conversationMessage.count({
      where: { conversationId },
    })

    if (messageCount < 20) return false

    // Check for existing summaries
    const latestSummary = await rawPrisma.conversationSummary.findFirst({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      select: { messageCount: true },
    })

    if (!latestSummary) {
      // No summary yet and we have 20+ messages — summarize
      return true
    }

    // Re-summarize only if 10+ new messages have arrived since last summary
    return latestSummary.messageCount < messageCount - 10
  } catch (err) {
    log('warn', 'shouldSummarize: error checking threshold', {
      conversationId,
      error: String(err),
    })
    return false
  }
}

// ─── Core Summarization ───────────────────────────────────────────────────────

/**
 * Summarize a long conversation using Gemini.
 *
 * Compresses the older 75% of messages into a ConversationSummary record.
 * The most recent 25% remain as verbatim context for Leo.
 *
 * All errors are caught and logged — never thrown to the caller.
 */
export async function summarizeConversation(conversationId: string): Promise<void> {
  try {
    const apiKey = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY)?.trim()
    if (!apiKey) {
      log('warn', 'Summarization skipped — no Gemini API key', { conversationId })
      return
    }

    // 1. Fetch all messages (up to 200)
    const allMessages = await getMessages(conversationId, { limit: 200 })

    // Filter to only dialog messages (user + assistant)
    const dialogMessages = allMessages.filter(
      m => m.role === 'user' || m.role === 'assistant'
    )

    if (dialogMessages.length < 20) {
      log('info', 'Summarization skipped — not enough dialog messages', {
        conversationId,
        dialogMessageCount: dialogMessages.length,
      })
      return
    }

    // 2. Separate into old (first 75%) and recent (last 25%)
    const splitPoint = Math.floor(dialogMessages.length * 0.75)
    const oldMessages = dialogMessages.slice(0, splitPoint)
    const recentMessages = dialogMessages.slice(splitPoint)

    if (oldMessages.length === 0) {
      log('info', 'Summarization skipped — no old messages to summarize', { conversationId })
      return
    }

    log('info', 'Starting conversation summarization', {
      conversationId,
      totalDialogMessages: dialogMessages.length,
      oldMessageCount: oldMessages.length,
      recentMessageCount: recentMessages.length,
    })

    // 3. Build transcript of OLD messages only
    const transcript = oldMessages
      .map(m => `${m.role === 'user' ? 'User' : 'Leo'}: ${m.content}`)
      .join('\n')

    // 4. Call Gemini to summarize
    const prompt = `Summarize this conversation between a user and Leo (an AI assistant at a school operations platform). Focus on:
1. Key topics discussed
2. Decisions made or actions taken
3. Important context or facts mentioned
4. Any unresolved questions or pending items

Keep the summary concise (200-300 words). Write in third person: "The user asked about..." not "You asked about..."

Conversation:
${transcript}`

    const client = new GoogleGenAI({ apiKey })
    const response = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    })

    const summaryText = response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    if (!summaryText.trim()) {
      log('warn', 'Summarization: Gemini returned empty summary', { conversationId })
      return
    }

    // 5. Persist the summary
    await rawPrisma.conversationSummary.create({
      data: {
        conversationId,
        summaryText: summaryText.trim(),
        messageCount: oldMessages.length,
        tokenCount: estimateTokenCount(summaryText),
      },
    })

    log('info', 'Conversation summarized successfully', {
      conversationId,
      oldMessageCount: oldMessages.length,
      summaryLength: summaryText.length,
      estimatedTokens: estimateTokenCount(summaryText),
    })
  } catch (err) {
    log('error', 'summarizeConversation: unhandled error', {
      conversationId,
      error: String(err),
    })
  }
}
