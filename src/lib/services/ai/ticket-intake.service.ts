/**
 * Ticket Intake Classifier
 *
 * Uses Gemini to classify a plain-language issue description into
 * structured ticket fields: module, category, priority, title, and
 * extracted metadata (location, urgency notes).
 */

import { GoogleGenAI } from '@google/genai'
import { logger } from '@/lib/logger'

const log = logger.child({ service: 'ticket-intake' })

export interface IntakeClassification {
  module: 'MAINTENANCE' | 'IT'
  category: string
  confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  suggestedTitle: string
  suggestedPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  extractedLocation: string | null
  extractedUrgencyNote: string | null
  reasoning: string
}

const MAINTENANCE_CATEGORIES = [
  'ELECTRICAL — Wiring, outlets, lighting, breakers, power issues',
  'PLUMBING — Pipes, faucets, toilets, drains, water heaters, leaks',
  'HVAC — Heating, cooling, ventilation, thermostats, air quality',
  'STRUCTURAL — Walls, floors, ceilings, doors, windows, roofing',
  'CUSTODIAL_BIOHAZARD — Cleaning, spills, biohazard, pest control',
  'IT_AV — Projectors, displays, sound systems, classroom tech',
  'GROUNDS — Landscaping, parking lots, fencing, playgrounds, irrigation',
  'OTHER — Anything that doesn\'t fit above',
]

const IT_CATEGORIES = [
  'HARDWARE — Laptops, desktops, printers, peripherals, physical damage',
  'SOFTWARE — Applications, OS issues, installations, updates, crashes',
  'ACCOUNT_PASSWORD — Login issues, password resets, locked accounts, permissions',
  'NETWORK — Wi-Fi, internet connectivity, network drives, VPN',
  'DISPLAY_AV — Projectors, displays, Apple TV, sound systems, A/V equipment',
  'OTHER — Anything that doesn\'t fit above',
]

/**
 * Classify a plain-language issue description into structured ticket fields.
 * Returns null if Gemini API is not configured.
 */
export async function classifyTicketIntake(
  description: string,
  moduleHint?: 'MAINTENANCE' | 'IT'
): Promise<IntakeClassification | null> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
  if (!apiKey) {
    log.warn('No Gemini API key — ticket intake classification unavailable')
    return null
  }

  const client = new GoogleGenAI({ apiKey })

  const moduleSection = moduleHint
    ? moduleHint === 'MAINTENANCE'
      ? `Module: MAINTENANCE\nCategories:\n${MAINTENANCE_CATEGORIES.map((c) => `  - ${c}`).join('\n')}`
      : `Module: IT\nCategories:\n${IT_CATEGORIES.map((c) => `  - ${c}`).join('\n')}`
    : `Determine which module this belongs to, then classify:\n\nMAINTENANCE categories:\n${MAINTENANCE_CATEGORIES.map((c) => `  - ${c}`).join('\n')}\n\nIT categories:\n${IT_CATEGORIES.map((c) => `  - ${c}`).join('\n')}`

  const prompt = `You are a school facilities and IT help desk classifier. Analyze the following issue description and classify it.

${moduleSection}

Issue description: "${description.replace(/"/g, '\\"')}"

Return ONLY valid JSON (no markdown, no code blocks) with these fields:
{
  "module": "MAINTENANCE" or "IT",
  "category": "CATEGORY_NAME" (must be one of the categories listed above, uppercase),
  "confidence": "LOW" or "MEDIUM" or "HIGH",
  "suggestedTitle": "Short, clear title (max 80 chars)",
  "suggestedPriority": "LOW" or "MEDIUM" or "HIGH" or "URGENT",
  "extractedLocation": "Room/building mentioned, or null",
  "extractedUrgencyNote": "Any time pressure mentioned, or null",
  "reasoning": "One sentence explaining why this classification"
}

Priority guidelines:
- URGENT: Safety hazard, emergency, people in danger, service completely down for many
- HIGH: Affects classes/operations happening soon (within hours), multiple people impacted
- MEDIUM: Should be fixed soon but not an emergency
- LOW: Cosmetic, minor inconvenience, can wait

Confidence guidelines:
- HIGH: Description clearly maps to one category with strong signals
- MEDIUM: Could be one of 2 categories, or description is somewhat vague
- LOW: Very vague, could be many things, or not enough information`

  try {
    const result = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    })

    const text = result.text?.trim() || ''
    // Strip markdown code blocks if present
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')

    const parsed = JSON.parse(cleaned) as IntakeClassification

    // Validate required fields
    if (!parsed.module || !parsed.category || !parsed.confidence || !parsed.suggestedTitle) {
      log.warn({ parsed }, 'Incomplete classification response')
      return null
    }

    // Validate module
    if (!['MAINTENANCE', 'IT'].includes(parsed.module)) {
      parsed.module = moduleHint ?? 'MAINTENANCE'
    }

    // Validate confidence
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(parsed.confidence)) {
      parsed.confidence = 'MEDIUM'
    }

    // Validate priority
    if (!['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(parsed.suggestedPriority)) {
      parsed.suggestedPriority = 'MEDIUM'
    }

    return parsed
  } catch (err) {
    log.error({ err: String(err) }, 'Ticket intake classification failed')
    return null
  }
}
