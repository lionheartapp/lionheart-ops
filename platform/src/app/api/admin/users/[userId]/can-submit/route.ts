import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  try {
    const body = (await req.json()) as { canSubmitEvents?: boolean }
    await prisma.user.update({
      where: { id: userId },
      data: { canSubmitEvents: body.canSubmitEvents ?? false },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Update canSubmitEvents error:', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
