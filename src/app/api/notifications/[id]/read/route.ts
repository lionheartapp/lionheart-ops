import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import * as notificationService from '@/lib/services/notificationService'

export const PUT = withAuth(async ({ ctx, params }) => {
  const updated = await notificationService.markAsRead(params.id, ctx.userId)
  if (!updated) {
    return NextResponse.json(fail('NOT_FOUND', 'Notification not found'), { status: 404 })
  }
  return NextResponse.json(ok({ read: true }))
})
