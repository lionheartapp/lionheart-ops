/**
 * POST /api/ai/assistant/chat — AI Assistant conversation endpoint (streaming)
 *
 * Handles multi-turn conversations with the AI assistant using
 * Google Gemini's function calling + streaming. Responses are sent
 * as Server-Sent Events (SSE) for real-time text display.
 *
 * SSE event format:
 *   data: {"type":"delta","content":"..."}           — text chunk
 *   data: {"type":"tool_start","tool":"..."}         — tool execution started
 *   data: {"type":"tool_result","tool":"..."}        — tool execution completed
 *   data: {"type":"action_confirmation","action":{}} — needs user confirmation
 *   data: {"type":"conversation_id","conversationId":"..."} — persisted conversation ID
 *   data: {"type":"done","conversationHistory":[]}   — stream complete
 *   data: {"type":"error","message":"..."}           — error occurred
 *
 * Gracefully degrades to { available: false } when GEMINI_API_KEY is not set.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { runWithOrgContext } from '@/lib/org-context'
import { getAvailableTools, executeTool, getToolRiskTier } from '@/lib/services/ai/assistant-tools'
import { buildSystemPrompt } from '@/lib/services/ai/assistant.service'
import { assembleContext } from '@/lib/services/ai/contextAssemblyService'
import { extractMemoryFromConversation } from '@/lib/services/ai/memoryExtractionService'
import {
  createConversation,
  addMessage,
  getConversation,
  updateConversationTitle,
} from '@/lib/services/ai/conversationService'
import type { ConversationTurn, ActionConfirmation, StreamEvent, ConfirmationCardData } from '@/lib/types/assistant'

// ─── Validation ───────────────────────────────────────────────────────────────

const ConversationTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string(),
  choices: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional(),
})

const ImageAttachmentSchema = z.object({
  data: z.string().max(6_000_000), // ~4MB base64 (base64 is ~33% larger than raw)
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  name: z.string().max(255),
})

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationHistory: z.array(ConversationTurnSchema).max(50),
  images: z.array(ImageAttachmentSchema).max(3).optional(),
  conversationId: z.string().optional(),
})

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_TOOL_ITERATIONS = 12
const CONVERSATION_CONTEXT_LIMIT = 20
const MODEL = 'gemini-2.0-flash'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sseEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

/** Fire-and-forget wrapper — logs errors but never throws */
function safeAsync(fn: () => Promise<unknown>, label: string): void {
  fn().catch((err) => {
    console.error(`[ai-assistant] ${label}:`, err)
  })
}

// ─── Marker Extraction ────────────────────────────────────────────────────────

