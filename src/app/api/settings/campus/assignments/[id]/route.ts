import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  updateCampusAssignment,
  removeCampusAssignment,
  UpdateCampusAssignmentSchema,
} from '@/lib/services/campusService'

export const PATCH = withAuth(async ({ params, body }) => {
  const assignment = await updateCampusAssignment(params.id, body)
  return NextResponse.json(ok(assignment))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: UpdateCampusAssignmentSchema })

export const DELETE = withAuth<unknown, { id: string }>(async ({ params }) => {
  await removeCampusAssignment(params.id)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.SETTINGS_UPDATE })
