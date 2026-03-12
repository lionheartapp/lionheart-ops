/**
 * POST /api/ai/assistant/execute-workflow — Execute an approved workflow plan
 *
 * Runs workflow steps sequentially, streaming progress via SSE.
 * Stops on first failure. Each step uses executeTool from the tool registry.
 *
 * SSE events:
 *   data: {"type":"workflow_step_start","stepNumber":1,"tool":"..."}
 *   data: {"type":"workflow_step_complete","stepNumber":1,"result":"..."}
 *   data: {"type":"workflow_step_failed","stepNumber":1,"error":"..."}
 *   data: {"type":"workflow_complete","summary":"..."}
 *   data: {"type":"error","message":"..."}
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { executeTool } from '@/lib/services/ai/assistant-tools'
import type { StreamEvent } from '@/lib/types/assistant'

// ─── Validation ───────────────────────────────────────────────────────────────

const WorkflowStepSchema = z.object({
  stepNumber: z.number(),
  tool: z.string(),
  description: z.string(),
  input: z.record(z.string(), z.unknown()),
})

const ExecuteWorkflowSchema = z.object({
  steps: z.array(WorkflowStepSchema).min(2).max(10),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sseEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

/**
 * Resolve $PREV references in step inputs.
 * Supports: "$PREV.fieldName" to reference the previous step's result field.
 */
function resolveStepInput(
  input: Record<string, unknown>,
  previousResults: Array<Record<string, unknown>>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string' && value.startsWith('$PREV.')) {
      const field = value.slice(6) // Remove "$PREV."
      const lastResult = previousResults[previousResults.length - 1]
      if (lastResult && field in lastResult) {
        resolved[key] = lastResult[field]
      } else {
        resolved[key] = value // Leave unresolved if not found
      }
    } else {
      resolved[key] = value
    }
  }

  return resolved
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)

    const body = ExecuteWorkflowSchema.parse(await req.json())

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const write = (event: StreamEvent) => {
          controller.enqueue(encoder.encode(sseEvent(event)))
        }

        const completedResults: Array<Record<string, unknown>> = []
        const completedMessages: string[] = []

        try {
          for (const step of body.steps) {
            // Emit step start
            write({
              type: 'workflow_step_start',
              stepNumber: step.stepNumber,
              tool: step.tool,
            })

            // Resolve any $PREV references
            const resolvedInput = resolveStepInput(step.input, completedResults)

            // Execute the tool
            const toolResult = await runWithOrgContext(orgId, () =>
              executeTool(step.tool, resolvedInput, {
                userId: ctx.userId,
                organizationId: orgId,
              })
            )

            // Parse the result
            let parsed: Record<string, unknown> = {}
            let resultMessage = 'Done'
            let isError = false

            try {
              parsed = JSON.parse(toolResult)

              if (parsed.error) {
                isError = true
                resultMessage = String(parsed.error)
              } else if (parsed.confirmationRequired && parsed.draft) {
                // For ORANGE/RED tier tools in a workflow, we auto-execute
                // since the user already approved the workflow plan.
                const { executeAction } = await import(
                  '@/lib/services/ai/action-handlers'
                )
                const draft = parsed.draft as Record<string, unknown>
                const actionName = String(draft.action || step.tool)

                const actionResult = await runWithOrgContext(orgId, () =>
                  executeAction(actionName, draft, {
                    userId: ctx.userId,
                    organizationId: orgId,
                  })
                )
                resultMessage = actionResult.message
                parsed = { ...parsed, ...actionResult }
              } else if (parsed.message) {
                resultMessage = String(parsed.message)
              } else if (parsed.count !== undefined) {
                resultMessage = `Found ${parsed.count} results`
              }
            } catch {
              resultMessage = toolResult.slice(0, 200)
            }

            if (isError) {
              write({
                type: 'workflow_step_failed',
                stepNumber: step.stepNumber,
                error: resultMessage,
              })
              // Stop on first failure
              write({
                type: 'workflow_complete',
                summary: `Workflow stopped at step ${step.stepNumber}: ${resultMessage}`,
              })
              return
            }

            completedResults.push(parsed)
            completedMessages.push(`Step ${step.stepNumber}: ${resultMessage}`)

            write({
              type: 'workflow_step_complete',
              stepNumber: step.stepNumber,
              result: resultMessage,
            })
          }

          // All steps completed
          write({
            type: 'workflow_complete',
            summary: `All ${body.steps.length} steps completed successfully.\n${completedMessages.join('\n')}`,
          })
        } catch (error) {
          console.error('[execute-workflow] Error:', error)
          write({
            type: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Workflow execution failed',
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
        fail('VALIDATION_ERROR', 'Invalid workflow', error.issues),
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
    console.error('[POST /api/ai/assistant/execute-workflow]', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Something went wrong'),
      { status: 500 }
    )
  }
}
