/**
 * Manual Prisma mock factory for unit tests.
 *
 * Usage in test files — use async factory syntax due to Vitest hoisting:
 *
 *   vi.mock('@/lib/db', async () => {
 *     const { mockDeep } = await import('vitest-mock-extended')
 *     const mock = mockDeep<PrismaClient>()
 *     return { rawPrisma: mock, prisma: mock }
 *   })
 *
 * Note: Vitest's automatic __mocks__ resolution does not follow @/ path aliases.
 * Tests must use the explicit async factory pattern shown above.
 */

import { PrismaClient } from '@prisma/client'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import { beforeEach } from 'vitest'

export const prisma = mockDeep<PrismaClient>()
export const rawPrisma = mockDeep<PrismaClient>()

beforeEach(() => {
  mockReset(prisma)
  mockReset(rawPrisma)
})
