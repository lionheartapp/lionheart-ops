/**
 * eventAIService.ts
 *
 * Gemini-powered AI functions for the event module:
 * - generateEventFromDescription: Natural language → structured event suggestion
 * - generateSchedule: Parameters → multi-day schedule blocks
 * - estimateBudget: Event params → budget range per category
 * - generateStatusSummary: Event metrics → natural language summary
 * - generateNotificationDraft: Trigger params → notification subject + body
 * - enhanceTemplateForReuse: Adjust template for new dates/context
 * - analyzeFeedback: Survey responses → themes + action items
 *
 * All functions return null if GEMINI_API_KEY is not configured.
 */

import { GoogleGenAI, Type } from '@google/genai'
import { rawPrisma } from '@/lib/db'
import type {
  AIEventSuggestion,
  AIScheduleSuggestion,
  AIBudgetEstimate,
  AIStatusSummary,
  AINotificationDraft,
  AIFeedbackAnalysis,
  EventStatusInput,
  AIGeneratedForm,
  AIGroupParticipant,
  AIGroupTarget,
  AIGroupConstraints,
  AIGroupAssignmentResult,
  AIConflictReport,
  AIHistoricalBudgetEstimate,
} from '@/lib/types/event-ai'
import type { TemplateData, ScheduleBlockTemplate } from '@/lib/types/event-template'

// ---------------------------------------------------------------------------
// Client initialization
// ---------------------------------------------------------------------------

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
  return apiKey ? new GoogleGenAI({ apiKey }) : null
}

/**
 * Extract JSON from a Gemini response that may be wrapped in markdown code blocks.
 */
function extractJSON(text: string): string | null {
  // Remove markdown code block wrappers (```json...``` or ```...```)
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (codeBlockMatch) {
    return codeBlockMatch[1] ?? null
  }

  // Try to find a raw JSON object or array
  const objectMatch = text.match(/\{[\s\S]*\}/)
  if (objectMatch) return objectMatch[0]

  const arrayMatch = text.match(/\[[\s\S]*\]/)
  if (arrayMatch) return arrayMatch[0]

  return null
}

