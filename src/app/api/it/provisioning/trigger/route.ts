import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import {
  TriggerProvisioningSchema,
  processNewEnrollment,
  processTransferIn,
  processTransferOut,
  processGraduation,
  processStaffOnboarding,
} from '@/lib/services/itProvisioningService'

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_PROVISIONING_MANAGE)

    const body = await req.json()
    const parsed = TriggerProvisioningSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input'), { status: 400 })
    }

    return await runWithOrgContext(orgId, async () => {
      const { eventType, studentId, userId, fromSchoolId, toSchoolId, studentIds } = parsed.data

      switch (eventType) {
        case 'NEW_ENROLLMENT':
          if (!studentId) return NextResponse.json(fail('VALIDATION_ERROR', 'studentId required'), { status: 400 })
          await processNewEnrollment(studentId)
          break
        case 'TRANSFER_IN':
          if (!studentId) return NextResponse.json(fail('VALIDATION_ERROR', 'studentId required'), { status: 400 })
          await processTransferIn(studentId, fromSchoolId, toSchoolId)
          break
        case 'TRANSFER_OUT':
          if (!studentId) return NextResponse.json(fail('VALIDATION_ERROR', 'studentId required'), { status: 400 })
          await processTransferOut(studentId)
          break
        case 'GRADUATION':
          if (!studentIds?.length) return NextResponse.json(fail('VALIDATION_ERROR', 'studentIds required'), { status: 400 })
          await processGraduation(studentIds)
          break
        case 'STAFF_ONBOARDING':
          if (!userId) return NextResponse.json(fail('VALIDATION_ERROR', 'userId required'), { status: 400 })
          await processStaffOnboarding(userId)
          break
      }

      return NextResponse.json(ok({ triggered: eventType }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[POST /api/it/provisioning/trigger]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
