/**
 * AI Availability Service
 *
 * Checks whether AI features are available for an org:
 * 1. Is AI enabled at the org level?
 * 2. Is the monthly quota remaining?
 * 3. Is the Gemini API key configured?
 *
 * Also handles incrementing usage and resetting the monthly cycle.
 */

import { rawPrisma } from '@/lib/db'

export interface AiAvailability {
  available: boolean
  reason?: 'DISABLED' | 'QUOTA_EXHAUSTED' | 'NO_API_KEY'
  used: number
  limit: number
  resetAt: string | null
}

/**
 * Check if AI is available for the given org.
 * Uses rawPrisma because this is called before org context is established.
 */
export async function checkAiAvailability(organizationId: string): Promise<AiAvailability> {
  // Check API key first
  if (!process.env.GEMINI_API_KEY && !process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
    return { available: false, reason: 'NO_API_KEY', used: 0, limit: 0, resetAt: null }
  }

  const org = await rawPrisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      aiEnabled: true,
      aiMonthlyLimit: true,
      aiCallsUsed: true,
      aiCycleResetAt: true,
    },
  })

  if (!org) {
    return { available: false, reason: 'DISABLED', used: 0, limit: 0, resetAt: null }
  }

  if (!org.aiEnabled) {
    return {
      available: false,
      reason: 'DISABLED',
      used: org.aiCallsUsed,
      limit: org.aiMonthlyLimit,
      resetAt: org.aiCycleResetAt?.toISOString() ?? null,
    }
  }

  // Check if cycle needs reset
  if (org.aiCycleResetAt && org.aiCycleResetAt <= new Date()) {
    await rawPrisma.organization.update({
      where: { id: organizationId },
      data: {
        aiCallsUsed: 0,
        aiCycleResetAt: getNextResetDate(),
      },
    })
    return {
      available: true,
      used: 0,
      limit: org.aiMonthlyLimit,
      resetAt: getNextResetDate().toISOString(),
    }
  }

  // Check quota
  if (org.aiCallsUsed >= org.aiMonthlyLimit) {
    return {
      available: false,
      reason: 'QUOTA_EXHAUSTED',
      used: org.aiCallsUsed,
      limit: org.aiMonthlyLimit,
      resetAt: org.aiCycleResetAt?.toISOString() ?? null,
    }
  }

  return {
    available: true,
    used: org.aiCallsUsed,
    limit: org.aiMonthlyLimit,
    resetAt: org.aiCycleResetAt?.toISOString() ?? null,
  }
}

/**
 * Increment AI usage counter for the org. Call this after each successful AI call.
 * Also initializes the reset date if not set yet.
 */
export async function incrementAiUsage(organizationId: string): Promise<void> {
  const org = await rawPrisma.organization.findUnique({
    where: { id: organizationId },
    select: { aiCycleResetAt: true },
  })

  await rawPrisma.organization.update({
    where: { id: organizationId },
    data: {
      aiCallsUsed: { increment: 1 },
      ...(!org?.aiCycleResetAt && { aiCycleResetAt: getNextResetDate() }),
    },
  })
}

function getNextResetDate(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 1)
}
