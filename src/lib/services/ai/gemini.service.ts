import { GoogleGenAI } from '@google/genai'

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
  private client: GoogleGenAI | null

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null
  }

  async patchDraftFromText(input: string) {
    if (!this.client) {
      return {
        summary: input,
        hints: ['Set GEMINI_API_KEY to enable semantic patching'],
      }
    }

    const prompt = `Extract structured event hints from this school operations request: ${input}`
    const result = await this.client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    })

    return {
      summary: result.text || input,
      hints: ['AI patch generated'],
    }
  }

  async parseEventFromText(text: string): Promise<ParsedEvent> {
    if (!this.client) {
      return { title: text }
    }

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
      const result = await this.client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      })

      const responseText = result.text || ''
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as ParsedEvent
      }
      return { title: text }
    } catch {
      return { title: text }
    }
  }

  async generateEventDescription(title: string, context?: string): Promise<string> {
    if (!this.client) {
      return ''
    }

    const prompt = `Write a concise, professional 2-3 sentence description for a school calendar event.
Title: "${title}"
${context ? `Context: ${context}` : ''}
Keep it informative and appropriate for parents and staff. Do not use emoji.`

    try {
      const result = await this.client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      })
      return result.text || ''
    } catch {
      return ''
    }
  }
}

export const geminiService = new GeminiService()
