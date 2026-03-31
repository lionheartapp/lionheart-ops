import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  listCampuses,
  createCampus,
  CreateCampusSchema,
} from '@/lib/services/campusService'
import { z } from 'zod'

export const GET = withAuth(async () => {
  const campuses = await listCampuses()
  return NextResponse.json(ok(campuses))
}, { permission: PERMISSIONS.SETTINGS_READ })

export const POST = withAuth<z.infer<typeof CreateCampusSchema>>(async ({ body }) => {
  const campus = await createCampus(body)
  return NextResponse.json(ok(campus), { status: 201 })
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: CreateCampusSchema })
