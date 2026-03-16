import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { ok, fail } from '@/lib/api-response'
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
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_READ)

    return await runWithOrgContext(orgId, async () => {
      const users = await getActiveUsers(id)
      return NextResponse.json(ok(users))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

/**
 * POST — Heartbeat: upsert the caller's presence session.
 * Call every ~30 seconds from the UI to maintain active status.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_READ)

    const body = await req.json().catch(() => ({}))
    const parsed = UpdatePresenceSchema.safeParse(body)

    return await runWithOrgContext(orgId, async () => {
      await updatePresence(
        id,
        ctx.userId,
        parsed.success ? parsed.data.activeTab : undefined,
      )
      return NextResponse.json(ok({ updated: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

/**
 * DELETE — Remove the caller's presence session (on tab close / navigate away).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENT_PROJECT_READ)

    return await runWithOrgContext(orgId, async () => {
      await removePresence(id, ctx.userId)
      return NextResponse.json(ok({ removed: true }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
