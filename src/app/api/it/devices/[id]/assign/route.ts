/**
 * POST /api/it/devices/[id]/assign — assign device to student/user
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { assignDevice } from '@/lib/services/itDeviceService'
import { z } from 'zod'

const AssignSchema = z.object({
  studentId: z.string().optional(),
  userId: z.string().optional(),
  notes: z.string().optional(),
}).refine(data => data.studentId || data.userId, {
  message: 'Either studentId or userId is required',
})

export const POST = withAuth(async ({ ctx, params, body }) => {
  const assignment = await assignDevice(params.id, {
    studentId: body.studentId,
    userId: body.userId,
    assignedById: ctx.userId,
    notes: body.notes,
  })

  return NextResponse.json(ok(assignment), { status: 201 })
}, { permission: PERMISSIONS.IT_DEVICE_ASSIGN, schema: AssignSchema })
