/**
 * Maintenance AI Service — Google Gemini Vision
 *
 * Wraps the Google GenAI SDK for two maintenance-specific use cases:
 *   1. analyzeMaintenancePhotos — Vision-based diagnosis with tools, parts, and steps
 *   2. askMaintenanceAI — Free-form follow-up questions with conversation history
 *
 * Uses gemini-2.5-flash model.
 * Gracefully returns null on any API or parse failure.
 */

import type { AiDiagnosis, AiConversationTurn } from '@/lib/types/maintenance-ai'
import { logger } from '@/lib/logger'
import { getMaintenanceSafetyGuidance } from '@/lib/maintenance-safety'


const log = logger.child({ service: 'maintenanceAIService' })
// ─── Client ───────────────────────────────────────────────────────────────────

function getApiKey(): string | null {
  return (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY)?.trim() || null
}

// ─── Model ────────────────────────────────────────────────────────────────────

const MODEL = 'gemini-2.5-flash'

// ─── Prompts ──────────────────────────────────────────────────────────────────

function buildDiagnosticPrompt(category: string, title: string, description?: string | null): string {
  const safety = getMaintenanceSafetyGuidance(category)
  return `You are an expert school facilities maintenance technician analyzing photos to diagnose a maintenance issue.

Ticket Information:
- Category: ${category}
- Title: ${title}
${description ? `- Description: ${description}` : ''}

Safety baseline for this category:
- PPE: ${safety.ppe.join('; ')}
- Safety steps: ${safety.steps.join('; ')}
- Stop/escalate if: ${safety.stopConditions.join('; ')}
- Note: ${safety.note}

Analyze the provided photo(s) and return a JSON object with the following fields:
- likelyDiagnosis (string): A clear, concise diagnosis of the problem visible in the photos
- confidence (string): Your confidence level based on photo clarity and issue visibility — must be exactly "LOW", "MEDIUM", or "HIGH"
- confidenceReason (string): A brief explanation of why you assigned that confidence level (e.g., "Photo clearly shows the broken component" or "Image is blurry, limiting assessment")
- suggestedTools (string[]): List of specific tools needed for the repair (e.g., ["Flathead screwdriver", "Multimeter", "Wire nuts"])
- suggestedParts (string[]): List of parts or supplies likely needed (e.g., ["GFCI outlet 15A", "Electrical tape", "Junction box"])
- ppe (string[]): PPE to verify before starting. Use the safety baseline and task context.
- safetyReminders (string[]): Practical safety reminders for this specific ticket.
- stopConditions (string[]): Conditions where staff should stop and escalate to a supervisor, licensed contractor, or qualified specialist.
- steps (string[]): Step-by-step repair instructions (numbered steps as separate strings)

Confidence guidelines:
- HIGH: Issue is clearly visible, cause is obvious, repair is straightforward
- MEDIUM: Issue is visible but cause may have multiple explanations, or photos are somewhat unclear
- LOW: Photos are unclear, blurry, or don't show the actual problem clearly

Safety rules:
- Do not instruct staff to perform work that requires a license, specialized certification, energized electrical work, refrigerant handling, hazardous material abatement, or chemical application outside label directions.
- If the task appears dangerous, include that in stopConditions instead of giving risky repair steps.
- Keep guidance practical and conservative for school facilities staff.

Return ONLY valid JSON with no markdown code blocks, no explanation, no preamble.`
}

// ─── analyzeMaintenancePhotos ─────────────────────────────────────────────────

interface AnalyzePhotosParams {
  photoUrls: string[]
  category: string
  title: string
  description?: string | null
}

