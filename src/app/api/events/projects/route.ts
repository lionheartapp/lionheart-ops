import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { parsePagination, paginationMeta } from '@/lib/pagination'
import {
  listEventProjects,
  createEventProject,
} from '@/lib/services/eventProjectService'
import { CreateEventProjectSchema } from '@/lib/types/event-project'

export const GET = withAuth(async ({ ctx, searchParams }) => {
  const { page, limit, skip } = parsePagination(searchParams)

  const status = searchParams.get('status') ?? undefined
  const campusId = searchParams.get('campusId') ?? undefined
  const schoolId = searchParams.get('schoolId') ?? undefined
  const rawCreatedBy = searchParams.get('createdBy') ?? searchParams.get('createdById') ?? undefined
  const createdById = rawCreatedBy === 'me' ? ctx.userId : rawCreatedBy

  const filters = { status, campusId, schoolId, createdById }

  const projects = await listEventProjects(filters)

  const total = projects.length
  const paged = projects.slice(skip, skip + limit)

  return NextResponse.json(ok(paged, paginationMeta(total, { page, limit, skip })))
}, { permission: PERMISSIONS.EVENT_PROJECT_READ })

export const POST = withAuth(async ({ ctx, body }) => {
  const project = await createEventProject(body, ctx.userId, 'DIRECT_REQUEST')
  return NextResponse.json(ok(project), { status: 201 })
}, { permission: PERMISSIONS.EVENT_PROJECT_CREATE, schema: CreateEventProjectSchema })
