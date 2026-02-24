import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuthToken } from '@/lib/auth'
import { ok, fail } from '@/lib/api-response'
import { z } from 'zod'

const AvatarUpdateSchema = z.object({
  avatar: z.string().nullable().optional().refine(
    (val) => !val || val.startsWith('data:image/') || val.startsWith('http'),
    'Avatar must be a data URL or valid image URL'
  ),
})

type AvatarUpdateInput = z.infer<typeof AvatarUpdateSchema>

export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('[AVATAR] Missing auth header')
      return NextResponse.json(
        fail('UNAUTHORIZED', 'Missing or invalid authorization header'),
        { status: 401 }
      )
    }

    const token = authHeader.slice(7)
    const claims = await verifyAuthToken(token)

    if (!claims?.userId) {
      console.error('[AVATAR] Invalid token')
      return NextResponse.json(
        fail('UNAUTHORIZED', 'Invalid token'),
        { status: 401 }
      )
    }

    const userId = claims.userId

    let body: unknown
    try {
      body = await request.json()
    } catch (err) {
      console.error('[AVATAR] JSON parse error:', err)
      return NextResponse.json(
        fail('INVALID_JSON', 'Invalid JSON in request body'),
        { status: 400 }
      )
    }

    const input = AvatarUpdateSchema.parse(body)

    // Update user avatar
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        avatar: input.avatar ?? null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
      },
    })

    console.log('[AVATAR] Updated avatar for user:', userId)

    return NextResponse.json(
      ok({
        user,
      })
    )
  } catch (err) {
    if (err instanceof z.ZodError) {
      console.error('[AVATAR] Validation error:', err.issues)
      return NextResponse.json(
        fail('INVALID_INPUT', err.issues[0]?.message || 'Invalid input'),
        { status: 400 }
      )
    }

    console.error('[AVATAR UPDATE] Error:', err)
    return NextResponse.json(
      fail('INTERNAL_SERVER_ERROR', err instanceof Error ? err.message : 'Failed to update avatar'),
      { status: 500 }
    )
  }
}
