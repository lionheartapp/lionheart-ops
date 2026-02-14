import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, canSubmitEvents: true },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    })
    return NextResponse.json(users)
  } catch {
    return NextResponse.json([])
  }
}
