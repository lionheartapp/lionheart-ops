import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getBlackoutDates, addBlackoutDate, removeBlackoutDate } from '@/lib/services/planningSeasonService'
import { z } from 'zod'

const AddBlackoutSchema = z.object({
  date: z.string().transform((s) => new Date(s)),
  reason: z.string().optional(),
})

const DeleteBlackoutSchema = z.object({
  blackoutDateId: z.string().min(1),
})

export const GET = withAuth(async ({ params }) => {
  const dates = await getBlackoutDates(params.id)
  return NextResponse.json(ok(dates))
}, { permission: PERMISSIONS.PLANNING_VIEW })

export const POST = withAuth(async ({ params, body }) => {
  const date = await addBlackoutDate({ planningSeasonId: params.id, ...body })
  return NextResponse.json(ok(date), { status: 201 })
}, { permission: PERMISSIONS.PLANNING_MANAGE, schema: AddBlackoutSchema })

export const DELETE = withAuth(async ({ req }) => {
  const raw = await req.json()
  const { blackoutDateId } = DeleteBlackoutSchema.parse(raw)
  await removeBlackoutDate(blackoutDateId)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.PLANNING_MANAGE })
