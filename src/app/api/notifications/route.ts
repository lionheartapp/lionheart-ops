import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import * as notificationService from '@/lib/services/notificationService'

export const GET = withAuth(async ({ ctx, searchParams }) => {
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 50)
  const cursor = searchParams.get('cursor') || undefined

  const result = await notificationService.getUserNotifications(ctx.userId, { limit, cursor })
  return NextResponse.json(ok(result))
})
