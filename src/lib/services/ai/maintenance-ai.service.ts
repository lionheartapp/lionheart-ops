/**
 * Maintenance AI Service — Anthropic Claude Vision
 *
 * Wraps the Anthropic SDK for two maintenance-specific use cases:
 *   1. analyzeMaintenancePhotos — Vision-based diagnosis with tools, parts, and steps
 *   2. askMaintenanceAI — Free-form follow-up questions with conversation history
 *
 * Uses claude-sonnet-4-5 (pinned per project decision in STATE.md).
 * Gracefully returns null on any API or parse failure.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { AiDiagnosis, AiConversationTurn } from '@/lib/types/maintenance-ai'

// ─── Client ───────────────────────────────────────────────────────────────────

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return null
  return new Anthropic({ apiKey })
}

// ─── Model ────────────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-5-20241022'

// ─── Prompts ──────────────────────────────────────────────────────────────────

function buildDiagnosticPrompt(category: string, title: string, description?: string | null): string {
  return `You are an expert school facilities maintenance technician analyzing photos to diagnose a maintenance issue.

Ticket Information:
- Category: ${category}
- Title: ${title}
${description ? `- Description: ${description}` : ''}

Analyze the provided photo(s) and return a JSON object with the following fields:
- likelyDiagnosis (string): A clear, concise diagnosis of the problem visible in the photos
- confidence (string): Your confidence level based on photo clarity and issue visibility — must be exactly "LOW", "MEDIUM", or "HIGH"
- confidenceReason (string): A brief explanation of why you assigned that confidence level (e.g., "Photo clearly shows the broken component" or "Image is blurry, limiting assessment")
- suggestedTools (string[]): List of specific tools needed for the repair (e.g., ["Flathead screwdriver", "Multimeter", "Wire nuts"])
- suggestedParts (string[]): List of parts or supplies likely needed (e.g., ["GFCI outlet 15A", "Electrical tape", "Junction box"])
- steps (string[]): Step-by-step repair instructions (numbered steps as separate strings)

Confidence guidelines:
- HIGH: Issue is clearly visible, cause is obvious, repair is straightforward
- MEDIUM: Issue is visible but cause may have multiple explanations, or photos are somewhat unclear
- LOW: Photos are unclear, blurry, or don't show the actual problem clearly

Return ONLY valid JSON with no markdown code blocks, no explanation, no preamble.`
}

function buildConversationMessages(
  question: string,
  ticketContext: { category: string; title: string; description?: string | null; photos: string[] },
  conversationHistory: AiConversationTurn[]
): Anthropic.MessageParam[] {
  // Build initial context message
  const contextText = `You are an expert school facilities maintenance technician helping diagnose and resolve a maintenance issue.

Ticket Information:
- Category: ${ticketContext.category}
- Title: ${ticketContext.title}
${ticketContext.description ? `- Description: ${ticketContext.description}` : ''}
${ticketContext.photos.length > 0 ? `- Number of photos on ticket: ${ticketContext.photos.length}` : '- No photos attached to this ticket'}

Answer questions clearly and practically. Focus on actionable advice for school maintenance staff.`

  const messages: Anthropic.MessageParam[] = []

  // Add conversation history
  for (const turn of conversationHistory) {
    messages.push({
      role: turn.role,
      content: turn.content,
    })
  }

  // Add current question (with context if this is the first message)
  if (conversationHistory.length === 0) {
    // First message — include full context
    const contentParts: Anthropic.ContentBlockParam[] = [
      { type: 'text', text: contextText + '\n\nUser question: ' + question },
    ]

    // Include photos if available (first question gets visual context)
    if (ticketContext.photos.length > 0) {
      const imageBlocks: Anthropic.ContentBlockParam[] = ticketContext.photos.slice(0, 3).map((url) => ({
        type: 'image' as const,
        source: {
          type: 'url' as const,
          url,
        },
      }))
      messages.push({
        role: 'user',
        content: [...imageBlocks, ...contentParts],
      })
    } else {
      messages.push({
        role: 'user',
        content: contentParts,
      })
    }
  } else {
    // Follow-up message — just the question
    messages.push({
      role: 'user',
      content: question,
    })
  }

  return messages
}

// ─── analyzeMaintenancePhotos ─────────────────────────────────────────────────

interface AnalyzePhotosParams {
  photoUrls: string[]
  category: string
  title: string
  description?: string | null
}

export async function analyzeMaintenancePhotos(params: AnalyzePhotosParams): Promise<AiDiagnosis | null> {
  const client = getClient()
  if (!client) return null

  const { photoUrls, category, title, description } = params

  try {
    // Build content array: images first, then diagnostic prompt
    const imageBlocks: Anthropic.ContentBlockParam[] = photoUrls.map((url) => ({
      type: 'image' as const,
      source: {
        type: 'url' as const,
        url,
      },
    }))

    const textBlock: Anthropic.ContentBlockParam = {
      type: 'text',
      text: buildDiagnosticPrompt(category, title, description),
    }

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [...imageBlocks, textBlock],
        },
      ],
    })

    // Extract text content from response
    const textContent = response.content.find((block) => block.type === 'text')
    if (!textContent || textContent.type !== 'text') return null

    const raw = textContent.text.trim()

    // Strip any accidental markdown code fences
    const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    const parsed = JSON.parse(jsonText) as {
      likelyDiagnosis?: unknown
      confidence?: unknown
      confidenceReason?: unknown
      suggestedTools?: unknown
      suggestedParts?: unknown
      steps?: unknown
    }

    // Validate structure
    if (
      typeof parsed.likelyDiagnosis !== 'string' ||
      !['LOW', 'MEDIUM', 'HIGH'].includes(parsed.confidence as string) ||
      typeof parsed.confidenceReason !== 'string' ||
      !Array.isArray(parsed.suggestedTools) ||
      !Array.isArray(parsed.suggestedParts) ||
      !Array.isArray(parsed.steps)
    ) {
      console.error('[maintenance-ai] Invalid response structure from Claude:', parsed)
      return null
    }

    return {
      likelyDiagnosis: parsed.likelyDiagnosis,
      confidence: parsed.confidence as 'LOW' | 'MEDIUM' | 'HIGH',
      confidenceReason: parsed.confidenceReason,
      suggestedTools: (parsed.suggestedTools as unknown[]).filter((t): t is string => typeof t === 'string'),
      suggestedParts: (parsed.suggestedParts as unknown[]).filter((p): p is string => typeof p === 'string'),
      steps: (parsed.steps as unknown[]).filter((s): s is string => typeof s === 'string'),
      analyzedPhotoCount: photoUrls.length,
      analyzedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error('[maintenance-ai] analyzeMaintenancePhotos error:', error)
    return null
  }
}

// ─── askMaintenanceAI ─────────────────────────────────────────────────────────

interface AskMaintenanceAIParams {
  question: string
  ticketContext: {
    category: string
    title: string
    description?: string | null
    photos: string[]
  }
  conversationHistory: AiConversationTurn[]
}

export async function askMaintenanceAI(params: AskMaintenanceAIParams): Promise<string | null> {
  const client = getClient()
  if (!client) return null

  const { question, ticketContext, conversationHistory } = params

  try {
    const messages = buildConversationMessages(question, ticketContext, conversationHistory)

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages,
    })

    const textContent = response.content.find((block) => block.type === 'text')
    if (!textContent || textContent.type !== 'text') return null

    return textContent.text.trim() || null
  } catch (error) {
    console.error('[maintenance-ai] askMaintenanceAI error:', error)
    return null
  }
}
