/**
 * Unit tests for AI route observability:
 * - generate-description/route.ts (Pino + Sentry on error)
 * - parse-event/route.ts (Pino + Sentry on error)
 *
 * Tests that when the Gemini service throws, the route:
 * 1. Returns HTTP 500
 * 2. Calls Sentry.captureException
 * 3. Calls log.error
 *
 * Also tests the happy path returns 200 with correct data.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { DeepMockProxy } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'

// ── Mock hoisting ──────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  return {
    prisma: null as unknown as DeepMockProxy<PrismaClient>,
    logError: vi.fn(),
    logChild: vi.fn(),
    captureException: vi.fn(),
    generateEventDescription: vi.fn(),
    parseEventFromText: vi.fn(),
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

vi.mock('@/lib/request-context', () => ({
  getUserContext: vi.fn().mockResolvedValue({
    userId: 'user-test-1',
    organizationId: 'org-test-1',
    email: 'test@example.com',
    roleName: 'admin',
  }),
}))

vi.mock('@/lib/org-context', () => ({
  getOrgIdFromRequest: vi.fn().mockReturnValue('org-test-1'),
  runWithOrgContext: vi.fn().mockImplementation((_orgId: string, fn: () => unknown) => fn()),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    child: vi.fn().mockImplementation(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: mocks.logError,
    })),
  },
}))

vi.mock('@sentry/nextjs', () => ({
  setTag: vi.fn(),
  captureException: mocks.captureException,
}))

vi.mock('@/lib/services/ai/gemini.service', () => ({
  geminiService: {
    generateEventDescription: mocks.generateEventDescription,
    parseEventFromText: mocks.parseEventFromText,
  },
}))

// ── Import route handlers AFTER mocks are in place ────────────────────────────

import { POST as generatePost } from '@/app/api/ai/generate-description/route'
import { POST as parsePost } from '@/app/api/ai/parse-event/route'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/ai/generate-description observability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (mocks.prisma) mockReset(mocks.prisma)
  })

  it('Test 1: When geminiService.generateEventDescription throws, returns 500 AND Sentry + log.error called', async () => {
    const testError = new Error('Gemini API error')
    mocks.generateEventDescription.mockRejectedValue(testError)

    const req = new NextRequest('http://localhost/api/ai/generate-description', {
      method: 'POST',
      body: JSON.stringify({ title: 'Spring Concert' }),
    })

    const response = await generatePost(req)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('INTERNAL_ERROR')

    // Sentry should have captured the exception
    expect(mocks.captureException).toHaveBeenCalledWith(testError)

    // Pino log.error should have been called
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.objectContaining({ err: testError }),
      'Failed to generate description'
    )
  })

  it('Test 3 (happy path): Valid request returns 200 with description', async () => {
    mocks.generateEventDescription.mockResolvedValue('A wonderful spring concert.')

    const req = new NextRequest('http://localhost/api/ai/generate-description', {
      method: 'POST',
      body: JSON.stringify({ title: 'Spring Concert' }),
    })

    const response = await generatePost(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.data.description).toBe('A wonderful spring concert.')

    // On success, Sentry should NOT be called
    expect(mocks.captureException).not.toHaveBeenCalled()
  })
})

describe('POST /api/ai/parse-event observability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (mocks.prisma) mockReset(mocks.prisma)
  })

  it('Test 2: When geminiService.parseEventFromText throws, returns 500 AND Sentry + log.error called', async () => {
    const testError = new Error('Gemini parse error')
    mocks.parseEventFromText.mockRejectedValue(testError)

    const req = new NextRequest('http://localhost/api/ai/parse-event', {
      method: 'POST',
      body: JSON.stringify({ text: 'Science fair next Monday at 2pm' }),
    })

    const response = await parsePost(req)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.ok).toBe(false)
    expect(body.error.code).toBe('INTERNAL_ERROR')

    // Sentry should have captured the exception
    expect(mocks.captureException).toHaveBeenCalledWith(testError)

    // Pino log.error should have been called
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.objectContaining({ err: testError }),
      'Failed to parse event'
    )
  })

  it('Test 4 (happy path): Valid request returns 200 with parsed event', async () => {
    const parsedResult = {
      title: 'Science Fair',
      startDate: '2026-03-16',
      startTime: '14:00',
    }
    mocks.parseEventFromText.mockResolvedValue(parsedResult)

    const req = new NextRequest('http://localhost/api/ai/parse-event', {
      method: 'POST',
      body: JSON.stringify({ text: 'Science fair next Monday at 2pm' }),
    })

    const response = await parsePost(req)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.data.title).toBe('Science Fair')

    // On success, Sentry should NOT be called
    expect(mocks.captureException).not.toHaveBeenCalled()
  })
})
