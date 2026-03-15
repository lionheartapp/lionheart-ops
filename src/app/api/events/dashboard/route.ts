import { NextRequest, NextResponse } from 'next/server'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ok, fail, isAuthError } from '@/lib/api-response'
import {
  collectRawActionItems,
  getAIPrioritizedActions,
  getDashboardStats,
} from '@/lib/services/eventDashboardService'
import { updateEventTask, approveEventProject } from '@/lib/services/eventProjectService'
import { z } from 'zod'

// ─── GET /api/events/dashboard ────────────────────────────────────────────────
// Optional ?skipAI=true for fast raw items (no Gemini scoring).
// Returns: { items, stats }

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_READ)

    const skipAI = req.nextUrl.searchParams.get('skipAI') === 'true'

    return await runWithOrgContext(orgId, async () => {
      if (skipAI) {
        // Fast path: raw items sorted by due date, no AI call
        const rawItems = await collectRawActionItems(orgId)
        const sorted = [...rawItems].sort((a, b) => {
          const aDate = a.dueDate?.getTime() ?? Infinity
          const bDate = b.dueDate?.getTime() ?? Infinity
          return aDate - bDate
        })
        // Add stub urgencyScore/aiReason for the fast path to keep shape consistent
        const items = sorted.map((item) => ({
          ...item,
          urgencyScore: 5,
          aiReason: '',
        }))
        const stats = await getDashboardStats(rawItems)
        return NextResponse.json(ok({ items, stats, aiScored: false }))
      }

      // Full path: AI scoring via Gemini
      const items = await getAIPrioritizedActions(orgId)
      const stats = await getDashboardStats(items)
      return NextResponse.json(ok({ items, stats, aiScored: true }))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[GET /api/events/dashboard]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── POST /api/events/dashboard ───────────────────────────────────────────────
// Resolve an action item with one tap.
// Body: { resolveAction: ResolveAction }

const ResolveActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('complete_task'),
    taskId: z.string().min(1),
    eventProjectId: z.string().min(1),
  }),
  z.object({
    type: z.literal('approve_event'),
    eventProjectId: z.string().min(1),
  }),
  z.object({
    type: z.literal('navigate'),
    url: z.string().min(1),
  }),
])

const PostBodySchema = z.object({
  resolveAction: ResolveActionSchema,
})

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_UPDATE_ALL)

    const body = await req.json()
    const parsed = PostBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid resolve action', parsed.error.flatten()),
        { status: 400 },
      )
    }

    const { resolveAction } = parsed.data

    return await runWithOrgContext(orgId, async () => {
      if (resolveAction.type === 'complete_task') {
        await updateEventTask(
          resolveAction.taskId,
          { status: 'DONE' },
          ctx.userId,
          resolveAction.eventProjectId,
        )
        return NextResponse.json(ok({ resolved: true, type: 'complete_task' }))
      }

      if (resolveAction.type === 'approve_event') {
        await approveEventProject(resolveAction.eventProjectId, ctx.userId)
        return NextResponse.json(ok({ resolved: true, type: 'approve_event' }))
      }

      // navigate type — nothing to do server-side, client handles routing
      return NextResponse.json(ok({ resolved: true, type: 'navigate' }))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(fail('NOT_FOUND', error.message), { status: 404 })
    }
    console.error('[POST /api/events/dashboard]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
