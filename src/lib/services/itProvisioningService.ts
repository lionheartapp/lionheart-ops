/**
 * IT Account Provisioning Service
 *
 * Manages automated account lifecycle events:
 * - New enrollment: create Google/M365 account
 * - Transfer: move account between OUs
 * - Graduation: batch archive accounts
 * - Orphaned account detection: flag accounts with no SIS match
 * - Staff onboarding: create setup tickets
 */

import { z } from 'zod'
import { prisma } from '@/lib/db'
import type { ITProvisioningEventType, ITProvisioningStatus } from '@prisma/client'

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const UpdateConfigSchema = z.object({
  autoEnrollEnabled: z.boolean().optional(),
  autoSuspendEnabled: z.boolean().optional(),
  orphanDetectionEnabled: z.boolean().optional(),
  graduationArchiveEnabled: z.boolean().optional(),
  staffOnboardingEnabled: z.boolean().optional(),
  defaultOuPath: z.string().optional().nullable(),
  suspendedOuPath: z.string().optional().nullable(),
})

export const TriggerProvisioningSchema = z.object({
  eventType: z.enum(['NEW_ENROLLMENT', 'TRANSFER_IN', 'TRANSFER_OUT', 'GRADUATION', 'STAFF_ONBOARDING']),
  studentId: z.string().optional(),
  userId: z.string().optional(),
  fromSchoolId: z.string().optional(),
  toSchoolId: z.string().optional(),
  studentIds: z.array(z.string()).optional(),
})

export const ResolveOrphanedSchema = z.object({
  action: z.enum(['keep', 'suspend', 'delete']),
  notes: z.string().optional(),
})

// ─── Config ───────────────────────────────────────────────────────────────────

export async function getProvisioningConfig() {
  const config = await prisma.iTProvisioningConfig.findFirst()
  if (!config) {
    // Return defaults
    return {
      autoEnrollEnabled: false,
      autoSuspendEnabled: false,
      orphanDetectionEnabled: false,
      graduationArchiveEnabled: false,
      staffOnboardingEnabled: false,
      defaultOuPath: null,
      suspendedOuPath: null,
    }
  }
  return config
}

export async function updateProvisioningConfig(input: z.infer<typeof UpdateConfigSchema>) {
  const existing = await prisma.iTProvisioningConfig.findFirst()
  if (existing) {
    return prisma.iTProvisioningConfig.update({
      where: { id: existing.id },
      data: input,
    })
  }
  return (prisma.iTProvisioningConfig.create as Function)({
    data: input,
  })
}

// ─── Event Processing ─────────────────────────────────────────────────────────

export async function processNewEnrollment(studentId: string): Promise<void> {
  await (prisma.iTProvisioningEvent.create as Function)({
    data: {
      eventType: 'NEW_ENROLLMENT' as ITProvisioningEventType,
      status: 'PENDING' as ITProvisioningStatus,
      studentId,
      details: { action: 'Create account and assign to default OU' },
    },
  })
  // Actual Google/M365 provisioning would happen here via external API
  // For now, log the event as completed (stub)
  // In production: call googleAdminService.createUser() etc.
}

export async function processTransferIn(studentId: string, fromSchoolId?: string, toSchoolId?: string): Promise<void> {
  await (prisma.iTProvisioningEvent.create as Function)({
    data: {
      eventType: 'TRANSFER_IN' as ITProvisioningEventType,
      status: 'PENDING' as ITProvisioningStatus,
      studentId,
      fromSchoolId,
      toSchoolId,
      details: { action: 'Move account to destination school OU' },
    },
  })
}

export async function processTransferOut(studentId: string): Promise<void> {
  await (prisma.iTProvisioningEvent.create as Function)({
    data: {
      eventType: 'TRANSFER_OUT' as ITProvisioningEventType,
      status: 'PENDING' as ITProvisioningStatus,
      studentId,
      details: { action: 'Suspend account, flag device for collection' },
    },
  })
}

export async function processGraduation(studentIds: string[]): Promise<void> {
  for (const studentId of studentIds) {
    await (prisma.iTProvisioningEvent.create as Function)({
      data: {
        eventType: 'GRADUATION' as ITProvisioningEventType,
        status: 'PENDING' as ITProvisioningStatus,
        studentId,
        details: { action: 'Archive account, collect device' },
      },
    })
  }
}

export async function processStaffOnboarding(userId: string): Promise<void> {
  await (prisma.iTProvisioningEvent.create as Function)({
    data: {
      eventType: 'STAFF_ONBOARDING' as ITProvisioningEventType,
      status: 'PENDING' as ITProvisioningStatus,
      userId,
      details: { action: 'Create IT setup ticket with checklist' },
    },
  })
}

// ─── Orphaned Accounts ────────────────────────────────────────────────────────

export async function detectOrphanedAccounts(): Promise<number> {
  // Stub: In production, compare Google/M365 directory against SIS roster
  // For now, return 0 detected
  return 0
}

export async function getOrphanedAccounts(filters?: { resolved?: boolean }) {
  const where: Record<string, unknown> = {}
  if (filters?.resolved === false) {
    where.resolvedAt = null
  } else if (filters?.resolved === true) {
    where.resolvedAt = { not: null }
  }

  return prisma.iTOrphanedAccount.findMany({
    where,
    orderBy: { detectedAt: 'desc' },
  })
}

export async function resolveOrphanedAccount(
  accountId: string,
  action: 'keep' | 'suspend' | 'delete',
  resolvedById: string,
  notes?: string
) {
  return prisma.iTOrphanedAccount.update({
    where: { id: accountId },
    data: {
      resolvedAt: new Date(),
      resolution: action,
      resolvedById,
      notes,
    },
  })
}

// ─── Event Log ────────────────────────────────────────────────────────────────

export async function listProvisioningEvents(filters?: {
  eventType?: string
  status?: string
  limit?: number
  offset?: number
}) {
  const where: Record<string, unknown> = {}
  if (filters?.eventType) where.eventType = filters.eventType
  if (filters?.status) where.status = filters.status

  const [events, total] = await Promise.all([
    prisma.iTProvisioningEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    }),
    prisma.iTProvisioningEvent.count({ where }),
  ])

  return { events, total }
}
