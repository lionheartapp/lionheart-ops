import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma } from '@/lib/db'
import { NOTIFICATION_TYPES } from '@/lib/services/notificationService'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

const PreferenceUpdateSchema = z.object({
  preferences: z
    .array(
      z.object({
        type: z.string(),
        emailEnabled: z.boolean(),
        inAppEnabled: z.boolean(),
      })
    )
    .optional(),
  pauseAll: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const log = logger.child({ route: '/api/user/notification-preferences', method: 'GET' })
  try {
    const orgId = getOrgIdFromRequest(req) // validates org header is present
    Sentry.setTag('org_id', orgId)
    const ctx = await getUserContext(req)

    const [preferences, user] = await Promise.all([
      rawPrisma.notificationPreference.findMany({
        where: { userId: ctx.userId },
        select: { type: true, emailEnabled: true, inAppEnabled: true },
      }),
      rawPrisma.user.findUnique({
        where: { id: ctx.userId },
        select: { pauseAllNotifications: true },
      }),
    ])

    return NextResponse.json(
      ok({
        preferences,
        pauseAll: user?.pauseAllNotifications ?? false,
      })
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to fetch notification preferences')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const log = logger.child({ route: '/api/user/notification-preferences', method: 'PUT' })
  try {
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    const ctx = await getUserContext(req)

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid JSON body'), { status: 400 })
    }

    const parsed = PreferenceUpdateSchema.safeParse(body)
    if (!parsed.success) {
      const details = parsed.error.issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }))
      return NextResponse.json(fail('VALIDATION_ERROR', 'Validation failed', details), {
        status: 400,
      })
    }

    const { preferences, pauseAll } = parsed.data

    // Update individual preferences
    if (preferences && preferences.length > 0) {
      // Validate all types are known
      const unknownTypes = preferences.filter((p) => !NOTIFICATION_TYPES.includes(p.type as any))
      if (unknownTypes.length > 0) {
        return NextResponse.json(
          fail('VALIDATION_ERROR', `Unknown notification types: ${unknownTypes.map((t) => t.type).join(', ')}`),
          { status: 400 }
        )
      }

      await Promise.all(
        preferences.map((pref) =>
          rawPrisma.notificationPreference.upsert({
            where: {
              userId_type: { userId: ctx.userId, type: pref.type },
            },
            create: {
              organizationId: orgId,
              userId: ctx.userId,
              type: pref.type,
              emailEnabled: pref.emailEnabled,
              inAppEnabled: pref.inAppEnabled,
            },
            update: {
              emailEnabled: pref.emailEnabled,
              inAppEnabled: pref.inAppEnabled,
            },
          })
        )
      )
    }

    // Update master pause toggle
    if (typeof pauseAll === 'boolean') {
      await rawPrisma.user.update({
        where: { id: ctx.userId },
        data: { pauseAllNotifications: pauseAll },
      })
    }

    return NextResponse.json(ok({ updated: true }))
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to update notification preferences')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
