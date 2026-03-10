/**
 * POST /api/ai/assistant/chat — AI Assistant conversation endpoint
 *
 * Handles multi-turn conversations with the AI assistant using
 * Anthropic Claude's tool_use feature. The tool-calling loop executes
 * analytics queries, searches, and other operations on behalf of the user,
 * respecting their permissions.
 *
 * Gracefully degrades to { available: false } when ANTHROPIC_API_KEY is not set.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { runWithOrgContext } from '@/lib/org-context'
import { getClaudeClient, MODEL } from '@/lib/services/ai/claude-client'
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
const MAX_RESPONSE_TOKENS = 2048
const CONVERSATION_CONTEXT_LIMIT = 20 // Keep last N turns to manage token usage

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    // Parse & validate request body
    const body = ChatRequestSchema.parse(await req.json())

    // Check if Claude is available
    const client = getClaudeClient()
    if (!client) {
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
      const systemPrompt = buildSystemPrompt(
        toolNames,
        ctx.organizationId, // Will be replaced with org name below
        ctx.email
      )

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

      const finalSystemPrompt = buildSystemPrompt(toolNames, orgName, userName)

      // Build Claude messages from conversation history
      // Trim to last N turns to manage token budget
      const recentHistory = body.conversationHistory.slice(
        -CONVERSATION_CONTEXT_LIMIT
      )
      const claudeMessages: Anthropic.MessageParam[] = recentHistory.map(
        (turn) => ({
          role: turn.role,
          content: turn.content,
        })
      )

      // Add the new user message
      claudeMessages.push({ role: 'user', content: body.message })

      // ── Tool-calling loop ──────────────────────────────────────────────
      let response: Anthropic.Message
      let iterations = 0
      let actionConfirmation: ActionConfirmation | undefined

      try {
        response = await client.messages.create({
          model: MODEL,
          max_tokens: MAX_RESPONSE_TOKENS,
          system: finalSystemPrompt,
          tools: tools.length > 0 ? tools : undefined,
          messages: claudeMessages,
        })
      } catch (apiError) {
        console.error('[ai-assistant] Initial Claude call failed:', apiError)
        return NextResponse.json(
          ok({
            available: true,
            message:
              "I'm having trouble connecting right now. Please try again in a moment.",
            conversationHistory: [
              ...body.conversationHistory,
              {
                role: 'user' as const,
                content: body.message,
                timestamp: new Date().toISOString(),
              },
              {
                role: 'assistant' as const,
                content:
                  "I'm having trouble connecting right now. Please try again in a moment.",
                timestamp: new Date().toISOString(),
              },
            ],
          })
        )
      }

      // Process tool calls
      while (response.stop_reason === 'tool_use' && iterations < MAX_TOOL_ITERATIONS) {
        iterations++

        const toolUseBlocks = response.content.filter(
          (block) => block.type === 'tool_use'
        )

        if (toolUseBlocks.length === 0) break

        // Execute each tool call
        const toolResults: Anthropic.ToolResultBlockParam[] = []
        for (const block of toolUseBlocks) {
          if (block.type !== 'tool_use') continue
          const toolUse = block as Anthropic.ToolUseBlock

          const result = await executeTool(
            toolUse.name,
            toolUse.input as Record<string, unknown>,
            { userId: ctx.userId, organizationId: orgId }
          )

          // Check if this is a confirmation-requiring action
          try {
            const parsed = JSON.parse(result)
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

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: result,
          })
        }

        // Send tool results back to Claude
        claudeMessages.push({
          role: 'assistant',
          content: response.content as any,
        })
        claudeMessages.push({
          role: 'user',
          content: toolResults,
        })

        try {
          response = await client.messages.create({
            model: MODEL,
            max_tokens: MAX_RESPONSE_TOKENS,
            system: finalSystemPrompt,
            tools: tools.length > 0 ? tools : undefined,
            messages: claudeMessages,
          })
        } catch (apiError) {
          console.error('[ai-assistant] Tool loop Claude call failed:', apiError)
          break
        }
      }

      // Extract final text from response
      const textBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      )
      const finalMessage =
        textBlock?.text ||
        "I processed your request but couldn't generate a response. Please try again."

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
