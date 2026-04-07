import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getEventProject,
  updateEventProject,
} from '@/lib/services/eventProjectService'
import { UpdateEventProjectSchema } from '@/lib/types/event-project'

export const GET = withAuth(async ({ params }) => {
  const project = await getEventProject(params.id)
  if (!project) {
    return NextResponse.json(fail('NOT_FOUND', `EventProject not found: ${params.id}`), { status: 404 })
  }
  return NextResponse.json(ok(project))
}, { permission: PERMISSIONS.EVENT_PROJECT_READ })

export const PATCH = withAuth(async ({ ctx, params, body }) => {
  const updated = await updateEventProject(params.id, body, ctx.userId)
  return NextResponse.json(ok(updated))
}, { permission: PERMISSIONS.EVENT_PROJECT_UPDATE_ALL, schema: UpdateEventProjectSchema })

export const DELETE = withAuth(async ({ params }) => {
  const db = prisma as unknown as OrgPrismaClient
  await db.eventProject.delete({ where: { id: params.id } })
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.EVENT_PROJECT_DELETE })
