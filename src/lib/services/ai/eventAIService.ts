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

import { GoogleGenAI } from '@google/genai'
import type {
  AIEventSuggestion,
  AIScheduleSuggestion,
  AIBudgetEstimate,
  AIStatusSummary,
  AINotificationDraft,
  AIFeedbackAnalysis,
  EventStatusInput,
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

export async function generateEventFromDescription(
  description: string,
  orgContext?: { existingEvents?: string[] },
): Promise<AIEventSuggestion | null> {
  const client = getClient()
  if (!client) return null

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

Common school event document types: Permission Slip, Medical/Emergency Form, Media Release, Code of Conduct, Financial Aid Form, Liability Waiver.
Common task categories: Logistics, Communications, Venue, Volunteers, Transportation, Food, Safety, Finance.
Schedule block types: SESSION, MEAL, TRAVEL, ACTIVITY, BREAK, CEREMONY, FREE_TIME.
Budget categories: Transportation, Food & Catering, Accommodations, Activities & Fees, Supplies & Materials, Staffing, Entertainment, Miscellaneous.

Today's date context: Use realistic future dates for the event.
JSON:`

  const responseText = await callGemini(prompt)
  if (!responseText) return null

  try {
    const jsonStr = extractJSON(responseText)
    if (!jsonStr) return null
    return JSON.parse(jsonStr) as AIEventSuggestion
  } catch (err) {
    console.error('[eventAIService] Failed to parse generateEventFromDescription response:', err)
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
