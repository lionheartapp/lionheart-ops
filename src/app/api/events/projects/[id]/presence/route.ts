import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import {
  getActiveUsers,
  updatePresence,
  removePresence,
} from '@/lib/services/eventPresenceService'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const UpdatePresenceSchema = z.object({
  activeTab: z.string().optional(),
})

// ─── Route Handlers ──────────────────────────────────────────────────────────

/**
 * GET — Return active presence sessions for the event project.
 * Only shows users who have sent a heartbeat in the last 2 minutes.
 */
export const GET = withAuth(async ({ params }) => {
  const users = await getActiveUsers(params.id)
  return NextResponse.json(ok(users))
}, { permission: PERMISSIONS.EVENT_PROJECT_READ })

/**
 * POST — Heartbeat: upsert the caller's presence session.
 * Call every ~30 seconds from the UI to maintain active status.
 */
export const POST = withAuth(async ({ req, ctx, params }) => {
  const body = await req.json().catch(() => ({}))
  const parsed = UpdatePresenceSchema.safeParse(body)

  await updatePresence(
    params.id,
    ctx.userId,
    parsed.success ? parsed.data.activeTab : undefined,
  )
  return NextResponse.json(ok({ updated: true }))
}, { permission: PERMISSIONS.EVENT_PROJECT_READ })

/**
 * DELETE — Remove the caller's presence session (on tab close / navigate away).
 */
export const DELETE = withAuth(async ({ ctx, params }) => {
  await removePresence(params.id, ctx.userId)
  return NextResponse.json(ok({ removed: true }))
}, { permission: PERMISSIONS.EVENT_PROJECT_READ })
