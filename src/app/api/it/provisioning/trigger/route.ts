import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  TriggerProvisioningSchema,
  processNewEnrollment,
  processTransferIn,
  processTransferOut,
  processGraduation,
  processStaffOnboarding,
} from '@/lib/services/itProvisioningService'

export const POST = withAuth(async ({ body }) => {
  const { eventType, studentId, userId, fromSchoolId, toSchoolId, studentIds } = body

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
}, { permission: PERMISSIONS.IT_PROVISIONING_MANAGE, schema: TriggerProvisioningSchema })
