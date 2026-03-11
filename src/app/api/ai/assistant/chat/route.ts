/**
 * POST /api/ai/assistant/chat — AI Assistant conversation endpoint
 *
 * Handles multi-turn conversations with the AI assistant using
 * Google Gemini's function calling feature. The tool-calling loop executes
 * analytics queries, searches, and other operations on behalf of the user,
 * respecting their permissions.
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
import type { ConversationTurn, ActionConfirmation } from '@/lib/types/assistant'

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
const CONVERSATION_CONTEXT_LIMIT = 20 // Keep last N turns to manage token usage
const MODEL = 'gemini-2.0-flash'

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    // Parse & validate request body
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

    return await runWithOrgContext(orgId, async () => {
      // Get tools available to this user (permission-filtered)
      const tools = await getAvailableTools(ctx.userId)

      // Build system prompt with available capabilities
      const toolNames = tools.map((t) => t.name)

      // Fetch org name for a better system prompt
      let orgName = 'your organization'
      try {
        const { rawPrisma } = await import('@/lib/db')
        const org = await rawPrisma.organization.findUnique({
          where: { id: orgId },
          select: { name: true },
        })
        if (org?.name) orgName = org.name
      } catch {
        // Non-critical — proceed with default
      }

      // Fetch user name
      let userName = ctx.email
      try {
        const { rawPrisma } = await import('@/lib/db')
        const user = await rawPrisma.user.findUnique({
          where: { id: ctx.userId },
          select: { name: true },
        })
        if (user?.name) userName = user.name
      } catch {
        // Non-critical
      }

      const systemPrompt = buildSystemPrompt(toolNames, orgName, userName)

      // Build Gemini-format conversation from history
      const recentHistory = body.conversationHistory.slice(
        -CONVERSATION_CONTEXT_LIMIT
      )

      const geminiContents: Array<{ role: string; parts: Array<{ text: string }> }> = []
      for (const turn of recentHistory) {
        geminiContents.push({
          role: turn.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: turn.content }],
        })
      }

      // Add the new user message
      geminiContents.push({ role: 'user', parts: [{ text: body.message }] })

      // ── Tool-calling loop ──────────────────────────────────────────────
      let iterations = 0
      let actionConfirmation: ActionConfirmation | undefined
      let finalMessage: string | null = null

      try {
        const { GoogleGenAI } = await import('@google/genai')
        const client = new GoogleGenAI({ apiKey })

        // Configure tools for Gemini
        const geminiTools = tools.length > 0
          ? [{ functionDeclarations: tools }]
          : undefined

        let result = await client.models.generateContent({
          model: MODEL,
          contents: geminiContents as any,
          config: {
            systemInstruction: systemPrompt,
            tools: geminiTools as any,
          },
        })

        // Process function calls in a loop
        while (iterations < MAX_TOOL_ITERATIONS) {
          const candidate = result.candidates?.[0]
          if (!candidate?.content?.parts) break

          // Check for function calls
          const functionCalls = candidate.content.parts.filter(
            (part: any) => part.functionCall
          )

          if (functionCalls.length === 0) {
            // No more function calls — extract text response
            const textPart = candidate.content.parts.find(
              (part: any) => part.text
            )
            finalMessage = (textPart as any)?.text || null
            break
          }

          iterations++

          // Execute each function call
          const functionResponses: any[] = []
          for (const part of functionCalls) {
            const fc = (part as any).functionCall
            const toolResult = await executeTool(
              fc.name,
              fc.args || {},
              { userId: ctx.userId, organizationId: orgId }
            )

            // Check if this is a confirmation-requiring action
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
              // Not JSON or not a confirmation — that's fine
            }

            functionResponses.push({
              functionResponse: {
                name: fc.name,
                response: { result: toolResult },
              },
            })
          }

          // Add assistant's function call and our responses to the conversation
          geminiContents.push({
            role: 'model',
            parts: candidate.content.parts as any,
          })
          geminiContents.push({
            role: 'user',
            parts: functionResponses as any,
          })

          // Continue the conversation with function results
          result = await client.models.generateContent({
            model: MODEL,
            contents: geminiContents as any,
            config: {
              systemInstruction: systemPrompt,
              tools: geminiTools as any,
            },
          })
        }

        // If we didn't get a final message from the loop, try to extract it
        if (!finalMessage) {
          finalMessage = result.text ||
            "I processed your request but couldn't generate a response. Please try again."
        }
      } catch (apiError) {
        console.error('[ai-assistant] Gemini call failed:', apiError)
        finalMessage =
          "I'm having trouble connecting right now. Please try again in a moment."
      }

      // Build updated conversation history
      const updatedHistory: ConversationTurn[] = [
        ...body.conversationHistory,
        {
          role: 'user',
          content: body.message,
          timestamp: new Date().toISOString(),
        },
        {
          role: 'assistant',
          content: finalMessage,
          timestamp: new Date().toISOString(),
        },
      ]

      return NextResponse.json(
        ok({
          available: true,
          message: finalMessage,
          conversationHistory: updatedHistory,
          ...(actionConfirmation ? { actionConfirmation } : {}),
        })
      )
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
      return NextResponse.json(fail('FORBIDDEN', error.message), {
        status: 403,
      })
    }
    console.error('[POST /api/ai/assistant/chat]', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Something went wrong'),
      { status: 500 }
    )
  }
}
