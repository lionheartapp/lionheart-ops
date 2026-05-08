import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  collectRawActionItems,
  getAIPrioritizedActions,
  getDashboardStats,
} from '@/lib/services/eventDashboardService'
import { updateEventTask, approveEventProject } from '@/lib/services/eventProjectService'

export const GET = withAuth(async ({ orgId, ctx, searchParams }) => {
  const skipAI = searchParams.get('skipAI') === 'true'
  const createdBy = searchParams.get('createdBy')
  const scopeUserId = createdBy === 'me' ? ctx.userId : undefined

  if (skipAI) {
    const rawItems = await collectRawActionItems(orgId)
    const sorted = [...rawItems].sort((a, b) => {
      const aDate = a.dueDate?.getTime() ?? Infinity
      const bDate = b.dueDate?.getTime() ?? Infinity
      return aDate - bDate
    })
    const items = sorted.map((item) => ({
      ...item,
      urgencyScore: 5,
      aiReason: '',
    }))
    const stats = await getDashboardStats(rawItems, scopeUserId)
    return NextResponse.json(ok({ items, stats, aiScored: false }))
  }

  const items = await getAIPrioritizedActions(orgId)
  const stats = await getDashboardStats(items, scopeUserId)
  return NextResponse.json(ok({ items, stats, aiScored: true }))
}, { permission: PERMISSIONS.EVENT_PROJECT_READ })

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

export const POST = withAuth(async ({ ctx, body }) => {
  const { resolveAction } = body

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

  return NextResponse.json(ok({ resolved: true, type: 'navigate' }))
}, { permission: PERMISSIONS.EVENT_PROJECT_UPDATE_ALL, schema: PostBodySchema })
