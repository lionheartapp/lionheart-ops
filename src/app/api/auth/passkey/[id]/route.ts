/**
 * Passkey CRUD — rename (PATCH) or delete (DELETE) a specific passkey.
 * Requires authentication.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { renamePasskey, deletePasskey } from '@/lib/services/passkeyService'
import { z } from 'zod'
import { logger } from '@/lib/logger'

const renameSchema = z.object({
  name: z.string().min(1).max(100),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getUserContext(req)
    if (!ctx?.userId) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Not authenticated'), { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const parsed = renameSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', parsed.error.issues[0]?.message || 'Invalid input'),
        { status: 400 }
      )
    }

    await renamePasskey(ctx.userId, id, parsed.data.name)

    return NextResponse.json(ok({ success: true }))
  } catch (err) {
    logger.error({ error: String(err) }, 'Passkey rename error')
    return NextResponse.json(
      fail('INTERNAL_ERROR', err instanceof Error ? err.message : 'Failed to rename passkey'),
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getUserContext(req)
    if (!ctx?.userId) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Not authenticated'), { status: 401 })
    }

    const { id } = await params
    await deletePasskey(ctx.userId, id)

    logger.info({ userId: ctx.userId, passkeyId: id }, 'Passkey deleted')

    return NextResponse.json(ok({ success: true }))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete passkey'
    // Return 403 for org MFA policy violations
    const status = message.includes('organization requires') ? 403 : 500
    logger.error({ error: String(err) }, 'Passkey delete error')
    return NextResponse.json(fail('DELETE_FAILED', message), { status })
  }
}
