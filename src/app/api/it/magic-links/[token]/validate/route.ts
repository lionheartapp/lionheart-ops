/**
 * GET /api/it/magic-links/:token/validate — Validate a magic link token
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'
import crypto from 'crypto'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const magicLink = await rawPrisma.iTMagicLink.findUnique({
      where: { tokenHash },
      include: {
        campus: { select: { id: true, name: true } },
        school: { select: { id: true, name: true } },
      },
    })

    if (!magicLink) {
      return NextResponse.json(fail('INVALID_TOKEN', 'This link is not valid.'), { status: 404 })
    }

    if (magicLink.usedAt) {
      return NextResponse.json(fail('TOKEN_USED', 'This link has already been used. Please contact the front office for a new link.'), { status: 410 })
    }

    if (magicLink.expiresAt < new Date()) {
      return NextResponse.json(fail('TOKEN_EXPIRED', 'This link has expired. Please contact the front office for a new link.'), { status: 410 })
    }

    return NextResponse.json(ok({
      valid: true,
      campus: magicLink.campus,
      school: magicLink.school,
      expiresAt: magicLink.expiresAt.toISOString(),
    }))
  } catch (error) {
    console.error('[GET /api/it/magic-links/:token/validate]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
