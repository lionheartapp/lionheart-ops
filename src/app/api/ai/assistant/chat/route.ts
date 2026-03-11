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
import { getAvailableTools, executeTool } from '@/lib/services/ai/assistant-tools'
import { buildSystemPrompt } from '@/lib/services/ai/assistant.service'
import type { ConversationTurn, ActionConfirmation, StreamEvent } from '@/lib/types/assistant'

// ─── Validation ───────────────────────────────────────────────────────────────

const ConversationTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string(),
})

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationHistory: z.array(ConversationTurnSchema).max(50),
})

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_TOOL_ITERATIONS = 8
const CONVERSATION_CONTEXT_LIMIT = 20
const MODEL = 'gemini-2.0-flash'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sseEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
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

    const systemPrompt = buildSystemPrompt(toolNames, orgName, userName, userRole)

    // Build Gemini-format conversation from history
    const recentHistory = body.conversationHistory.slice(-CONVERSATION_CONTEXT_LIMIT)
    const geminiContents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = []
    for (const turn of recentHistory) {
      geminiContents.push({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.content }],
      })
    }
    geminiContents.push({ role: 'user', parts: [{ text: body.message }] })

    const geminiTools = tools.length > 0 ? [{ functionDeclarations: tools }] : undefined

    // Create SSE streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const write = (event: StreamEvent) => {
          controller.enqueue(encoder.encode(sseEvent(event)))
        }

        try {
          const { GoogleGenAI } = await import('@google/genai')
          const client = new GoogleGenAI({ apiKey })

          let iterations = 0
          let actionConfirmation: ActionConfirmation | undefined

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
                }
                geminiContents.push({ role: 'model', parts: modelParts })

                // Execute each tool
                const functionResponses: any[] = []
                for (const fc of functionCalls) {
                  write({ type: 'tool_start', tool: fc.name, input: fc.args })

                  const toolResult = await runWithOrgContext(orgId, () =>
                    executeTool(fc.name, fc.args, { userId: ctx.userId, organizationId: orgId })
                  )

                  // Check for action confirmation
                  try {
                    const parsed = JSON.parse(toolResult)
                    if (parsed.confirmationRequired && parsed.draft) {
                      actionConfirmation = {
                        type: parsed.draft.action as ActionConfirmation['type'],
                        description: parsed.message,
                        payload: parsed.draft,
                      }
                    }
                  } catch {
                    // Not JSON or not a confirmation
                  }

                  // Summarize for the UI
                  let summary = 'Done'
                  try {
                    const parsed = JSON.parse(toolResult)
                    if (parsed.error) summary = `Error: ${parsed.error}`
                    else if (parsed.count !== undefined) summary = `Found ${parsed.count} results`
                    else if (parsed.confirmationRequired) summary = 'Ready for confirmation'
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
                }
                geminiContents.push({ role: 'model', parts: modelParts })

                const functionResponses: any[] = []
                for (const fc of functionCalls) {
                  write({ type: 'tool_start', tool: fc.name, input: fc.args })

                  const toolResult = await runWithOrgContext(orgId, () =>
                    executeTool(fc.name, fc.args, { userId: ctx.userId, organizationId: orgId })
                  )

                  try {
                    const parsed = JSON.parse(toolResult)
                    if (parsed.confirmationRequired && parsed.draft) {
                      actionConfirmation = {
                        type: parsed.draft.action as ActionConfirmation['type'],
                        description: parsed.message,
                        payload: parsed.draft,
                      }
                    }
                  } catch { /* */ }

                  let summary = 'Done'
                  try {
                    const parsed = JSON.parse(toolResult)
                    if (parsed.error) summary = `Error: ${parsed.error}`
                    else if (parsed.count !== undefined) summary = `Found ${parsed.count} results`
                    else if (parsed.confirmationRequired) summary = 'Ready for confirmation'
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

          // Send action confirmation if any
          if (actionConfirmation) {
            write({ type: 'action_confirmation', action: actionConfirmation })
          }

          // Build updated conversation history
          const updatedHistory: ConversationTurn[] = [
            ...body.conversationHistory,
            { role: 'user', content: body.message, timestamp: new Date().toISOString() },
            { role: 'assistant', content: finalText, timestamp: new Date().toISOString() },
          ]

          write({ type: 'done', conversationHistory: updatedHistory })
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
