import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import * as notificationService from '@/lib/services/notificationService'

// @authOnly Marks only the signed-in user's notifications as read.
export const PUT = withAuth(async ({ ctx }) => {
  const count = await notificationService.markAllAsRead(ctx.userId)
  return NextResponse.json(ok({ markedRead: count }))
})
