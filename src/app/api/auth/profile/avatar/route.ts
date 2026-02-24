import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
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
      return NextResponse.json(
        fail('UNAUTHORIZED', 'Missing or invalid authorization header'),
        { status: 401 }
      )
    }

    const token = authHeader.slice(7)
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
    const userId = payload.sub

    if (!userId) {
      return NextResponse.json(
        fail('UNAUTHORIZED', 'Invalid token'),
        { status: 401 }
      )
    }

    const body = await request.json()
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

    return NextResponse.json(
      ok({
        user,
      })
    )
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        fail('INVALID_INPUT', err.issues[0]?.message || 'Invalid input'),
        { status: 400 }
      )
    }

    if (err instanceof SyntaxError) {
      return NextResponse.json(
        fail('INVALID_JSON', 'Invalid JSON'),
        { status: 400 }
      )
    }

    console.error('[AVATAR UPDATE]', err)
    return NextResponse.json(
      fail('INTERNAL_SERVER_ERROR', 'Failed to update avatar'),
      { status: 500 }
    )
  }
}
