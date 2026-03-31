import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getCampusById,
  updateCampus,
  deleteCampus,
  UpdateCampusSchema,
} from '@/lib/services/campusService'

export const GET = withAuth<unknown, { id: string }>(async ({ params }) => {
  const campus = await getCampusById(params.id)
  if (!campus) {
    return NextResponse.json(fail('NOT_FOUND', 'Campus not found'), { status: 404 })
  }
  return NextResponse.json(ok(campus))
}, { permission: PERMISSIONS.SETTINGS_READ })

export const PATCH = withAuth<z.infer<typeof UpdateCampusSchema>, { id: string }>(async ({ params, body }) => {
  const existing = await getCampusById(params.id)
  if (!existing) {
    return NextResponse.json(fail('NOT_FOUND', 'Campus not found'), { status: 404 })
  }

  const campus = await updateCampus(params.id, body)
  return NextResponse.json(ok(campus))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: UpdateCampusSchema })

export const DELETE = withAuth<unknown, { id: string }>(async ({ params }) => {
  const result = await deleteCampus(params.id)
  if (!result.success) {
    return NextResponse.json(fail('CONFLICT', result.reason!), { status: 409 })
  }
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.SETTINGS_UPDATE })
