import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg } from '@/lib/orgContext'

// GET ?userId=xxx to check a specific user. Without auth, defaults to allowed.
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const userId = url.searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ canSubmit: true, message: null })
  }
  try {
    return await withOrg(req, prismaBase, async () => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, canSubmitEvents: true },
    })
    if (!user) return NextResponse.json({ canSubmit: false, message: 'User not found' })
    const canSubmit =
      user.role === 'ADMIN' ||
      user.role === 'SITE_SECRETARY' ||
      user.canSubmitEvents === true
    return NextResponse.json({
      canSubmit,
      message: canSubmit
        ? null
        : 'Contact your administrator to request event submission access.',
    })
    })
  } catch {
    return NextResponse.json({ canSubmit: true, message: null })
  }
}