async function callGemini(prompt: string): Promise<string | null> {
  const client = getClient()
  if (!client) return null

  try {
    const result = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    })
    return result.text ?? null
  } catch (err) {
    console.error('[eventAIService] Gemini call failed:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// generateEventFromDescription
// ---------------------------------------------------------------------------

// ── Tool definitions for event planning with real data ────────────────────
const EVENT_PLANNING_TOOLS = [
  {
    name: 'search_upcoming_events',
    description: 'Search for upcoming events at the school within the next 60 days. Use this to check for date conflicts and see what is already scheduled.',
    parameters: { type: Type.OBJECT, properties: {}, required: [] as string[] },
  },
  {
    name: 'list_buildings_and_rooms',
    description: 'List all buildings and rooms available at the school. Use this to suggest appropriate venues for the event.',
    parameters: { type: Type.OBJECT, properties: {}, required: [] as string[] },
  },
  {
    name: 'list_event_templates',
    description: 'List saved event templates from past events. If a similar event was done before, use the template as a starting point for schedule, tasks, and budget.',
    parameters: { type: Type.OBJECT, properties: {}, required: [] as string[] },
  },
  {
    name: 'get_school_info',
    description: 'Get school/organization details including name, grade levels, and campus info. Useful for tailoring the event to the school context.',
    parameters: { type: Type.OBJECT, properties: {}, required: [] as string[] },
  },
]

// Tool execution against the database
async function executeEventPlanningTool(name: string): Promise<string> {
  try {
    switch (name) {
      case 'search_upcoming_events': {
        const now = new Date()
        const sixtyDaysOut = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
        const events = await rawPrisma.calendarEvent.findMany({
          where: {
            startTime: { gte: now, lte: sixtyDaysOut },
            deletedAt: null,
            calendarStatus: { in: ['CONFIRMED', 'TENTATIVE', 'PENDING_APPROVAL'] },
          },
          select: { title: true, startTime: true, endTime: true, locationText: true, isAllDay: true },
          orderBy: { startTime: 'asc' },
          take: 30,
        })
        return JSON.stringify({ events: events.map((e: any) => ({
          title: e.title,
          start: e.startTime?.toISOString().split('T')[0],
          end: e.endTime?.toISOString().split('T')[0],
          location: e.locationText,
          allDay: e.isAllDay,
        })), count: events.length })
      }

      case 'list_buildings_and_rooms': {
        const buildings = await rawPrisma.building.findMany({
          where: { deletedAt: null },
          select: {
            name: true,
            areas: {
              where: { deletedAt: null },
              select: {
                name: true,
                rooms: {
                  where: { deletedAt: null, isActive: true },
                  select: { displayName: true, roomNumber: true },
                  take: 10,
                },
              },
              take: 5,
            },
          },
          take: 10,
        })
        return JSON.stringify({ buildings: buildings.map((b: any) => ({
          name: b.name,
          areas: b.areas?.map((a: any) => ({
            name: a.name,
            rooms: a.rooms?.map((r: any) => r.displayName || r.roomNumber),
          })),
        })) })
      }

      case 'list_event_templates': {
        const templates = await rawPrisma.eventTemplate.findMany({
          where: {},
          select: { name: true, description: true, eventType: true },
          orderBy: { usageCount: 'desc' },
          take: 10,
        })
        return JSON.stringify({ templates: templates.map((t: any) => ({
          name: t.name,
          description: t.description,
          type: t.eventType,
        })), count: templates.length })
      }

      case 'get_school_info': {
        const org = await rawPrisma.organization.findFirst({
          select: { name: true, slug: true },
        })
        const campuses = await rawPrisma.campus.findMany({
          where: { isActive: true },
          select: { name: true },
          take: 5,
        })
        return JSON.stringify({
          schoolName: org?.name,
          campuses: campuses.map((c: any) => c.name),
        })
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  } catch (err) {
    console.error(`[eventAIService] Tool ${name} failed:`, err)
    return JSON.stringify({ error: `Tool failed: ${(err as Error).message}` })
  }
}

export async function generateEventFromDescription(
  description: string,
  orgContext?: { existingEvents?: string[] },
): Promise<AIEventSuggestion | null> {
  const client = getClient()
  if (!client) return null

  const systemPrompt = `You are Leo, an AI event planner for a school. You help administrators plan events by:
1. First, use your tools to check the school's calendar, available venues, and past event templates.
2. Then, generate a detailed event plan based on the user's description AND the real data from the school.

Always check for calendar conflicts and suggest appropriate venues based on actual available buildings/rooms.
If a similar event template exists, use it as a starting point and adapt it.
Today's date: ${new Date().toISOString().split('T')[0]}.`

  const outputFormat = `After gathering context from tools, return ONLY valid JSON matching this structure:
{
  "title": "Event title",
  "description": "2-3 sentence event description suitable for parents and staff",
  "startsAt": "YYYY-MM-DD",
  "endsAt": "YYYY-MM-DD",
  "isMultiDay": false,
  "expectedAttendance": 50,
  "locationText": "Location or venue (use actual school venue if appropriate)",
  "suggestedDocs": ["Permission Slip", "Medical Form"],
  "suggestedTasks": [
    { "title": "Book venue", "category": "Logistics", "priority": "HIGH" }
  ],
  "budgetEstimate": [
    { "category": "Transportation", "estimatedMin": 500, "estimatedMax": 1200 }
  ],
  "scheduleBlocks": [
    { "dayOffset": 0, "startTime": "08:00", "endTime": "09:00", "title": "Departure", "type": "TRAVEL" }
  ]
}
Schedule block types: SESSION, MEAL, TRAVEL, ACTIVITY, BREAK, CEREMONY, FREE_TIME.`

  try {
    const MAX_TOOL_ROUNDS = 4
    let conversationContents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [
      { role: 'user', parts: [{ text: `Plan this event: "${description}"\n\n${outputFormat}` }] },
    ]

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const result = await client.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: conversationContents as any,
        config: {
          systemInstruction: systemPrompt,
          tools: [{ functionDeclarations: EVENT_PLANNING_TOOLS }],
        },
      })

      const parts = result.candidates?.[0]?.content?.parts || []
      const functionCalls: Array<{ name: string; args: Record<string, unknown> }> = []
      let textResponse = ''

      for (const part of parts) {
        if ((part as any).text) textResponse += (part as any).text
        if ((part as any).functionCall) {
          functionCalls.push({
            name: (part as any).functionCall.name,
            args: (part as any).functionCall.args || {},
          })
        }
      }

      // If no function calls, we have the final answer
      if (functionCalls.length === 0) {
        const jsonStr = extractJSON(textResponse)
        if (!jsonStr) return null
        return JSON.parse(jsonStr) as AIEventSuggestion
      }

      // Execute function calls and feed results back
      conversationContents.push({
        role: 'model',
        parts: functionCalls.map((fc) => ({
          functionCall: { name: fc.name, args: fc.args },
        })),
      })

      const functionResponses: Array<Record<string, unknown>> = []
      for (const fc of functionCalls) {
        const toolResult = await executeEventPlanningTool(fc.name)
        functionResponses.push({
          functionResponse: { name: fc.name, response: { content: toolResult } },
        })
      }

      conversationContents.push({ role: 'user', parts: functionResponses })
    }

    // Fallback: if we exhausted rounds, try one final call without tools
    const finalResult = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: conversationContents as any,
      config: { systemInstruction: systemPrompt },
    })

    const finalText = finalResult.text ?? ''
    const jsonStr = extractJSON(finalText)
    if (!jsonStr) return null
    return JSON.parse(jsonStr) as AIEventSuggestion
  } catch (err) {
    console.error('[eventAIService] generateEventFromDescription with tools failed:', err)

    // Fallback: try simple prompt without tools
    return generateEventFromDescriptionSimple(description, orgContext)
  }
}

