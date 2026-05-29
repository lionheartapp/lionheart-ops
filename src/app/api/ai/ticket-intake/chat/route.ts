/**
 * POST /api/ai/ticket-intake/chat — Conversational ticket intake (streaming)
 *
 * Multi-turn chat for ticket submission. AI troubleshoots, asks clarifying
 * questions, and either helps self-resolve or creates a structured ticket.
 *
 * SSE events:
 *   delta         — text chunk
 *   ticket_ready  — AI produced a ticket summary for confirmation
 *   self_resolved — Issue was fixed during troubleshooting
 *   done          — stream complete
 *   error         — error occurred
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { canAny } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { checkAiAvailability, incrementAiUsage } from '@/lib/services/ai/ai-availability'
import { buildIntakeSystemPrompt, type IntakeChatContext } from '@/lib/services/ai/ticket-intake-chat.service'
// eslint-disable-next-line no-restricted-imports -- Ticket intake supports unauthenticated QR/magic-link flows; org lookup is manually scoped by orgId from the validated request.
import { rawPrisma } from '@/lib/db'
import { logger } from '@/lib/logger'

const log = logger.child({ route: '/api/ai/ticket-intake/chat' })

// ─── Validation ──────────────────────────────────────────────────────────────

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
})

const RequestSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z.array(MessageSchema).max(30).default([]),
  source: z.enum(['DASHBOARD', 'QR_CODE', 'MAGIC_LINK']).default('DASHBOARD'),
  prefilledLocation: z.string().nullable().optional(),
  prefilledCategory: z.string().nullable().optional(),
  // For unauthenticated flows (QR/magic link)
  orgId: z.string().optional(),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface StreamEvent {
  type: 'delta' | 'ticket_ready' | 'self_resolved' | 'done' | 'error'
  content?: string
  ticket?: Record<string, unknown>
  resolution?: Record<string, unknown>
}

function sseEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

function extractJsonBlock(text: string, tag: string): Record<string, unknown> | null {
  const regex = new RegExp('```' + tag + '\\s*\\n([\\s\\S]*?)\\n```', 'i')
  const match = text.match(regex)
  if (!match) return null
  try {
    return JSON.parse(match[1]) as Record<string, unknown>
  } catch {
    return null
  }
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = RequestSchema.parse(await req.json())

    // Auth: authenticated users use org from header, unauthenticated use body.orgId
    let orgId: string
    let userId: string | null = null

    try {
      orgId = getOrgIdFromRequest(req)
      const ctx = await getUserContext(req)
      userId = ctx.userId
      const canSubmitTicket = await canAny(userId, [
        PERMISSIONS.IT_TICKET_SUBMIT,
        PERMISSIONS.MAINTENANCE_SUBMIT,
      ])
      if (!canSubmitTicket) {
        return new Response(
          JSON.stringify({ ok: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      }
    } catch {
      // Unauthenticated (QR/magic link) — orgId must be in body
      if (!body.orgId) {
        return new Response(
          JSON.stringify({ ok: false, error: { code: 'AUTH_REQUIRED', message: 'Authentication or orgId required' } }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
      }
      orgId = body.orgId
    }

    // Check AI availability
    const availability = await checkAiAvailability(orgId)
    if (!availability.available) {
      return new Response(
        JSON.stringify({
          ok: true,
          data: { available: false, reason: availability.reason },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get org name for the system prompt
    const org = await rawPrisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    })

    const chatContext: IntakeChatContext = {
      organizationId: orgId,
      orgName: org?.name ?? 'School',
      userId,
      source: body.source,
      prefilledLocation: body.prefilledLocation,
      prefilledCategory: body.prefilledCategory,
    }

    const systemPrompt = await buildIntakeSystemPrompt(chatContext)

    // Build conversation for Gemini
    const contents = [
      ...body.history.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
        parts: [{ text: msg.content }],
      })),
      {
        role: 'user' as const,
        parts: [{ text: body.message }],
      },
    ]

    const apiKey = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY)!
    const client = new GoogleGenAI({ apiKey })

    // Stream response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        let closed = false
        const send = (event: StreamEvent): boolean => {
          if (closed) return false
          try {
            controller.enqueue(encoder.encode(sseEvent(event)))
            return true
          } catch {
            closed = true
            return false
          }
        }
        const close = () => {
          if (closed) return
          try {
            controller.close()
          } catch {
            // The browser may have already closed the stream.
          } finally {
            closed = true
          }
        }

        try {
          const response = await client.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents,
            config: {
              systemInstruction: systemPrompt,
              temperature: 0.7,
              maxOutputTokens: 1024,
            },
          })

          let fullText = ''

          for await (const chunk of response) {
            const text = chunk.text ?? ''
            if (text) {
              fullText += text
              if (!send({ type: 'delta', content: text })) return
            }
          }

          if (closed) return

          // Increment AI usage
          await incrementAiUsage(orgId)

          // Check for structured blocks in the complete response
          const ticketData = extractJsonBlock(fullText, 'ticket')
          if (ticketData) {
            if (!send({
              type: 'ticket_ready',
              ticket: ticketData,
            })) return
          }

          const resolvedData = extractJsonBlock(fullText, 'resolved')
          if (resolvedData) {
            if (!send({
              type: 'self_resolved',
              resolution: resolvedData,
            })) return
          }

          send({ type: 'done' })
          close()
        } catch (err) {
          if (!closed) {
            log.error({ err: String(err) }, 'Ticket intake chat stream failed')
          }
          send({
            type: 'error',
            content: 'Something went wrong. You can still submit your issue using the manual form.',
          })
          close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }
    log.error({ err: String(err) }, 'Ticket intake chat failed')
    return new Response(
      JSON.stringify({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