export async function analyzeMaintenancePhotos(params: AnalyzePhotosParams): Promise<AiDiagnosis | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null

  const { photoUrls, category, title, description } = params

  try {
    const { GoogleGenAI } = await import('@google/genai')
    const client = new GoogleGenAI({ apiKey })

    // Build content parts: images first, then diagnostic prompt
    const parts: any[] = []

    // For URL-based images, we need to fetch them and convert to inline data
    for (const url of photoUrls) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
        if (response.ok) {
          const buffer = await response.arrayBuffer()
          const base64 = Buffer.from(buffer).toString('base64')
          const contentType = response.headers.get('content-type') || 'image/jpeg'
          parts.push({
            inlineData: {
              data: base64,
              mimeType: contentType,
            },
          })
        }
      } catch {
        // Skip images that fail to fetch
        log.warn({ url }, 'Failed to fetch image')
      }
    }

    if (parts.length === 0) {
      log.warn('No images could be fetched for analysis')
      return null
    }

    parts.push({ text: buildDiagnosticPrompt(category, title, description) })

    const result = await client.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts }],
    })

    const raw = (result.text || '').trim()

    // Strip any accidental markdown code fences
    const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    const parsed = JSON.parse(jsonText) as {
      likelyDiagnosis?: unknown
      confidence?: unknown
      confidenceReason?: unknown
      suggestedTools?: unknown
      suggestedParts?: unknown
      ppe?: unknown
      safetyReminders?: unknown
      stopConditions?: unknown
      steps?: unknown
    }

    // Validate structure
    if (
      typeof parsed.likelyDiagnosis !== 'string' ||
      !['LOW', 'MEDIUM', 'HIGH'].includes(parsed.confidence as string) ||
      typeof parsed.confidenceReason !== 'string' ||
      !Array.isArray(parsed.suggestedTools) ||
      !Array.isArray(parsed.suggestedParts) ||
      !Array.isArray(parsed.ppe) ||
      !Array.isArray(parsed.safetyReminders) ||
      !Array.isArray(parsed.stopConditions) ||
      !Array.isArray(parsed.steps)
    ) {
      log.error({ parsed }, 'Invalid response structure from Gemini')
      return null
    }

    return {
      likelyDiagnosis: parsed.likelyDiagnosis,
      confidence: parsed.confidence as 'LOW' | 'MEDIUM' | 'HIGH',
      confidenceReason: parsed.confidenceReason,
      suggestedTools: (parsed.suggestedTools as unknown[]).filter((t): t is string => typeof t === 'string'),
      suggestedParts: (parsed.suggestedParts as unknown[]).filter((p): p is string => typeof p === 'string'),
      ppe: (parsed.ppe as unknown[]).filter((p): p is string => typeof p === 'string'),
      safetyReminders: (parsed.safetyReminders as unknown[]).filter((s): s is string => typeof s === 'string'),
      stopConditions: (parsed.stopConditions as unknown[]).filter((s): s is string => typeof s === 'string'),
      steps: (parsed.steps as unknown[]).filter((s): s is string => typeof s === 'string'),
      analyzedPhotoCount: photoUrls.length,
      analyzedAt: new Date().toISOString(),
    }
  } catch (error) {
    log.error({ err: String(error) }, 'analyzeMaintenancePhotos error')
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
  const apiKey = getApiKey()
  if (!apiKey) return null

  const { question, ticketContext, conversationHistory } = params
  const safety = getMaintenanceSafetyGuidance(ticketContext.category)

  try {
    const { GoogleGenAI } = await import('@google/genai')
    const client = new GoogleGenAI({ apiKey })

    const contextText = `You are an expert school facilities maintenance technician helping diagnose and resolve a maintenance issue.

Ticket Information:
- Category: ${ticketContext.category}
- Title: ${ticketContext.title}
${ticketContext.description ? `- Description: ${ticketContext.description}` : ''}
${ticketContext.photos.length > 0 ? `- Number of photos on ticket: ${ticketContext.photos.length}` : '- No photos attached to this ticket'}

Safety baseline:
- PPE: ${safety.ppe.join('; ')}
- Safety steps: ${safety.steps.join('; ')}
- Stop/escalate if: ${safety.stopConditions.join('; ')}
- Note: ${safety.note}

Answer questions clearly and practically. Focus on actionable advice for school maintenance staff.

Safety rules:
- Treat your answer as guidance, not authorization.
- Do not tell staff to do licensed electrical work, energized work, refrigerant handling, hazardous material abatement, or chemical dosing outside the product label.
- For biohazard, sewage, unknown contamination, electrical hazards, structural hazards, or chemical uncertainty, explain what to verify and when to escalate.
- Include PPE and stop/escalate guidance whenever safety is relevant.`

    // Build Gemini-format conversation contents
    const contents: any[] = []

    // Add conversation history
    for (const turn of conversationHistory) {
      contents.push({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.content }],
      })
    }

    // Build the current message
    if (conversationHistory.length === 0) {
      // First message — include full context and photos
      const parts: any[] = []

      // Include photos if available (first question gets visual context)
      if (ticketContext.photos.length > 0) {
        for (const url of ticketContext.photos.slice(0, 3)) {
          try {
            const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
            if (response.ok) {
              const buffer = await response.arrayBuffer()
              const base64 = Buffer.from(buffer).toString('base64')
              const contentType = response.headers.get('content-type') || 'image/jpeg'
              parts.push({
                inlineData: { data: base64, mimeType: contentType },
              })
            }
          } catch {
            // Skip failed images
          }
        }
      }

      parts.push({ text: contextText + '\n\nUser question: ' + question })
      contents.push({ role: 'user', parts })
    } else {
      // Follow-up message — just the question
      contents.push({
        role: 'user',
        parts: [{ text: question }],
      })
    }

    const result = await client.models.generateContent({
      model: MODEL,
      contents,
    })

    return (result.text || '').trim() || null
  } catch (error) {
    log.error({ err: String(error) }, 'askMaintenanceAI error')
    return null
  }
}
