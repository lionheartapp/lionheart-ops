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

export interface SearchContextItem {
  id: string
  name: string
}

export interface SearchContext {
  schools: SearchContextItem[]
  campuses: SearchContextItem[]
  categories: SearchContextItem[]
  sports: SearchContextItem[]
}

export interface ParsedSearchFilter {
  titleSearch?: string
  schoolNames?: string[]
  campusNames?: string[]
  categoryNames?: string[]
  schoolLevels?: string[]
  sportNames?: string[]
  teamLevels?: string[]
  dateRange?: { start: string; end: string }
  summary?: string
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

  async parseSearchQuery(
    query: string,
    context: SearchContext,
  ): Promise<ParsedSearchFilter> {
    if (!this.client) {
      return { titleSearch: query }
    }

    const prompt = `You are a calendar search assistant for a school management platform.
The user typed a search query. Parse it into structured filters.

Return ONLY valid JSON with these optional fields:
- titleSearch (string): any remaining free-text to match against event titles (after extracting structured filters)
- schoolNames (string[]): school names mentioned (fuzzy match against available schools)
- campusNames (string[]): campus names mentioned
- categoryNames (string[]): category/team names like "AV", "facilities", "IT", "athletics"
- schoolLevels (string[]): values from [ELEMENTARY, MIDDLE_SCHOOL, HIGH_SCHOOL]
- sportNames (string[]): sport names mentioned
- teamLevels (string[]): values from [VARSITY, VARSITY_B, JUNIOR_VARSITY, FRESHMAN, FROSH_SOPH, C_TEAM, CLUB, INTRAMURAL, UNIFIED]
- dateRange (object): { start: "YYYY-MM-DD", end: "YYYY-MM-DD" } if a time range is mentioned
- summary (string): a short human-readable summary of what was understood, e.g. "High school AV events"

Available context:
- Schools: ${JSON.stringify(context.schools.map((s) => s.name))}
- Campuses: ${JSON.stringify(context.campuses.map((c) => c.name))}
- Categories: ${JSON.stringify(context.categories.map((c) => c.name))}
- Sports: ${JSON.stringify(context.sports.map((s) => s.name))}
- Today's date: ${new Date().toISOString().split('T')[0]}

User query: "${query.replace(/"/g, '\\"')}"

JSON:`

    try {
      const result = await this.client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      })

      const responseText = result.text || ''
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as ParsedSearchFilter
      }
      return { titleSearch: query }
    } catch {
      return { titleSearch: query }
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
