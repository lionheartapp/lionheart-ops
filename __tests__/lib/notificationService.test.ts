/**
 * Unit tests for createBulkNotifications — preference-filtered bulk delivery.
 *
 * Tests that the bulk notification function correctly checks:
 * 1. pauseAllNotifications flag on the User record
 * 2. Per-type inAppEnabled flag on the NotificationPreference record
 * 3. Empty input early return (no DB queries)
 * 4. All-paused early return (no createMany call)
 * 5. Default/enabled preferences deliver to all users
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { DeepMockProxy } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

// ── Mock hoisting ──────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  return {
    prisma: null as unknown as DeepMockProxy<PrismaClient>,
  }
})

vi.mock('@/lib/db', async () => {
  const { mockDeep } = await import('vitest-mock-extended')
  const mock = mockDeep<PrismaClient>()
  mocks.prisma = mock
  return {
    rawPrisma: mock,
    prisma: mock,
  }
})

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}))

// ── Import service AFTER mocks are in place ────────────────────────────────────

import { createBulkNotifications } from '@/lib/services/notificationService'
import type { CreateBulkNotificationInput } from '@/lib/services/notificationService'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeItem(userId: string, overrides?: Partial<CreateBulkNotificationInput>): CreateBulkNotificationInput {
  return {
    userId,
    type: 'inventory_low_stock',
    title: `Low stock alert for ${userId}`,
    body: 'Stock is below threshold',
    linkUrl: '/inventory',
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createBulkNotifications — preference filtering', () => {
  beforeEach(() => {
    if (mocks.prisma) mockReset(mocks.prisma)
  })

  it('Test 1: skips user with pauseAllNotifications=true — only 2 of 3 notifications created', async () => {
    const items = [
      makeItem('user-1'),
      makeItem('user-2'),
      makeItem('user-3'),
    ]

    // user-2 has pauseAllNotifications=true
    ;(mocks.prisma.user.findMany as any).mockResolvedValue([
      { id: 'user-1', pauseAllNotifications: false },
      { id: 'user-2', pauseAllNotifications: true },
      { id: 'user-3', pauseAllNotifications: false },
    ])

    // No per-type disabled preferences
    ;(mocks.prisma.notificationPreference.findMany as any).mockResolvedValue([])

    // createMany resolves
    ;(mocks.prisma.notification.createMany as any).mockResolvedValue({ count: 2 })

    await createBulkNotifications(items)

    const createManyCall = (mocks.prisma.notification.createMany as any).mock.calls[0]
    expect(createManyCall).toBeDefined()
    const createdData = createManyCall[0].data
    expect(createdData).toHaveLength(2)
    expect(createdData.map((d: any) => d.userId)).not.toContain('user-2')
    expect(createdData.map((d: any) => d.userId)).toContain('user-1')
    expect(createdData.map((d: any) => d.userId)).toContain('user-3')
  })

  it('Test 2: skips user with inAppEnabled=false for the notification type — only 2 of 3 created', async () => {
    const items = [
      makeItem('user-1'),
      makeItem('user-2'),
      makeItem('user-3'),
    ]

    // No users paused
    ;(mocks.prisma.user.findMany as any).mockResolvedValue([
      { id: 'user-1', pauseAllNotifications: false },
      { id: 'user-2', pauseAllNotifications: false },
      { id: 'user-3', pauseAllNotifications: false },
    ])

    // user-2 has inAppEnabled=false for inventory_low_stock
    ;(mocks.prisma.notificationPreference.findMany as any).mockResolvedValue([
      { userId: 'user-2', type: 'inventory_low_stock' },
    ])

    ;(mocks.prisma.notification.createMany as any).mockResolvedValue({ count: 2 })

    await createBulkNotifications(items)

    const createManyCall = (mocks.prisma.notification.createMany as any).mock.calls[0]
    expect(createManyCall).toBeDefined()
    const createdData = createManyCall[0].data
    expect(createdData).toHaveLength(2)
    expect(createdData.map((d: any) => d.userId)).not.toContain('user-2')
    expect(createdData.map((d: any) => d.userId)).toContain('user-1')
    expect(createdData.map((d: any) => d.userId)).toContain('user-3')
  })

  it('Test 3: all users with default/enabled preferences — all 3 notifications created', async () => {
    const items = [
      makeItem('user-1'),
      makeItem('user-2'),
      makeItem('user-3'),
    ]

    // No users paused
    ;(mocks.prisma.user.findMany as any).mockResolvedValue([
      { id: 'user-1', pauseAllNotifications: false },
      { id: 'user-2', pauseAllNotifications: false },
      { id: 'user-3', pauseAllNotifications: false },
    ])

    // No disabled preferences
    ;(mocks.prisma.notificationPreference.findMany as any).mockResolvedValue([])

    ;(mocks.prisma.notification.createMany as any).mockResolvedValue({ count: 3 })

    await createBulkNotifications(items)

    const createManyCall = (mocks.prisma.notification.createMany as any).mock.calls[0]
    expect(createManyCall).toBeDefined()
    const createdData = createManyCall[0].data
    expect(createdData).toHaveLength(3)
    expect(createdData.map((d: any) => d.userId)).toContain('user-1')
    expect(createdData.map((d: any) => d.userId)).toContain('user-2')
    expect(createdData.map((d: any) => d.userId)).toContain('user-3')
  })

  it('Test 4: empty array — returns immediately with no DB queries', async () => {
    await createBulkNotifications([])

    expect((mocks.prisma.user.findMany as any).mock.calls).toHaveLength(0)
    expect((mocks.prisma.notificationPreference.findMany as any).mock.calls).toHaveLength(0)
    expect((mocks.prisma.notification.createMany as any).mock.calls).toHaveLength(0)
  })

  it('Test 5: all users paused — no notifications created (early return before createMany)', async () => {
    const items = [
      makeItem('user-1'),
      makeItem('user-2'),
    ]

    // All users paused
    ;(mocks.prisma.user.findMany as any).mockResolvedValue([
      { id: 'user-1', pauseAllNotifications: true },
      { id: 'user-2', pauseAllNotifications: true },
    ])

    ;(mocks.prisma.notificationPreference.findMany as any).mockResolvedValue([])

    await createBulkNotifications(items)

    // createMany should never be called when all eligible items are filtered out
    expect((mocks.prisma.notification.createMany as any).mock.calls).toHaveLength(0)
  })
})
