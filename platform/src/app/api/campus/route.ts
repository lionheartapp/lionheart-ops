import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'

export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const orgId = getOrgId()
      let address: string | null = null
      if (orgId) {
        const org = await prismaBase.organization.findUnique({
          where: { id: orgId },
          select: { settings: true },
        })
        const branding = org?.settings && typeof org.settings === 'object'
          ? (org.settings as Record<string, unknown>).branding as Record<string, unknown> | undefined
          : undefined
        address = (branding?.address as string)?.trim() || null
      }

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

      const hasPanoramaContent = buildings.some((b) =>
        b.rooms.some((r) => r.panoramaImageUrl || r.matterportUrl)
      )

      const payload = {
        buildings: buildings.length === 0 ? getMockCampusData() : buildings,
        address,
        hasPanoramaContent,
      }
      return NextResponse.json(payload)
    })
  } catch (error) {
    console.error('Campus API error:', error)
    return NextResponse.json({
      buildings: getMockCampusData(),
      address: null,
      hasPanoramaContent: false,
    })
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
