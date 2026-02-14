import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const rooms = await prisma.room.findMany({
      include: { building: true },
      orderBy: [{ building: { name: 'asc' } }, { name: 'asc' }],
    })
    return NextResponse.json(rooms)
  } catch {
    return NextResponse.json([])
  }
}
