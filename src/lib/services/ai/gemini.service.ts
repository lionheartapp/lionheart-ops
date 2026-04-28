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

export interface WorkflowContextItem {
  id: string
  name: string
  schoolName?: string
  teamName?: string
}

export interface WorkflowContext {
  schools: WorkflowContextItem[]
  campuses: WorkflowContextItem[]
  categories: WorkflowContextItem[]
  teams: WorkflowContextItem[]
  members: WorkflowContextItem[]
}

export interface ParsedWorkflowStep {
  type: 'team' | 'person'
  name: string
  mode: 'REQUIRED' | 'NOTIFICATION'
  trigger: 'ALWAYS' | 'WHEN_RESOURCE_REQUESTED'
}

export interface ParsedWorkflowRule {
  name: string
  schoolName: string | null
  campusName: string | null
  categoryName: string | null
  minAttendance: number | null
  requiresResource: string | null
  isOffCampus: boolean | null
  executionMode: 'PARALLEL' | 'SEQUENTIAL'
  steps: ParsedWorkflowStep[]
}

export interface ParsedWorkflow {
  rules: ParsedWorkflowRule[]
  summary: string
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
      model: 'gemini-2.5-flash',
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
        model: 'gemini-2.5-flash',
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
        model: 'gemini-2.5-flash',
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

  async parseApprovalWorkflow(
    text: string,
    context: WorkflowContext,
  ): Promise<ParsedWorkflow> {
    if (!this.client) {
      return { rules: [], summary: 'AI unavailable' }
    }

    const prompt = `You are an approval workflow assistant for a school management platform.
The user is describing how event approvals should work at their organization. Parse their description into structured approval rules.

Return ONLY valid JSON with this structure:
{
  "rules": [
    {
      "name": "string - short descriptive name for the rule",
      "schoolName": "string or null - school this applies to (fuzzy match against available schools)",
      "campusName": "string or null - campus this applies to",
      "categoryName": "string or null - event category this applies to",
      "minAttendance": "number or null - minimum expected attendance threshold (e.g., 100 for 'large events')",
      "requiresResource": "string or null - one of: 'av', 'facilities', 'custodial', 'security'",
      "isOffCampus": "boolean or null - true for off-campus events, false for on-campus only, null for any",
      "executionMode": "PARALLEL or SEQUENTIAL",
      "steps": [
        {
          "type": "team or person",
          "name": "string - team name or person name (fuzzy match against available options)",
          "mode": "REQUIRED or NOTIFICATION",
          "trigger": "ALWAYS or WHEN_RESOURCE_REQUESTED"
        }
      ]
    }
  ],
  "summary": "string - brief human-readable summary of what was understood"
}

Rules:
- PREFER fewer rules with multiple steps over many single-step rules. Use step-level triggers ("WHEN_RESOURCE_REQUESTED") to handle conditional approvers WITHIN a single rule instead of creating separate rules.
- Example: "all events need admin approval, and if AV is needed Kevin must approve" → ONE rule with 2 steps: admin (trigger: ALWAYS) + Kevin (trigger: WHEN_RESOURCE_REQUESTED). NOT two separate rules.
- Only create a SEPARATE rule when the conditions (school, campus, category, attendance) are genuinely different — e.g., different schools need different approvers.
- A rule with no conditions matches ALL events (use this for default/catch-all rules).
- DEFAULT trigger is "ALWAYS" unless the user explicitly says "if needed", "when requested", or "only when AV/facilities is required".
- "WHEN_RESOURCE_REQUESTED" means this step only activates when the event requests that resource. Use it for conditional approvers (e.g., "if AV is needed, Kevin approves" → Kevin's step has trigger: WHEN_RESOURCE_REQUESTED).
- If the user says "needs approval from X" or "must be approved by X", that's trigger: "ALWAYS", mode: "REQUIRED".
- If the user says "first X, then Y" or "X first and then Y", that means executionMode: "SEQUENTIAL" and both steps have trigger: "ALWAYS".
- "SEQUENTIAL" means step 1 must approve before step 2 sees it. "PARALLEL" means all steps review at once.
- If the user mentions ordering words like "first", "then", "after", "before", "next", that implies SEQUENTIAL execution.
- "large events", "big events", "100+ people" → set minAttendance to the number mentioned (default 100 if vague).
- "needs AV", "requires A/V equipment" → requiresResource: "av"
- "needs facilities", "room setup needed" → requiresResource: "facilities"
- "needs security", "security required" → requiresResource: "security"
- "off-campus", "off campus", "outside venue" → isOffCampus: true
- "on-campus only" → isOffCampus: false
- When escalation is mentioned ("remind after 24 hours", "escalate if stalled"), note it in the summary but do not add it to the JSON structure.

Available context:
- Schools: ${JSON.stringify(context.schools.map(s => s.name))}
- Campuses: ${JSON.stringify(context.campuses.map(c => ({ name: c.name, school: c.schoolName })))}
- Categories: ${JSON.stringify(context.categories.map(c => c.name))}
- Teams: ${JSON.stringify(context.teams.map(t => t.name))}
- People: ${JSON.stringify(context.members.map(m => ({ name: m.name, team: m.teamName })))}

User description: "${text.replace(/"/g, '\\"')}"

JSON:`

    try {
      const result = await this.client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      })

      const responseText = result.text || ''
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as ParsedWorkflow
      }
      return { rules: [], summary: 'Could not parse workflow' }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[parseApprovalWorkflow] Gemini error:', err instanceof Error ? err.message : err)
      return { rules: [], summary: 'Failed to parse workflow' }
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
        model: 'gemini-2.5-flash',
        contents: prompt,
      })
      return result.text || ''
    } catch {
      return ''
    }
  }
}

export const geminiService = new GeminiService()
