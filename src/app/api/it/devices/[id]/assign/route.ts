/**
 * POST /api/it/devices/[id]/assign — assign device to student/user
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_DEVICE_ASSIGN)

    const body = await req.json()
    const validated = AssignSchema.parse(body)

    const assignment = await runWithOrgContext(orgId, () =>
      assignDevice(id, {
        studentId: validated.studentId,
        userId: validated.userId,
        assignedById: ctx.userId,
        notes: validated.notes,
      })
    )

    return NextResponse.json(ok(assignment), { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
      }
      if (error.message.includes('already assigned') || error.message.includes('not found')) {
        return NextResponse.json(fail('CONFLICT', error.message), { status: 409 })
      }
      if (error.name === 'ZodError') {
        return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request data', [error.message]), { status: 400 })
      }
    }
    console.error('[POST /api/it/devices/[id]/assign]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
