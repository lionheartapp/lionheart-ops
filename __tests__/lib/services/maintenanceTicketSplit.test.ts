import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { DeepMockProxy } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  prisma: null as unknown as DeepMockProxy<PrismaClient>,
}))

vi.mock('@/lib/db', async () => {
  const { mockDeep } = await import('vitest-mock-extended')
  const mock = mockDeep<PrismaClient>()
  mocks.prisma = mock
  return { prisma: mock, rawPrisma: mock }
})

vi.mock('@/lib/auth/permissions', () => ({
  assertCan: vi.fn().mockResolvedValue(undefined),
  canAny: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}))

vi.mock('@/lib/services/approvalRuleService', () => ({
  resolveFormApprovalSteps: vi.fn().mockResolvedValue([]),
  resolveMaintenanceApprovalSteps: vi.fn().mockResolvedValue([]),
  getSystemFormId: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/services/approvalFlowService', () => ({
  buildGatesFromFlow: vi.fn().mockResolvedValue({ gates: {} }),
}))

vi.mock('@/lib/services/ticketRoutingService', () => ({
  routeTicket: vi.fn().mockResolvedValue({ assignedToId: null, reason: 'No route' }),
}))

vi.mock('@/lib/services/systemBotService', () => ({
  postMaintenanceAlert: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/services/maintenanceNotificationService', () => ({
  notifyTicketSubmitted: vi.fn().mockResolvedValue(undefined),
  notifyUrgentTicket: vi.fn().mockResolvedValue(undefined),
}))

import { splitMaintenanceTicket } from '@/lib/services/maintenanceTicketService'

describe('splitMaintenanceTicket', () => {
  beforeEach(() => {
    mockReset(mocks.prisma)
    ;(mocks.prisma.$transaction as any).mockImplementation(async (callback: any) =>
      callback({
        maintenanceCounter: {
          upsert: vi.fn().mockResolvedValue({ lastTicketNumber: 42 }),
        },
      })
    )
    ;(mocks.prisma.maintenanceTicketActivity.create as any).mockResolvedValue({})
    ;(mocks.prisma.maintenanceTicketActivity.createMany as any).mockResolvedValue({ count: 2 })
    ;(mocks.prisma.maintenanceTicketWatcher.create as any).mockResolvedValue({})
    ;(mocks.prisma.team.findFirst as any).mockResolvedValue(null)
  })

  it('creates a linked new ticket while preserving location context', async () => {
    ;(mocks.prisma.maintenanceTicket.findUnique as any).mockResolvedValue({
      id: 'source-ticket',
      ticketNumber: 'MT-0007',
      title: 'Sink leak and broken gate',
      priority: 'HIGH',
      photos: ['https://example.com/source.jpg'],
      buildingId: 'building-1',
      spaceId: 'space-1',
      roomId: 'room-1',
      campusId: 'campus-1',
      availabilityNote: 'After lunch',
      assetId: 'asset-1',
      status: 'IN_PROGRESS',
    })
    ;(mocks.prisma.maintenanceTicket.create as any).mockResolvedValue({
      id: 'new-ticket',
      ticketNumber: 'MT-0042',
      title: 'Repair broken gate latch',
      status: 'BACKLOG',
    })

    const result = await splitMaintenanceTicket(
      'source-ticket',
      {
        title: 'Repair broken gate latch',
        description: 'Separate grounds issue from the plumbing ticket.',
        category: 'GROUNDS',
        priority: 'MEDIUM',
        keepPhotos: true,
        keepAsset: true,
      },
      { userId: 'user-1', organizationId: 'org-1' }
    )

    expect(result.ticketNumber).toBe('MT-0042')
    expect(mocks.prisma.maintenanceTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          ticketNumber: 'MT-0042',
          title: 'Repair broken gate latch',
          description: 'Separate grounds issue from the plumbing ticket.',
          category: 'GROUNDS',
          priority: 'MEDIUM',
          photos: ['https://example.com/source.jpg'],
          buildingId: 'building-1',
          spaceId: 'space-1',
          roomId: 'room-1',
          campusId: 'campus-1',
          availabilityNote: 'After lunch',
          assetId: 'asset-1',
          submittedById: 'user-1',
        }),
      })
    )
    expect(mocks.prisma.maintenanceTicketActivity.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            ticketId: 'source-ticket',
            content: expect.stringContaining('Split out separate work order MT-0042'),
            isInternal: true,
          }),
          expect.objectContaining({
            ticketId: 'new-ticket',
            content: expect.stringContaining('Created by splitting MT-0007'),
            isInternal: true,
          }),
        ]),
      })
    )
  })

  it('does not split closed tickets', async () => {
    ;(mocks.prisma.maintenanceTicket.findUnique as any).mockResolvedValue({
      id: 'source-ticket',
      ticketNumber: 'MT-0007',
      title: 'Done ticket',
      priority: 'LOW',
      photos: [],
      buildingId: null,
      spaceId: null,
      roomId: null,
      campusId: null,
      availabilityNote: null,
      assetId: null,
      status: 'DONE',
    })

    await expect(
      splitMaintenanceTicket(
        'source-ticket',
        { title: 'New issue', category: 'OTHER' },
        { userId: 'user-1', organizationId: 'org-1' }
      )
    ).rejects.toThrow('Cannot split a closed or cancelled ticket')

    expect(mocks.prisma.maintenanceTicket.create).not.toHaveBeenCalled()
    expect(mocks.prisma.maintenanceTicketActivity.createMany).not.toHaveBeenCalled()
  })
})
