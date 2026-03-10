/**
 * Event AI Service — Anthropic Claude
 *
 * Handles AI-powered event operations:
 *   - parseEventFromText: Natural language → structured event fields
 *   - generateEventDescription: Title → professional description
 *   - patchDraftFromText: Extract structured hints from requests
 *
 * Migrated from Google Gemini to Anthropic Claude.
 * Retains the same exported interface for backward compatibility.
 */

import { claudeTextCompletion, extractJson } from './claude-client'

export interface ParsedEvent {
  title?: string
  description?: string
  startDate?: string
  startTime?: string
  endDate?: string
  endTime?: string
  isAllDay?: boolean
  locationText?: string
  categoryHint?: string
}

export class GeminiService {
  async patchDraftFromText(input: string) {
    const prompt = `Extract structured event hints from this school operations request: ${input}`
    const result = await claudeTextCompletion(prompt)

    if (!result) {
      return {
        summary: input,
        hints: ['Set ANTHROPIC_API_KEY to enable semantic patching'],
      }
    }

    return {
      summary: result,
      hints: ['AI patch generated'],
    }
  }

  async parseEventFromText(text: string): Promise<ParsedEvent> {
    const prompt = `Parse the following natural language description into structured calendar event fields.
Return ONLY valid JSON with these optional fields:
- title (string): event name
- description (string): event description
- startDate (string): ISO date like "2026-03-15"
- startTime (string): time like "14:00"
- endDate (string): ISO date
- endTime (string): time like "15:00"
- isAllDay (boolean): true if no specific time mentioned
- locationText (string): location/venue
- categoryHint (string): one of "academic", "athletics", "arts", "meeting", "social", "fundraiser", "other"

Input: "${text.replace(/"/g, '\\"')}"

JSON:`

    try {
      const result = await claudeTextCompletion(prompt)
      if (!result) return { title: text }

      const parsed = extractJson<ParsedEvent>(result)
      return parsed ?? { title: text }
    } catch {
      return { title: text }
    }
  }

  async generateEventDescription(title: string, context?: string): Promise<string> {
    const prompt = `Write a concise, professional 2-3 sentence description for a school calendar event.
Title: "${title}"
${context ? `Context: ${context}` : ''}
Keep it informative and appropriate for parents and staff. Do not use emoji.`

    try {
      return (await claudeTextCompletion(prompt)) ?? ''
    } catch {
      return ''
    }
  }
}

export const geminiService = new GeminiService()
