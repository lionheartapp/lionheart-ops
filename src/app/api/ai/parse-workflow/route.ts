import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { geminiService } from '@/lib/services/ai/gemini.service'
import type { WorkflowContext, ParsedWorkflow } from '@/lib/services/ai/gemini.service'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const contextItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  schoolName: z.string().optional(),
  teamName: z.string().optional(),
})

const ParseWorkflowSchema = z.object({
  text: z.string().trim().min(10).max(5000),
  context: z.object({
    schools: z.array(contextItemSchema),
    campuses: z.array(contextItemSchema),
    categories: z.array(contextItemSchema),
    teams: z.array(contextItemSchema),
    members: z.array(contextItemSchema),
  }),
})

export async function POST(req: NextRequest) {
  const log = logger.child({ route: '/api/ai/parse-workflow', method: 'POST' })
  try {
    await getUserContext(req)
    const body = await req.json()
    const { text, context } = ParseWorkflowSchema.parse(body)

    const parsed = await geminiService.parseApprovalWorkflow(text, context as WorkflowContext)

    // Resolve names to IDs
    const resolved = resolveWorkflowNames(parsed, context as WorkflowContext)

    return NextResponse.json(ok(resolved))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    log.error({ err: error }, 'Failed to parse workflow')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to parse workflow'), { status: 500 })
  }
}

function resolveWorkflowNames(
  parsed: ParsedWorkflow,
  context: WorkflowContext,
) {
  const fuzzy = (name: string | null | undefined, items: Array<{ id: string; name: string }>) => {
    if (!name) return null
    const lower = name.toLowerCase()
    const exact = items.find(i => i.name.toLowerCase() === lower)
    if (exact) return exact.id
    const partial = items.find(
      i => i.name.toLowerCase().includes(lower) || lower.includes(i.name.toLowerCase()),
    )
    return partial?.id ?? null
  }

  return {
    rules: parsed.rules.map((rule) => {
      return {
        name: rule.name,
        schoolId: fuzzy(rule.schoolName, context.schools),
        campusId: fuzzy(rule.campusName, context.campuses),
        categoryId: fuzzy(rule.categoryName, context.categories),
        executionMode: rule.executionMode || 'PARALLEL',
        isDefault: !rule.schoolName && !rule.campusName && !rule.categoryName,
        steps: rule.steps.map(step => {
          if (step.type === 'person') {
            const member = context.members.find(m =>
              m.name.toLowerCase().includes(step.name.toLowerCase()) ||
              step.name.toLowerCase().includes(m.name.toLowerCase())
            )
            const team = member?.teamName
              ? context.teams.find(t => t.name.toLowerCase() === member.teamName!.toLowerCase())
              : context.teams[0]
            return {
              teamId: team?.id || context.teams[0]?.id,
              assignedUserId: member?.id || null,
              assignedUserName: member?.name || step.name,
              teamName: team?.name || context.teams[0]?.name,
              mode: step.mode || 'REQUIRED',
              trigger: step.trigger || 'ALWAYS',
            }
          }
          const team = context.teams.find(t =>
            t.name.toLowerCase().includes(step.name.toLowerCase()) ||
            step.name.toLowerCase().includes(t.name.toLowerCase())
          )
          return {
            teamId: team?.id || null,
            assignedUserId: null,
            assignedUserName: null,
            teamName: team?.name || step.name,
            mode: step.mode || 'REQUIRED',
            trigger: step.trigger || 'ALWAYS',
          }
        }),
      }
    }),
    summary: parsed.summary,
  }
}
