import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg } from '@/lib/orgContext'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  try {
    return await withOrg(req, prismaBase, async () => {
    const body = (await req.json()) as { canSubmitEvents?: boolean }
    await prisma.user.update({
      where: { id: userId },
      data: { canSubmitEvents: body.canSubmitEvents ?? false },
    })
    return NextResponse.json({ ok: true })
    })
  } catch (err) {
    console.error('Update canSubmitEvents error:', err)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
