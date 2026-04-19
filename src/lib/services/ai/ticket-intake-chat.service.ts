/**
 * Conversational Ticket Intake Service
 *
 * Powers the AI chat-based ticket submission flow. The AI:
 * 1. Understands what the user's issue is
 * 2. Asks clarifying questions
 * 3. Tries troubleshooting steps (references KB articles)
 * 4. Either helps self-resolve or builds a structured ticket
 *
 * Safety triggers (water leak, fire, hazard) skip troubleshooting
 * and create an urgent ticket immediately.
 */

import { rawPrisma } from '@/lib/db'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IntakeChatContext {
  organizationId: string
  orgName: string
  userId?: string | null
  source: 'DASHBOARD' | 'QR_CODE' | 'MAGIC_LINK'
  prefilledLocation?: string | null
  prefilledCategory?: string | null
}

// ─── System Prompt Builder ────────────────────────────────────────────────────

export async function buildIntakeSystemPrompt(ctx: IntakeChatContext): Promise<string> {
  // Fetch org's KB articles for troubleshooting context
  const kbArticles = await rawPrisma.knowledgeArticle.findMany({
    where: {
      organizationId: ctx.organizationId,
      isPublished: true,
      deletedAt: null,
    },
    select: { title: true, content: true, type: true, tags: true },
    take: 20,
    orderBy: { updatedAt: 'desc' },
  })

  // Fetch form field configs (what to ask about per category)
  const formDefs = await rawPrisma.formDefinition.findMany({
    where: {
      organizationId: ctx.organizationId,
      categoryKey: { not: null },
    },
    include: {
      fields: { orderBy: { sortOrder: 'asc' } },
    },
  })

  // Fetch buildings/rooms for location validation
  const buildings = await rawPrisma.building.findMany({
    where: { organizationId: ctx.organizationId, deletedAt: null },
    select: {
      name: true,
      rooms: {
        where: { deletedAt: null },
        select: { roomNumber: true, displayName: true },
        take: 50,
      },
    },
    take: 10,
  })

  // Build KB context
  const kbContext = kbArticles.length > 0
    ? `\n\nKNOWLEDGE BASE (reference these for troubleshooting):\n${kbArticles.map((a) =>
        `- [${a.type}] ${a.title}: ${(a.content ?? '').slice(0, 300)}${(a.content ?? '').length > 300 ? '...' : ''}`
      ).join('\n')}`
    : ''

  // Build category field hints
  const fieldHints = formDefs.length > 0
    ? `\n\nPER-CATEGORY INFO TO GATHER:\n${formDefs.map((fd) =>
        `- ${fd.categoryKey}: ${fd.fields.map((f) => `${f.label}${f.required ? ' (required)' : ''}`).join(', ')}`
      ).join('\n')}`
    : ''

  // Build location context
  const locationContext = buildings.length > 0
    ? `\n\nCAMPUS LOCATIONS:\n${buildings.map((b) =>
        `- ${b.name}: ${b.rooms.map((r) => r.displayName ?? r.roomNumber).join(', ')}`
      ).join('\n')}`
    : ''

  const prefilledNote = [
    ctx.prefilledLocation ? `The user's location is already known: ${ctx.prefilledLocation}. Don't ask for it again.` : '',
    ctx.prefilledCategory ? `The issue category is pre-set to: ${ctx.prefilledCategory}. Start with relevant questions for this category.` : '',
  ].filter(Boolean).join(' ')

  return `You are a friendly, helpful IT and facilities support assistant for ${ctx.orgName}, a school. You help staff report issues and try to solve simple problems before creating a ticket.

YOUR APPROACH:
1. Greet warmly and ask what's going on (if no message yet)
2. Understand the issue from the user's plain-language description
3. If the location is unknown, ask which room/building they're in
4. For simple, common issues — suggest 1-3 quick troubleshooting steps
5. If troubleshooting resolves it, celebrate and offer to close without a ticket
6. If not resolved (or if the issue clearly needs a technician), gather any missing details and prepare a ticket summary
7. Show the ticket summary and ask for confirmation before submitting

SAFETY TRIGGERS — skip troubleshooting entirely, create ticket immediately:
- Water leak, flooding, burst pipe
- Fire, smoke, burning smell
- Electrical hazard, exposed wires, sparking
- Gas smell
- Structural damage (ceiling collapse, broken glass where someone could get hurt)
- Any situation where someone is in danger
For these, respond with the ticket JSON immediately and tell the user help is on the way.

TONE:
- Conversational, warm, not robotic
- Short messages (2-4 sentences max per response)
- No jargon — speak like a helpful colleague, not a tech manual
- Use "I" not "we" — you're a single helper, not a committee

TICKET CREATION:
When you have enough info to create a ticket, respond with a message that includes a JSON block in this exact format:

\`\`\`ticket
{
  "ready": true,
  "module": "IT" or "MAINTENANCE",
  "category": "HARDWARE",
  "title": "Short clear title",
  "description": "Full description including troubleshooting attempted",
  "priority": "LOW" | "NORMAL" | "HIGH" | "URGENT",
  "locationText": "Building — Room",
  "customFields": { "device_type": "Projector", "asset_tag": "DEV-0042" }
}
\`\`\`

Include this JSON block ONLY when you're presenting the summary for user confirmation. The text around it should be your conversational message asking them to confirm.

SELF-RESOLUTION:
If the user says the issue is fixed (after troubleshooting), respond with:

\`\`\`resolved
{
  "selfResolved": true,
  "category": "HARDWARE",
  "issueDescription": "What the issue was",
  "resolutionNote": "How it was fixed"
}
\`\`\`

${prefilledNote}
${kbContext}
${fieldHints}
${locationContext}

Remember: Keep responses SHORT. 2-4 sentences. Ask ONE question at a time. Be genuinely helpful, not just a form in disguise.`
}