/**
 * Fallback: simple prompt-based generation without tool calling.
 * Used when the tool-augmented approach fails.
 */
async function generateEventFromDescriptionSimple(
  description: string,
  orgContext?: { existingEvents?: string[] },
): Promise<AIEventSuggestion | null> {
  const existingEventsHint =
    orgContext?.existingEvents?.length
      ? `\nExisting upcoming events at this school (for context): ${orgContext.existingEvents.slice(0, 5).join(', ')}`
      : ''

  const prompt = `You are an assistant helping school administrators plan events.
Given a natural language description of a school event, extract structured event planning details.

Description: "${description.replace(/"/g, '\\"')}"
${existingEventsHint}

Return ONLY valid JSON matching this exact structure (no markdown, no extra text):
{
  "title": "Event title",
  "description": "2-3 sentence event description suitable for parents and staff",
  "startsAt": "YYYY-MM-DD",
  "endsAt": "YYYY-MM-DD",
  "isMultiDay": false,
  "expectedAttendance": 50,
  "locationText": "Location or venue",
  "suggestedDocs": ["Permission Slip", "Medical Form"],
  "suggestedTasks": [
    { "title": "Book venue", "category": "Logistics", "priority": "HIGH" },
    { "title": "Send permission slips", "category": "Communications", "priority": "NORMAL" }
  ],
  "budgetEstimate": [
    { "category": "Transportation", "estimatedMin": 500, "estimatedMax": 1200 },
    { "category": "Food & Catering", "estimatedMin": 200, "estimatedMax": 600 }
  ],
  "scheduleBlocks": [
    { "dayOffset": 0, "startTime": "08:00", "endTime": "09:00", "title": "Departure", "type": "TRAVEL" },
    { "dayOffset": 0, "startTime": "09:00", "endTime": "12:00", "title": "Morning Activity", "type": "ACTIVITY" }
  ]
}

Schedule block types: SESSION, MEAL, TRAVEL, ACTIVITY, BREAK, CEREMONY, FREE_TIME.
Today's date: ${new Date().toISOString().split('T')[0]}. Use realistic future dates.
JSON:`

  const responseText = await callGemini(prompt)
  if (!responseText) return null

  try {
    const jsonStr = extractJSON(responseText)
    if (!jsonStr) return null
    return JSON.parse(jsonStr) as AIEventSuggestion
  } catch (err) {
    console.error('[eventAIService] Simple fallback parse failed:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// generateSchedule
// ---------------------------------------------------------------------------

export async function generateSchedule(params: {
  eventType: string
  durationDays: number
  expectedAttendance: number
  description?: string
}): Promise<AIScheduleSuggestion | null> {
  const client = getClient()
  if (!client) return null

  const prompt = `You are an expert school event planner. Generate a detailed multi-day schedule for this event.

Event type: ${params.eventType}
Duration: ${params.durationDays} day(s)
Expected attendance: ${params.expectedAttendance} participants
${params.description ? `Description: ${params.description}` : ''}

Return ONLY valid JSON with this structure:
{
  "blocks": [
    {
      "dayOffset": 0,
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "title": "Block title",
      "type": "SESSION|MEAL|TRAVEL|ACTIVITY|BREAK|CEREMONY|FREE_TIME",
      "location": "Optional location"
    }
  ],
  "reasoning": "Brief explanation of why this schedule works well for this type of event"
}

Guidelines:
- dayOffset 0 = first day, 1 = second day, etc.
- Include meals (breakfast, lunch, dinner as appropriate for duration)
- Include realistic transition/travel time
- Group sizes over 100 may need parallel tracks — note in block titles
- For overnight events, include wake-up and lights-out blocks
- Blocks should not overlap within the same day
- Use 24-hour time format (HH:MM)

JSON:`

  const responseText = await callGemini(prompt)
  if (!responseText) return null

  try {
    const jsonStr = extractJSON(responseText)
    if (!jsonStr) return null
    return JSON.parse(jsonStr) as AIScheduleSuggestion
  } catch (err) {
    console.error('[eventAIService] Failed to parse generateSchedule response:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// estimateBudget
// ---------------------------------------------------------------------------

export async function estimateBudget(params: {
  eventType: string
  durationDays: number
  expectedAttendance: number
  location?: string
}): Promise<AIBudgetEstimate | null> {
  const client = getClient()
  if (!client) return null

  const prompt = `You are a school event budget specialist. Provide realistic budget estimates for this event.

Event type: ${params.eventType}
Duration: ${params.durationDays} day(s)
Expected attendance: ${params.expectedAttendance} participants
${params.location ? `Location: ${params.location}` : ''}

Return ONLY valid JSON with this structure:
{
  "categories": [
    {
      "name": "Category name",
      "estimatedMin": 500,
      "estimatedMax": 1500
    }
  ],
  "totalMin": 2000,
  "totalMax": 5000,
  "reasoning": "Brief explanation of key cost drivers and assumptions"
}

Standard school event budget categories to consider (use only relevant ones):
Transportation, Food & Catering, Accommodations, Activities & Entry Fees,
Supplies & Materials, Staffing & Chaperones, Entertainment, Insurance & Permits,
Technology & AV, Printing & Signage, Medical & Safety Supplies, Miscellaneous.

Assumptions:
- US dollar amounts
- Non-profit school pricing where applicable
- Include reasonable contingency in maximums (15-20%)
- Base estimates on realistic US school event costs (not luxury rates)

JSON:`

  const responseText = await callGemini(prompt)
  if (!responseText) return null

  try {
    const jsonStr = extractJSON(responseText)
    if (!jsonStr) return null
    const parsed = JSON.parse(jsonStr) as AIBudgetEstimate

    // Recalculate totals from categories for safety
    const totalMin = parsed.categories.reduce((sum, c) => sum + (c.estimatedMin ?? 0), 0)
    const totalMax = parsed.categories.reduce((sum, c) => sum + (c.estimatedMax ?? 0), 0)

    return {
      ...parsed,
      totalMin: parsed.totalMin ?? totalMin,
      totalMax: parsed.totalMax ?? totalMax,
    }
  } catch (err) {
    console.error('[eventAIService] Failed to parse estimateBudget response:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// generateStatusSummary
// ---------------------------------------------------------------------------

export async function generateStatusSummary(
  eventData: EventStatusInput,
): Promise<AIStatusSummary | null> {
  const client = getClient()
  if (!client) return null

  const prompt = `You are a school event coordinator assistant. Generate a concise status summary for this event.

Event: "${eventData.title}"
Status: ${eventData.status}
Days until event: ${eventData.daysUntilEvent}
Registrations: ${eventData.registrationCount}
Tasks: ${eventData.completedTasks}/${eventData.totalTasks} complete
Document completion: ${eventData.documentCompletionPercent}%
Budget utilized: ${eventData.budgetUtilization}%

Return ONLY valid JSON with this structure:
{
  "summary": "2-3 sentence plain English summary of the event's current planning status",
  "completionPercent": 65,
  "atRisk": ["List of specific at-risk items if any, e.g. 'Transportation not confirmed'"],
  "nextSteps": ["Prioritized list of 2-4 next actions to take"]
}

Be direct and specific. Flag real risks. Highlight what's going well.
Keep the summary appropriate for a school administrator audience.
JSON:`

  const responseText = await callGemini(prompt)
  if (!responseText) return null

  try {
    const jsonStr = extractJSON(responseText)
    if (!jsonStr) return null
    return JSON.parse(jsonStr) as AIStatusSummary
  } catch (err) {
    console.error('[eventAIService] Failed to parse generateStatusSummary response:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// generateNotificationDraft
// ---------------------------------------------------------------------------

export async function generateNotificationDraft(params: {
  eventTitle: string
  eventDate: string
  triggerType: string
  targetAudience: string
  context?: string
}): Promise<AINotificationDraft | null> {
  const client = getClient()
  if (!client) return null

  const prompt = `You are a school communications specialist. Draft a notification for this school event.

Event: "${params.eventTitle}"
Event date: ${params.eventDate}
Trigger type: ${params.triggerType} (e.g., "7 days before", "registration confirmed", "day of event")
Target audience: ${params.targetAudience} (e.g., "parents of registered participants", "all staff", "volunteers")
${params.context ? `Additional context: ${params.context}` : ''}

Return ONLY valid JSON with this structure:
{
  "subject": "Concise email subject line (max 60 characters)",
  "body": "Full notification body in plain text. Friendly, professional, appropriate for school communications. Include key details, any required actions, and contact info placeholder [CONTACT_INFO]."
}

Guidelines:
- No emoji in body
- Clear call-to-action if needed
- Mention event name and date
- Warm but professional tone appropriate for school communications
- 100-250 words for the body
JSON:`

  const responseText = await callGemini(prompt)
  if (!responseText) return null

  try {
    const jsonStr = extractJSON(responseText)
    if (!jsonStr) return null
    return JSON.parse(jsonStr) as AINotificationDraft
  } catch (err) {
    console.error('[eventAIService] Failed to parse generateNotificationDraft response:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// enhanceTemplateForReuse
// ---------------------------------------------------------------------------

export async function enhanceTemplateForReuse(
  templateData: TemplateData,
  newParams: { startsAt: string; endsAt: string },
  sourceEventLessons?: string[],
): Promise<TemplateData> {
  const client = getClient()
  if (!client) return templateData

  const lessonsContext = sourceEventLessons?.length
    ? `\nLessons from previous event:\n${sourceEventLessons.slice(0, 5).map((l) => `- ${l}`).join('\n')}`
    : ''

  const prompt = `You are a school event planning expert reviewing a reusable event template.
The template is being reused for a new event starting ${newParams.startsAt} and ending ${newParams.endsAt}.
${lessonsContext}

Current template structure:
- Schedule blocks: ${templateData.scheduleBlocks.length}
- Tasks: ${templateData.taskTemplates.length}
- Document types: ${templateData.documentTypes.join(', ') || 'none'}
- Groups: ${templateData.groupStructure.length}

Suggest any improvements to the schedule block timing, task priorities, or task additions based on the new dates and lessons learned.

Return ONLY valid JSON matching the SAME structure as the input template:
{
  "scheduleBlocks": ${JSON.stringify(templateData.scheduleBlocks)},
  "budgetCategories": ${JSON.stringify(templateData.budgetCategories)},
  "taskTemplates": ${JSON.stringify(templateData.taskTemplates)},
  "documentTypes": ${JSON.stringify(templateData.documentTypes)},
  "groupStructure": ${JSON.stringify(templateData.groupStructure)},
  "notificationRules": ${JSON.stringify(templateData.notificationRules)}
}

Modify the arrays as appropriate. Return the complete TemplateData JSON structure.
JSON:`

  const responseText = await callGemini(prompt)
  if (!responseText) return templateData

  try {
    const jsonStr = extractJSON(responseText)
    if (!jsonStr) return templateData
    const enhanced = JSON.parse(jsonStr) as TemplateData
    // Validate the structure has required arrays before returning
    if (!Array.isArray(enhanced.scheduleBlocks)) return templateData
    return enhanced
  } catch (err) {
    console.error('[eventAIService] Failed to parse enhanceTemplateForReuse response:', err)
    return templateData
  }
}

// ---------------------------------------------------------------------------
// generateRegistrationForm
// ---------------------------------------------------------------------------

export async function generateRegistrationForm(params: {
  eventType: string
  durationDays: number
  expectedAttendance: number
  description?: string
}): Promise<AIGeneratedForm | null> {
  const client = getClient()
  if (!client) return null

  const prompt = `You are a school event coordinator. Generate a registration form for this event.

Event type: ${params.eventType}
Duration: ${params.durationDays} day(s)
Expected attendance: ${params.expectedAttendance} participants
${params.description ? `Description: ${params.description}` : ''}

Return ONLY valid JSON with this structure:
{
  "sections": [
    {
      "title": "Section title",
      "fields": [
        {
          "type": "TEXT|DROPDOWN|CHECKBOX|NUMBER|DATE|FILE",
          "label": "Field label",
          "helpText": "Optional help text",
          "required": true,
          "options": ["Option 1", "Option 2"]
        }
      ]
    }
  ]
}

Guidelines:
- Always include a "Participant Information" section with: First Name, Last Name, Grade (DROPDOWN), Date of Birth (DATE), T-Shirt Size (DROPDOWN for multi-day)
- For multi-day events (durationDays > 1): add "Medical & Emergency" section with: Known Allergies (TEXT, required=false), Medications (TEXT, required=false), Emergency Contact Name (TEXT, required), Emergency Contact Phone (TEXT, required), Relationship (TEXT, required)
- For camps (eventType contains "camp"): add dietary needs (DROPDOWN with: No restrictions, Vegetarian, Vegan, Gluten-Free, Dairy-Free, Other), medical notes
- For field trips: add permission acknowledgment (CHECKBOX, required), transportation consent (CHECKBOX)
- For retreats: include cabin/room preference (TEXT, required=false), special accommodations (TEXT, required=false)
- For performances/events: include participant role (TEXT), experience level (DROPDOWN)
- Keep it minimal — only include fields truly needed for this event type
- Field types: TEXT for short answers, DROPDOWN for predefined options, CHECKBOX for yes/no consent, NUMBER for quantities, DATE for dates, FILE for uploads
- Include options array only for DROPDOWN fields
- T-Shirt sizes: ["Youth S", "Youth M", "Youth L", "Adult S", "Adult M", "Adult L", "Adult XL"]
- Grade options: ["K", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"]

JSON:`

  const responseText = await callGemini(prompt)
  if (!responseText) return null

  try {
    const jsonStr = extractJSON(responseText)
    if (!jsonStr) return null
    return JSON.parse(jsonStr) as AIGeneratedForm
  } catch (err) {
    console.error('[eventAIService] Failed to parse generateRegistrationForm response:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// generateGroupAssignments
// ---------------------------------------------------------------------------

export async function generateGroupAssignments(params: {
  participants: AIGroupParticipant[]
  groups: AIGroupTarget[]
  constraints: AIGroupConstraints
}): Promise<AIGroupAssignmentResult | null> {
  const client = getClient()
  if (!client) return null

  const participantSummary = params.participants.slice(0, 50).map((p) => ({
    id: p.id,
    name: p.name,
    grade: p.grade ?? 'Unknown',
    gender: p.gender ?? 'Unknown',
    friendRequests: p.friendRequests?.slice(0, 3) ?? [],
  }))

  const groupSummary = params.groups.map((g) => ({
    id: g.id,
    name: g.name,
    type: g.type,
    capacity: g.capacity,
  }))

  const prompt = `You are an expert at organizing school event groups. Assign participants to groups optimally.

Participants (${params.participants.length} total):
${JSON.stringify(participantSummary, null, 2)}

Groups:
${JSON.stringify(groupSummary, null, 2)}

Constraints:
- Balance gender: ${params.constraints.balanceGender ?? false}
- Balance grade: ${params.constraints.balanceGrade ?? false}
- Honor friend requests: ${params.constraints.honorFriendRequests ?? false}
- Counselor ratio (participants per counselor): ${params.constraints.counselorRatio ?? 'N/A'}

Return ONLY valid JSON with this structure:
{
  "assignments": [
    {
      "participantId": "id from participant list",
      "groupId": "id from group list",
      "reasoning": "Optional brief note (e.g. 'Honors friend request with Jane')"
    }
  ],
  "warnings": [
    "Any issues found — e.g. 'Group Bus 1 would exceed capacity by 2', '3 friend requests could not be honored'"
  ]
}

Rules:
- Every participant must have exactly one assignment
- Do not exceed group capacity
- If constraints conflict, prioritize: capacity > gender balance > grade balance > friend requests
- Keep warnings concise and actionable
- participantId and groupId must exactly match the provided ids

JSON:`

  const responseText = await callGemini(prompt)
  if (!responseText) return null

  try {
    const jsonStr = extractJSON(responseText)
    if (!jsonStr) return null
    return JSON.parse(jsonStr) as AIGroupAssignmentResult
  } catch (err) {
    console.error('[eventAIService] Failed to parse generateGroupAssignments response:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// detectConflicts (deterministic — no AI needed)
// ---------------------------------------------------------------------------

export async function detectConflicts(params: {
  eventProjectId: string
  startsAt: string
  endsAt: string
  buildingId?: string
  roomId?: string
  organizationId: string
}): Promise<AIConflictReport> {
  const { startsAt, endsAt, buildingId, roomId, organizationId, eventProjectId } = params

  const start = new Date(startsAt)
  const end = new Date(endsAt)

  const conflicts: AIConflictReport['conflicts'] = []

  // Load all overlapping EventProjects in the org (excluding the current one)
  const overlapping = await rawPrisma.eventProject.findMany({
    where: {
      organizationId,
      id: { not: eventProjectId },
      deletedAt: null,
      AND: [
        { startsAt: { lt: end } },
        { endsAt: { gt: start } },
      ],
    },
    select: {
      id: true,
      title: true,
      buildingId: true,
      roomId: true,
      createdById: true,
      startsAt: true,
      endsAt: true,
      schoolId: true,
      locationText: true,
    },
  })

  // Load current event for comparison
  const currentEvent = await rawPrisma.eventProject.findUnique({
    where: { id: eventProjectId },
    select: {
      createdById: true,
      schoolId: true,
    },
  })

  for (const other of overlapping) {
    // Rule 1: Room double-booking — same room in same building
    if (roomId && other.roomId && roomId === other.roomId) {
      conflicts.push({
        type: 'ROOM',
        severity: 'high',
        description: `Room is already booked by "${other.title}" during this time period.`,
        conflictingEventId: other.id,
        conflictingEventTitle: other.title,
      })
      continue
    }

    // Rule 2: Building-level conflict (same building, no specific room)
    if (buildingId && !roomId && other.buildingId && buildingId === other.buildingId && !other.roomId) {
      conflicts.push({
        type: 'ROOM',
        severity: 'medium',
        description: `Another event "${other.title}" is using the same building without a specific room — potential space conflict.`,
        conflictingEventId: other.id,
        conflictingEventTitle: other.title,
      })
    }

    // Rule 3: Staff scheduling conflict — same creator has overlapping event
    if (currentEvent && other.createdById === currentEvent.createdById) {
      conflicts.push({
        type: 'STAFF',
        severity: 'medium',
        description: `The event creator is already coordinating "${other.title}" at the same time.`,
        conflictingEventId: other.id,
        conflictingEventTitle: other.title,
      })
    }

    // Rule 4: Transportation overlap — events at external venues on same day
    const sameDay =
      start.toDateString() === other.startsAt.toDateString() ||
      end.toDateString() === other.startsAt.toDateString()
    if (sameDay && !buildingId && !other.buildingId && (other.locationText || other.roomId === null)) {
      conflicts.push({
        type: 'TRANSPORTATION',
        severity: 'low',
        description: `"${other.title}" is also off-campus on the same day — transportation resources may be shared.`,
        conflictingEventId: other.id,
        conflictingEventTitle: other.title,
      })
    }

    // Rule 5: Audience overlap — same school has two events
    if (currentEvent?.schoolId && other.schoolId && currentEvent.schoolId === other.schoolId) {
      conflicts.push({
        type: 'AUDIENCE',
        severity: 'medium',
        description: `"${other.title}" targets the same school during this time — students/parents may have split attention.`,
        conflictingEventId: other.id,
        conflictingEventTitle: other.title,
      })
    }
  }

  return { conflicts }
}

// ---------------------------------------------------------------------------
// estimateBudgetFromHistory
// ---------------------------------------------------------------------------

export async function estimateBudgetFromHistory(params: {
  eventType?: string
  durationDays: number
  expectedAttendance: number
  organizationId: string
}): Promise<AIHistoricalBudgetEstimate | null> {
  const { organizationId, eventType, durationDays, expectedAttendance } = params

  // Try to find similar historical events with budget data
  const historicalProjects = await rawPrisma.eventProject.findMany({
    where: {
      organizationId,
      deletedAt: null,
      status: 'COMPLETED',
      ...(eventType ? { title: { contains: eventType, mode: 'insensitive' } } : {}),
    },
    select: {
      id: true,
      title: true,
      expectedAttendance: true,
      startsAt: true,
      endsAt: true,
      budgetCategories: {
        include: {
          lineItems: {
            select: {
              budgetedAmount: true,
              actualAmount: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  })

  // Filter events that have budget data
  const eventsWithBudgets = historicalProjects.filter(
    (p) => p.budgetCategories.some((c: any) => c.lineItems.length > 0),
  )

  if (eventsWithBudgets.length >= 3) {
    // Build historical average per category
    const categoryTotals: Record<string, { sum: number; count: number }> = {}

    for (const project of eventsWithBudgets) {
      const attendance = project.expectedAttendance ?? 1
      const scale = expectedAttendance / Math.max(attendance, 1)

      for (const category of project.budgetCategories as any[]) {
        const total = category.lineItems.reduce((sum: number, item: any) => {
          const amount = item.actualAmount ?? item.budgetedAmount
          return sum + (parseFloat(amount?.toString() ?? '0') || 0)
        }, 0)

        if (total > 0) {
          const scaledTotal = total * scale
          if (!categoryTotals[category.name]) {
            categoryTotals[category.name] = { sum: 0, count: 0 }
          }
          categoryTotals[category.name].sum += scaledTotal
          categoryTotals[category.name].count += 1
        }
      }
    }

    const categories = Object.entries(categoryTotals)
      .filter(([, { count }]) => count >= 2) // Only include categories seen in 2+ events
      .map(([name, { sum, count }]) => {
        const avg = sum / count
        return {
          name,
          estimatedMin: Math.round(avg * 0.85),
          estimatedMax: Math.round(avg * 1.15),
        }
      })

    if (categories.length > 0) {
      const totalMin = categories.reduce((s, c) => s + c.estimatedMin, 0)
      const totalMax = categories.reduce((s, c) => s + c.estimatedMax, 0)

      return {
        categories,
        totalMin,
        totalMax,
        reasoning: `Based on ${eventsWithBudgets.length} similar past events at your organization, scaled for ${expectedAttendance} participants.`,
        sourceEventCount: eventsWithBudgets.length,
        isHistorical: true,
      }
    }
  }

  // Fallback: AI estimation
  const aiEstimate = await estimateBudget({
    eventType: eventType ?? 'school event',
    durationDays,
    expectedAttendance,
  })

  if (!aiEstimate) return null

  return {
    ...aiEstimate,
    isHistorical: false,
    sourceEventCount: 0,
  }
}

// ---------------------------------------------------------------------------
// analyzeFeedback
// ---------------------------------------------------------------------------

export async function analyzeFeedback(
  surveyResponses: { question: string; answers: string[] }[],
): Promise<AIFeedbackAnalysis | null> {
  const client = getClient()
  if (!client) return null

  const responseSummary = surveyResponses
    .slice(0, 10)
    .map(
      (r) =>
        `Question: "${r.question}"\nAnswers (${r.answers.length} responses): ${r.answers.slice(0, 8).join(' | ')}`,
    )
    .join('\n\n')

  const prompt = `You are analyzing post-event survey responses for a school event.
Identify key themes, sentiment, and action items for future event planning.

Survey data:
${responseSummary}

Return ONLY valid JSON with this structure:
{
  "themes": [
    {
      "theme": "Theme name (e.g., 'Food quality')",
      "sentiment": "positive|negative|neutral|mixed",
      "count": 12
    }
  ],
  "summary": "2-3 sentence overall summary of participant feedback",
  "actionItems": [
    "Specific action item for next time (e.g., 'Provide vegetarian meal options')"
  ]
}

Guidelines:
- Identify 3-7 themes maximum
- Count is approximate number of responses touching each theme
- Action items should be specific and actionable
- Keep summary concise and constructive
JSON:`

  const responseText = await callGemini(prompt)
  if (!responseText) return null

  try {
    const jsonStr = extractJSON(responseText)
    if (!jsonStr) return null
    return JSON.parse(jsonStr) as AIFeedbackAnalysis
  } catch (err) {
    console.error('[eventAIService] Failed to parse analyzeFeedback response:', err)
    return null
  }
}
