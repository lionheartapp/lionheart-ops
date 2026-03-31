/**
 * Reusable mock factories for route handler tests.
 *
 * Extracts the common mock-hoisting pattern from tickets.test.ts
 * so every route test can share the same boilerplate.
 */
import { vi, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { DeepMockProxy } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

// ── Shared mock state ────────────────────────────────────────────────────────

export interface MockState {
  prisma: DeepMockProxy<PrismaClient>
}

/**
 * Call from vi.hoisted() to create the mock container:
 *   const mocks = vi.hoisted(() => createMockState())
 */
export function createMockState(): MockState {
  return { prisma: null as unknown as DeepMockProxy<PrismaClient> }
}

/**
 * Standard mock setup — call in each test file's top-level scope.
 * Returns a reference object whose `.prisma` gets populated when vi.mock runs.
 */
export function setupRouteMocks(mocks: MockState) {
  vi.mock('@/lib/db', async () => {
    const { mockDeep } = await import('vitest-mock-extended')
    const mock = mockDeep<PrismaClient>()
    mocks.prisma = mock
    return { rawPrisma: mock, prisma: mock }
  })

  vi.mock('@/lib/request-context', () => ({
    getUserContext: vi.fn().mockResolvedValue({
      userId: 'user-test-1',
      organizationId: 'org-test-1',
      email: 'test@example.com',
      roleName: 'admin',
    }),
  }))

  vi.mock('@/lib/auth/permissions', () => ({
    assertCan: vi.fn().mockResolvedValue(undefined),
    can: vi.fn().mockResolvedValue(true),
    canAny: vi.fn().mockResolvedValue(true),
  }))

  vi.mock('@/lib/org-context', () => ({
    getOrgIdFromRequest: vi.fn().mockReturnValue('org-test-1'),
    runWithOrgContext: vi.fn().mockImplementation((_orgId: string, fn: () => unknown) => fn()),
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

  vi.mock('@sentry/nextjs', () => ({
    setTag: vi.fn(),
    captureException: vi.fn(),
  }))
}

/**
 * Reset all mock state — call in beforeEach.
 */
export function resetMocks(mocks: MockState) {
  if (mocks.prisma) mockReset(mocks.prisma)
}

// ── Request helpers ──────────────────────────────────────────────────────────

export function makeGetRequest(path: string, params?: Record<string, string>): NextRequest {
  const url = new URL(path, 'http://localhost')
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
  }
  return new NextRequest(url)
}

export function makePostRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

export function makePutRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

export function makePatchRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

export function makeDeleteRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, { method: 'DELETE' })
}

// ── Response helpers ─────────────────────────────────────────────────────────

export async function parseResponse(response: Response) {
  return response.json()
}

export async function expectOk(response: Response) {
  const body = await response.json()
  expect(body.ok).toBe(true)
  return body
}

export async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status)
  const body = await response.json()
  expect(body.ok).toBe(false)
  expect(body.error.code).toBe(code)
  return body
}