function extractMarkers(text: string): {
  cleanText: string
  choices: string[]
  suggestions: string[]
} {
  let cleanText = text
  let choices: string[] = []
  let suggestions: string[] = []

  const choicesMatch = cleanText.match(/\[CHOICES:\s*([^\]]+)\]/)
  if (choicesMatch) {
    choices = choicesMatch[1].split('|').map(s => s.trim()).filter(Boolean)
    cleanText = cleanText.replace(choicesMatch[0], '').trim()
  }

  const suggestMatch = cleanText.match(/\[SUGGEST:\s*([^\]]+)\]/)
  if (suggestMatch) {
    suggestions = suggestMatch[1].split('|').map(s => s.trim()).filter(Boolean)
    cleanText = cleanText.replace(suggestMatch[0], '').trim()
  }

  return { cleanText, choices, suggestions }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    const body = ChatRequestSchema.parse(await req.json())

    // Check if Gemini is available
    const apiKey = (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY)?.trim()
    if (!apiKey) {
      return NextResponse.json(
        ok({
          available: false,
          message: '',
          conversationHistory: body.conversationHistory,
        })
      )
    }

    // ─── Resolve or create conversation ───────────────────────────────────────
    let conversationId: string
    const isNewConversation = !body.conversationId

    if (body.conversationId) {
      // Verify conversation belongs to current user's org
      const existing = await getConversation(body.conversationId, orgId)
      if (existing) {
        conversationId = existing.id
      } else {
        // Not found or wrong org — start a new conversation
        const conv = await createConversation(ctx.userId, orgId)
        conversationId = conv.id
      }
    } else {
      const conv = await createConversation(ctx.userId, orgId)
      conversationId = conv.id
    }

    // Persist the user's message immediately (fire-and-forget)
    safeAsync(
      () => addMessage(conversationId, {
        role: 'user',
        content: body.message,
        organizationId: orgId,
      }),
      'persist user message'
    )

    // Auto-title new conversations from the first user message
    if (isNewConversation) {
      safeAsync(
        () => updateConversationTitle(conversationId, body.message.slice(0, 100)),
        'auto-title conversation'
      )
    }

    // We need to gather context before creating the stream
    const tools = await runWithOrgContext(orgId, () => getAvailableTools(ctx.userId))
    const toolNames = tools.map((t) => t.name)

    // Fetch org name + user name/role for system prompt
    let orgName = 'your organization'
    let userName = ctx.email
    let userRole = 'member'
    try {
      const { rawPrisma } = await import('@/lib/db')
      const [org, user] = await Promise.all([
        rawPrisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
        rawPrisma.user.findUnique({
          where: { id: ctx.userId },
          select: { name: true, userRole: { select: { name: true } } },
        }),
      ])
      if (org?.name) orgName = org.name
      if (user?.name) userName = user.name
      if (user?.userRole?.name) userRole = user.userRole.name
    } catch {
      // Non-critical
    }

    // Assemble personalized context (user profile + relevant memory facts + recent summaries)
    // Failure-tolerant: errors are caught inside assembleContext and return empty context
    let assembledCtx
    try {
      assembledCtx = await assembleContext(ctx.userId, orgId, body.message)
    } catch {
      // Non-critical — proceed without personalized context
    }

    const systemPrompt = buildSystemPrompt(toolNames, orgName, userName, userRole, new Date().toISOString(), assembledCtx)

    // Build Gemini-format conversation from history
    const recentHistory = body.conversationHistory.slice(-CONVERSATION_CONTEXT_LIMIT)
    const geminiContents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = []
    for (const turn of recentHistory) {
      geminiContents.push({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.content }],
      })
    }
    // Build current user message parts (text + optional images)
    const currentUserParts: Array<Record<string, unknown>> = [{ text: body.message }]
    if (body.images && body.images.length > 0) {
      for (const img of body.images) {
        currentUserParts.push({
          inlineData: { data: img.data, mimeType: img.mimeType },
        })
      }
    }
    geminiContents.push({ role: 'user', parts: currentUserParts })

    const geminiTools = tools.length > 0 ? [{ functionDeclarations: tools }] : undefined

    // Capture conversationId in closure for stream
    const activeConversationId = conversationId

    // Create SSE streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const write = (event: StreamEvent) => {
          controller.enqueue(encoder.encode(sseEvent(event)))
        }

        try {
          // Emit conversation ID so the frontend can track this conversation
          write({ type: 'conversation_id', conversationId: activeConversationId })

          const { GoogleGenAI } = await import('@google/genai')
          const client = new GoogleGenAI({ apiKey })

          let iterations = 0
          let actionConfirmation: ActionConfirmation | undefined
          let richCard: ConfirmationCardData | undefined

          // Outer loop: handle tool calls iteratively
          // First call is streaming; subsequent calls after tool execution are non-streaming
          // for simplicity (tool results feed back, then we stream again).
          let isFirstCall = true
          let finalText = ''

          while (iterations <= MAX_TOOL_ITERATIONS) {
            if (isFirstCall || iterations > 0) {
              if (isFirstCall) {
                // Stream the first response
                const streamResponse = await client.models.generateContentStream({
                  model: MODEL,
                  contents: geminiContents as any,
                  config: {
                    systemInstruction: systemPrompt,
                    tools: geminiTools as any,
                  },
                })

                let accumulatedText = ''
                let functionCalls: Array<{ name: string; args: Record<string, unknown> }> = []

                for await (const chunk of streamResponse) {
                  const candidate = chunk.candidates?.[0]
                  if (!candidate?.content?.parts) continue

                  for (const part of candidate.content.parts) {
                    const p = part as any
                    if (p.text) {
                      accumulatedText += p.text
                      write({ type: 'delta', content: p.text })
                    }
                    if (p.functionCall) {
                      functionCalls.push({
                        name: p.functionCall.name,
                        args: p.functionCall.args || {},
                      })
                    }
                  }
                }

                isFirstCall = false

                if (functionCalls.length === 0) {
                  // No tool calls — we're done
                  finalText = accumulatedText
                  break
                }

                // Process tool calls
                iterations++

                // Add the model's response to conversation
                const modelParts: any[] = []
                if (accumulatedText) modelParts.push({ text: accumulatedText })
                for (const fc of functionCalls) {
                  modelParts.push({ functionCall: { name: fc.name, args: fc.args } })

                  // Persist tool call (fire-and-forget)
                  const fcCopy = fc
                  safeAsync(
                    () => addMessage(activeConversationId, {
                      role: 'tool_call',
                      content: JSON.stringify({ name: fcCopy.name, args: fcCopy.args }),
                      toolName: fcCopy.name,
                      organizationId: orgId,
                    }),
                    `persist tool_call ${fc.name}`
                  )
                }
                geminiContents.push({ role: 'model', parts: modelParts })

                // Execute each tool
                const functionResponses: any[] = []
                for (const fc of functionCalls) {
                  write({ type: 'tool_start', tool: fc.name, input: fc.args })

                  const toolResult = await runWithOrgContext(orgId, () =>
                    executeTool(fc.name, fc.args, { userId: ctx.userId, organizationId: orgId })
                  )

                  // Check for action confirmation / workflow plan
                  let parsed: any = null
                  try {
                    parsed = JSON.parse(toolResult)
                    if (parsed.workflowPlan) {
                      write({ type: 'workflow_plan' as any, plan: { title: parsed.title, steps: parsed.steps, stepCount: parsed.stepCount } })
                    } else if (parsed.confirmationRequired && parsed.draft) {
                      const tier = getToolRiskTier(fc.name)
                      actionConfirmation = {
                        type: parsed.draft.action as ActionConfirmation['type'],
                        description: parsed.message,
                        payload: parsed.draft,
                        ...(tier === 'RED' ? { riskTier: 'RED' as const, riskWarning: parsed.riskWarning } : {}),
                      }
                      if (parsed.richCard) {
                        richCard = parsed.richCard as ConfirmationCardData
                      }
                    }
                  } catch {
                    // Not JSON or not a confirmation
                  }

                  // Persist tool result (fire-and-forget)
                  const toolSuccess = parsed ? !parsed.error : true
                  const fcName = fc.name
                  safeAsync(
                    () => addMessage(activeConversationId, {
                      role: 'tool_result',
                      content: toolResult,
                      toolName: fcName,
                      toolSuccess,
                      organizationId: orgId,
                    }),
                    `persist tool_result ${fc.name}`
                  )

                  // Summarize for the UI
                  let summary = 'Done'
                  try {
                    const p = JSON.parse(toolResult)
                    if (p.error) summary = `Error: ${p.error}`
                    else if (p.count !== undefined) summary = `Found ${p.count} results`
                    else if (p.confirmationRequired) summary = 'Ready for confirmation'
                    else summary = 'Data retrieved'
                  } catch {
                    summary = 'Completed'
                  }
                  write({ type: 'tool_result', tool: fc.name, summary })

                  functionResponses.push({
                    functionResponse: { name: fc.name, response: { result: toolResult } },
                  })
                }

                geminiContents.push({ role: 'user', parts: functionResponses })

                // Continue loop — next iteration will stream the follow-up
              } else {
                // Subsequent calls after tool execution — stream them too
                const streamResponse = await client.models.generateContentStream({
                  model: MODEL,
                  contents: geminiContents as any,
                  config: {
                    systemInstruction: systemPrompt,
                    tools: geminiTools as any,
                  },
                })

                let accumulatedText = ''
                let functionCalls: Array<{ name: string; args: Record<string, unknown> }> = []

                for await (const chunk of streamResponse) {
                  const candidate = chunk.candidates?.[0]
                  if (!candidate?.content?.parts) continue

                  for (const part of candidate.content.parts) {
                    const p = part as any
                    if (p.text) {
                      accumulatedText += p.text
                      write({ type: 'delta', content: p.text })
                    }
                    if (p.functionCall) {
                      functionCalls.push({
                        name: p.functionCall.name,
                        args: p.functionCall.args || {},
                      })
                    }
                  }
                }

                if (functionCalls.length === 0) {
                  finalText = accumulatedText
                  break
                }

                iterations++
                if (iterations > MAX_TOOL_ITERATIONS) {
                  finalText = accumulatedText || "I've done a lot of processing. Let me know if you need anything else."
                  break
                }

                // Add model response + execute tools
                const modelParts: any[] = []
                if (accumulatedText) modelParts.push({ text: accumulatedText })
                for (const fc of functionCalls) {
                  modelParts.push({ functionCall: { name: fc.name, args: fc.args } })

                  // Persist tool call (fire-and-forget)
                  const fcCopy = fc
                  safeAsync(
                    () => addMessage(activeConversationId, {
                      role: 'tool_call',
                      content: JSON.stringify({ name: fcCopy.name, args: fcCopy.args }),
                      toolName: fcCopy.name,
                      organizationId: orgId,
                    }),
                    `persist tool_call ${fc.name}`
                  )
                }
                geminiContents.push({ role: 'model', parts: modelParts })

                const functionResponses: any[] = []
                for (const fc of functionCalls) {
                  write({ type: 'tool_start', tool: fc.name, input: fc.args })

                  const toolResult = await runWithOrgContext(orgId, () =>
                    executeTool(fc.name, fc.args, { userId: ctx.userId, organizationId: orgId })
                  )

                  let parsed: any = null
                  try {
                    parsed = JSON.parse(toolResult)
                    if (parsed.confirmationRequired && parsed.draft) {
                      actionConfirmation = {
                        type: parsed.draft.action as ActionConfirmation['type'],
                        description: parsed.message,
                        payload: parsed.draft,
                      }
                      // Capture rich card data if present (event drafts include this)
                      if (parsed.richCard) {
                        richCard = parsed.richCard as ConfirmationCardData
                      }
                    }
                  } catch { /* */ }

                  // Persist tool result (fire-and-forget)
                  const toolSuccess = parsed ? !parsed.error : true
                  const fcName = fc.name
                  safeAsync(
                    () => addMessage(activeConversationId, {
                      role: 'tool_result',
                      content: toolResult,
                      toolName: fcName,
                      toolSuccess,
                      organizationId: orgId,
                    }),
                    `persist tool_result ${fc.name}`
                  )

                  let summary = 'Done'
                  try {
                    const p = JSON.parse(toolResult)
                    if (p.error) summary = `Error: ${p.error}`
                    else if (p.count !== undefined) summary = `Found ${p.count} results`
                    else if (p.confirmationRequired) summary = 'Ready for confirmation'
                    else summary = 'Data retrieved'
                  } catch { summary = 'Completed' }
                  write({ type: 'tool_result', tool: fc.name, summary })

                  functionResponses.push({
                    functionResponse: { name: fc.name, response: { result: toolResult } },
                  })
                }

                geminiContents.push({ role: 'user', parts: functionResponses })
              }
            }
          }

          if (!finalText) {
            finalText = "I processed your request but couldn't generate a response. Please try again."
          }

          // Extract markers from completed text
          let { cleanText, choices, suggestions } = extractMarkers(finalText)
          finalText = cleanText

          // Persist the assistant's final response (fire-and-forget)
          safeAsync(
            () => addMessage(activeConversationId, {
              role: 'assistant',
              content: finalText,
              organizationId: orgId,
            }),
            'persist assistant response'
          )

          // Send action confirmation if any
          if (actionConfirmation) {
            write({ type: 'action_confirmation', action: actionConfirmation })

            // Emit rich_confirmation as a SEPARATE event per CONTEXT.md locked decision.
            // ChatPanel's rich_confirmation handler (from Plan 01) will override pendingAction
            // with rich card data, causing RichConfirmationCard to render instead of ActionConfirmation.
            // Ordering matters: action_confirmation fires first (backward compat), then
            // rich_confirmation overrides with the richer data for event creations.
            if (richCard) {
              write({ type: 'rich_confirmation', card: richCard })
            }

            // Don't send choices when there's an action confirmation — the
            // confirmation card handles yes/no. Sending both causes double-fire
            // if the user clicks a choice while the overlay is present.
            choices = []
          }

          // Emit structured events
          if (choices.length > 0) write({ type: 'choices', options: choices })
          if (suggestions.length > 0) write({ type: 'suggestions', items: suggestions })

          // Build updated conversation history
          const updatedHistory: ConversationTurn[] = [
            ...body.conversationHistory,
            { role: 'user', content: body.message, timestamp: new Date().toISOString() },
            {
              role: 'assistant',
              content: finalText,
              timestamp: new Date().toISOString(),
              ...(choices.length > 0 ? { choices } : {}),
              ...(suggestions.length > 0 ? { suggestions } : {}),
            },
          ]

          write({ type: 'done', conversationHistory: updatedHistory })

          // Trigger memory extraction after conversations with 5+ messages (fire-and-forget)
          // This runs in the background after the SSE stream completes
          const totalMessages = body.conversationHistory.length + 1 // +1 for current user message
          if (totalMessages >= 5) {
            safeAsync(
              () => extractMemoryFromConversation(activeConversationId, ctx.userId),
              'memory extraction'
            )
          }
        } catch (error) {
          console.error('[ai-assistant] Streaming error:', error)
          write({
            type: 'error',
            message: "I'm having trouble connecting right now. Please try again in a moment.",
          })
        } finally {
          controller.close()
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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid request', error.issues),
        { status: 400 }
      )
    }
    if (
      error instanceof Error &&
      error.message.includes('Insufficient permissions')
    ) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[POST /api/ai/assistant/chat]', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Something went wrong'),
      { status: 500 }
    )
  }
}
