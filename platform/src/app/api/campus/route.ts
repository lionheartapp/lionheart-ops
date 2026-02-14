import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const buildings = await prisma.building.findMany({
      include: {
        rooms: {
          include: {
            tickets: {
              where: { category: 'MAINTENANCE', status: { not: 'RESOLVED' } },
              include: { submittedBy: true },
            },
            teacherSchedules: { include: { user: true } },
          },
        },
      },
    })
    // Use mock when DB is empty (demo mode)
    if (buildings.length === 0) return NextResponse.json(getMockCampusData())
    return NextResponse.json(buildings)
  } catch (error) {
    console.error('Campus API error:', error)
    return NextResponse.json(getMockCampusData())
  }
}

function getMockCampusData() {
  return [
    {
      id: 'b1',
      name: 'Main Building',
      rooms: [
        {
          id: 'r1',
          name: 'Room 101',
          buildingId: 'b1',
          panoramaImageUrl: null,
          pinYaw: 45,
          pinPitch: -5,
          tickets: [
            {
              id: 't1',
              title: 'Leaking faucet',
              category: 'MAINTENANCE',
              status: 'NEW',
              roomId: 'r1',
            },
          ],
          teacherSchedules: [
            {
              id: 's1',
              userId: 'u1',
              roomId: 'r1',
              dayOfWeek: 1,
              startTime: '08:00',
              endTime: '09:15',
              subject: 'Math',
              user: { id: 'u1', name: 'Sarah Johnson', imageUrl: null },
            },
          ],
        },
      ],
    },
  ]
}
