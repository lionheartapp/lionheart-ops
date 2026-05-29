import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import * as notificationService from '@/lib/services/notificationService'

// @authOnly Returns only the signed-in user's unread notification count.
export const GET = withAuth(async ({ ctx }) => {
  const count = await notificationService.getUnreadCount(ctx.userId)
  return NextResponse.json(ok({ count }))
})
