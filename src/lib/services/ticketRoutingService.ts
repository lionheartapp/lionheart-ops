/**
 * Ticket Routing Service
 *
 * Module-agnostic routing engine for MaintenanceTicket and ITTicket.
 * Implements a 4-step cascade:
 *   1. Category specialist override
 *   2. Category fallback
 *   3. Campus default strategy (UNASSIGNED | ROUND_ROBIN | LOAD_BALANCED | MANAGER_TRIAGE)
 *   4. Unassigned queue (no eligible staff)
 *
 * Every routing decision is logged to TicketAssignmentLog for auditability.
 */

import { rawPrisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import type {
  RoutingStrategy,
  RoutingDecisionSource,
  TicketModule,
} from '@prisma/client'

const log = logger.child({ service: 'ticketRoutingService' })

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RoutingInput {
  module: TicketModule
  ticketId: string
  categoryKey: string
  buildingId?: string | null
  submittedById?: string | null
  orgId: string
}

export interface RoutingResult {
  assignedToId: string | null
  reason: string
  strategy: RoutingStrategy
  source: RoutingDecisionSource
}

interface EligibleStaff {
  userId: string
  openTicketCount: number
  maxActiveTickets: number
  hasSkillMatch: boolean
}

// ─── Main Routing Function ───────────────────────────────────────────────────

export async function routeTicket(input: RoutingInput): Promise<RoutingResult> {
  const { module, ticketId, categoryKey, buildingId, orgId } = input

  try {
    // Step 0: Resolve campus from building
    const campusId = buildingId ? await resolveCampusId(buildingId) : null

    // Step 0.5: Same-agent routing (if enabled)
    if (input.submittedById) {
      const routingConfig = await findRoutingConfig(orgId, module, campusId)
      if (routingConfig?.enableSameAgentRouting) {
        const previousAssignee = await findPreviousAssignee(input.submittedById, module, orgId)
        if (previousAssignee) {
          const eligible = await isStaffEligible(previousAssignee, module, campusId, orgId)
          if (eligible) {
            const result: RoutingResult = {
              assignedToId: previousAssignee,
              reason: 'Same-agent routing (previously handled this requester)',
              strategy: routingConfig.strategy as RoutingStrategy,
              source: 'CAMPUS_DEFAULT',
            }
            await logAssignment(input, result, 1)
            return result
          }
        }
      }
    }

    // Step 1: Check category specialist override
    const categoryConfig = await rawPrisma.routingCategoryConfig.findUnique({
      where: {
        organizationId_module_categoryKey: {
          organizationId: orgId,
          module,
          categoryKey,
        },
      },
    })

    if (categoryConfig?.specialistUserId) {
      const eligible = await isStaffEligible(
        categoryConfig.specialistUserId,
        module,
        campusId,
        orgId
      )
      if (eligible) {
        const result: RoutingResult = {
          assignedToId: categoryConfig.specialistUserId,
          reason: `Category specialist for ${categoryKey}`,
          strategy: 'UNASSIGNED',
          source: 'CATEGORY_SPECIALIST',
        }
        await logAssignment(input, result, 1)
        return result
      }

      // Specialist unavailable — try their delegate
      const delegateId = await resolveDelegate(categoryConfig.specialistUserId, module, campusId, orgId)
      if (delegateId) {
        const result: RoutingResult = {
          assignedToId: delegateId,
          reason: `Delegate for ${categoryKey} specialist (out of office)`,
          strategy: 'UNASSIGNED',
          source: 'CATEGORY_SPECIALIST',
        }
        await logAssignment(input, result, 2)
        return result
      }

      // Step 2: Check category fallback
      if (categoryConfig.fallbackUserId) {
        const fallbackEligible = await isStaffEligible(
          categoryConfig.fallbackUserId,
          module,
          campusId,
          orgId
        )
        if (fallbackEligible) {
          const result: RoutingResult = {
            assignedToId: categoryConfig.fallbackUserId,
            reason: `Fallback for ${categoryKey} (specialist unavailable)`,
            strategy: 'UNASSIGNED',
            source: 'CATEGORY_FALLBACK',
          }
          await logAssignment(input, result, 2)
          return result
        }

        // Fallback unavailable — try their delegate
        const fallbackDelegateId = await resolveDelegate(categoryConfig.fallbackUserId, module, campusId, orgId)
        if (fallbackDelegateId) {
          const result: RoutingResult = {
            assignedToId: fallbackDelegateId,
            reason: `Delegate for ${categoryKey} fallback (out of office)`,
            strategy: 'UNASSIGNED',
            source: 'CATEGORY_FALLBACK',
          }
          await logAssignment(input, result, 3)
          return result
        }
      }
    }

    // Step 3: Fall through to campus default strategy
    // Try campus-specific config first, then org-wide default (campusId = null)
    const routingConfig = await findRoutingConfig(orgId, module, campusId)

    if (!routingConfig) {
      // No routing config at all — default to unassigned
      const result: RoutingResult = {
        assignedToId: null,
        reason: 'No routing configuration found — ticket unassigned',
        strategy: 'UNASSIGNED',
        source: 'UNASSIGNED_QUEUE',
      }
      await logAssignment(input, result, 0)
      return result
    }

    const strategy = routingConfig.strategy as RoutingStrategy

    if (strategy === 'UNASSIGNED') {
      const result: RoutingResult = {
        assignedToId: null,
        reason: 'Default strategy is unassigned queue — staff will self-assign',
        strategy: 'UNASSIGNED',
        source: 'CAMPUS_DEFAULT',
      }
      await logAssignment(input, result, 0)
      return result
    }

    if (strategy === 'MANAGER_TRIAGE') {
      const result: RoutingResult = {
        assignedToId: routingConfig.managerUserId,
        reason: `Routed to triage manager for manual assignment`,
        strategy: 'MANAGER_TRIAGE',
        source: 'CAMPUS_DEFAULT',
      }
      await logAssignment(input, result, 1)
      return result
    }

    // ROUND_ROBIN or LOAD_BALANCED — need eligible staff list
    const eligible = await getEligibleStaff(campusId, module, orgId, categoryKey)

    if (eligible.length === 0) {
      const result: RoutingResult = {
        assignedToId: null,
        reason: 'No eligible staff available — ticket placed in unassigned queue',
        strategy,
        source: 'UNASSIGNED_QUEUE',
      }
      await logAssignment(input, result, 0)
      return result
    }

    if (strategy === 'ROUND_ROBIN') {
      const { userId, newIndex } = executeRoundRobin(eligible, routingConfig.roundRobinIndex)
      // Update round-robin index atomically
      await rawPrisma.moduleRoutingConfig.update({
        where: { id: routingConfig.id },
        data: { roundRobinIndex: newIndex },
      })
      const result: RoutingResult = {
        assignedToId: userId,
        reason: `Round-robin assignment (position ${newIndex})`,
        strategy: 'ROUND_ROBIN',
        source: 'CAMPUS_DEFAULT',
      }
      await logAssignment(input, result, eligible.length)
      return result
    }

    // LOAD_BALANCED
    const leastLoaded = executeLoadBalanced(eligible)
    const result: RoutingResult = {
      assignedToId: leastLoaded.userId,
      reason: `Load-balanced assignment (${leastLoaded.openTicketCount} open tickets)`,
      strategy: 'LOAD_BALANCED',
      source: 'CAMPUS_DEFAULT',
    }
    await logAssignment(input, result, eligible.length)
    return result
  } catch (err) {
    log.error({ err: String(err), ticketId, module }, 'Routing engine error — falling back to unassigned')
    const result: RoutingResult = {
      assignedToId: null,
      reason: 'Routing error — ticket placed in unassigned queue',
      strategy: 'UNASSIGNED',
      source: 'UNASSIGNED_QUEUE',
    }
    // Best-effort log — don't let logging failure mask the original error
    await logAssignment(input, result, 0).catch(() => {})
    return result
  }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

async function resolveCampusId(buildingId: string): Promise<string | null> {
  const building = await rawPrisma.building.findUnique({
    where: { id: buildingId },
    select: { campusId: true },
  })
  return building?.campusId ?? null
}

async function resolveDelegate(
  userId: string,
  module: TicketModule,
  campusId: string | null,
  orgId: string
): Promise<string | null> {
  const avail = await rawPrisma.staffAvailability.findUnique({
    where: {
      organizationId_userId_module: {
        organizationId: orgId,
        userId,
        module,
      },
    },
    select: { status: true, outUntil: true, delegateUserId: true },
  })

  if (!avail?.delegateUserId) return null

  // Only delegate when staff is actually out of office
  if (avail.status !== 'OUT_OF_OFFICE') return null
  if (avail.outUntil && avail.outUntil <= new Date()) return null // OOO expired

  // Check if delegate is eligible
  const delegateEligible = await isStaffEligible(avail.delegateUserId, module, campusId, orgId)
  return delegateEligible ? avail.delegateUserId : null
}

async function isStaffEligible(
  userId: string,
  module: TicketModule,
  campusId: string | null,
  orgId: string
): Promise<boolean> {
  // Check availability status
  const availability = await rawPrisma.staffAvailability.findUnique({
    where: {
      organizationId_userId_module: {
        organizationId: orgId,
        userId,
        module,
      },
    },
  })

  if (availability) {
    // Check if OUT_OF_OFFICE and still within the out period
    if (availability.status === 'OUT_OF_OFFICE') {
      if (!availability.outUntil || availability.outUntil > new Date()) {
        return false
      }
      // outUntil has passed — they're effectively available
    }

    // Check working hours
    if (availability.workingHours && !isWithinWorkingHours(availability.workingHours as Record<string, string>)) {
      return false
    }

    // Check capacity
    const openCount = await getOpenTicketCount(userId, module, orgId)
    const maxTickets = await getMaxTickets(userId, module, availability.maxActiveTickets)
    if (openCount >= maxTickets) {
      return false
    }
  }

  // If no StaffAvailability record, treat as available (backward compatible)
  // but still check capacity using defaults
  if (!availability) {
    const openCount = await getOpenTicketCount(userId, module, orgId)
    const maxTickets = await getMaxTickets(userId, module, 10)
    if (openCount >= maxTickets) {
      return false
    }
  }

  // Check campus assignment (if campus is known)
  if (campusId) {
    const campusAssignment = await rawPrisma.userCampusAssignment.findFirst({
      where: {
        userId,
        campusId,
        isActive: true,
      },
    })
    if (!campusAssignment) {
      return false
    }
  }

  return true
}

async function getMaxTickets(
  userId: string,
  module: TicketModule,
  defaultMax: number
): Promise<number> {
  // For maintenance, TechnicianProfile.maxActiveTickets takes precedence
  if (module === 'MAINTENANCE') {
    const techProfile = await rawPrisma.technicianProfile.findUnique({
      where: { userId },
      select: { maxActiveTickets: true },
    })
    if (techProfile) {
      return techProfile.maxActiveTickets
    }
  }
  return defaultMax
}

async function getOpenTicketCount(
  userId: string,
  module: TicketModule,
  orgId: string
): Promise<number> {
  if (module === 'MAINTENANCE') {
    return rawPrisma.maintenanceTicket.count({
      where: {
        organizationId: orgId,
        assignedToId: userId,
        status: { notIn: ['DONE', 'CANCELLED'] },
        deletedAt: null,
      },
    })
  }
  // IT module
  return rawPrisma.iTTicket.count({
    where: {
      organizationId: orgId,
      assignedToId: userId,
      status: { notIn: ['DONE', 'CANCELLED'] },
      deletedAt: null,
    },
  })
}

async function getEligibleStaff(
  campusId: string | null,
  module: TicketModule,
  orgId: string,
  categoryKey?: string
): Promise<EligibleStaff[]> {
  // Get staff with availability records for this module who are available
  const availabilities = await rawPrisma.staffAvailability.findMany({
    where: {
      organizationId: orgId,
      module,
      status: 'AVAILABLE',
    },
  })

  // Also include staff whose OUT_OF_OFFICE has expired
  const expiredOOO = await rawPrisma.staffAvailability.findMany({
    where: {
      organizationId: orgId,
      module,
      status: 'OUT_OF_OFFICE',
      outUntil: { lt: new Date() },
    },
  })

  const candidateUserIds = [
    ...availabilities.map((a) => a.userId),
    ...expiredOOO.map((a) => a.userId),
  ]

  if (candidateUserIds.length === 0) return []

  // Filter by campus assignment if applicable
  let filteredUserIds = candidateUserIds
  if (campusId) {
    const campusAssignments = await rawPrisma.userCampusAssignment.findMany({
      where: {
        campusId,
        isActive: true,
        userId: { in: candidateUserIds },
      },
      select: { userId: true },
    })
    filteredUserIds = campusAssignments.map((a) => a.userId)
  }

  if (filteredUserIds.length === 0) return []

  // Get open ticket counts and capacity for each candidate
  const eligible: EligibleStaff[] = []
  for (const userId of filteredUserIds) {
    const openCount = await getOpenTicketCount(userId, module, orgId)
    const availRecord = [...availabilities, ...expiredOOO].find((a) => a.userId === userId)
    const maxTickets = await getMaxTickets(userId, module, availRecord?.maxActiveTickets ?? 10)

    // Filter by working hours
    if (availRecord?.workingHours && !isWithinWorkingHours(availRecord.workingHours as Record<string, string>)) {
      continue
    }

    if (openCount < maxTickets) {
      // Check skill match
      const skillTags = (availRecord?.skillTags ?? []) as string[]
      const hasSkillMatch = categoryKey ? skillTags.includes(categoryKey) : false
      eligible.push({ userId, openTicketCount: openCount, maxActiveTickets: maxTickets, hasSkillMatch })
    }
  }

  return eligible
}

function executeRoundRobin(
  eligible: EligibleStaff[],
  currentIndex: number
): { userId: string; newIndex: number } {
  const index = currentIndex % eligible.length
  const picked = eligible[index]
  return { userId: picked.userId, newIndex: index + 1 }
}

function executeLoadBalanced(eligible: EligibleStaff[]): EligibleStaff {
  // Sort by skill match (matched first), then by open ticket count ascending
  const sorted = [...eligible].sort((a, b) => {
    if (a.hasSkillMatch !== b.hasSkillMatch) return a.hasSkillMatch ? -1 : 1
    return a.openTicketCount - b.openTicketCount
  })
  return sorted[0]
}

function isWithinWorkingHours(workingHours: Record<string, string>): boolean {
  const now = new Date()
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const today = days[now.getDay()]
  const schedule = workingHours[today]
  if (!schedule) return false // No schedule for today = not working

  const [start, end] = schedule.split('-')
  if (!start || !end) return false

  const [startH, startM] = start.split(':').map(Number)
  const [endH, endM] = end.split(':').map(Number)
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const startMins = startH * 60 + startM
  const endMins = endH * 60 + endM

  return nowMins >= startMins && nowMins < endMins
}

async function findPreviousAssignee(
  submittedById: string,
  module: TicketModule,
  orgId: string
): Promise<string | null> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  if (module === 'MAINTENANCE') {
    const previous = await rawPrisma.maintenanceTicket.findFirst({
      where: {
        organizationId: orgId,
        submittedById,
        assignedToId: { not: null },
        status: 'DONE',
        updatedAt: { gte: thirtyDaysAgo },
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
      select: { assignedToId: true },
    })
    return previous?.assignedToId ?? null
  }

  const previous = await rawPrisma.iTTicket.findFirst({
    where: {
      organizationId: orgId,
      submittedById,
      assignedToId: { not: null },
      status: 'DONE',
      updatedAt: { gte: thirtyDaysAgo },
      deletedAt: null,
    },
    orderBy: { updatedAt: 'desc' },
    select: { assignedToId: true },
  })
  return previous?.assignedToId ?? null
}

async function findRoutingConfig(
  orgId: string,
  module: TicketModule,
  campusId: string | null
) {
  // Try campus-specific config first
  if (campusId) {
    const campusConfig = await rawPrisma.moduleRoutingConfig.findUnique({
      where: {
        organizationId_module_campusId: {
          organizationId: orgId,
          module,
          campusId,
        },
      },
    })
    if (campusConfig) return campusConfig
  }

  // Fall back to org-wide default (campusId = null)
  // Can't use unique constraint with null, so use findFirst
  const orgDefault = await rawPrisma.moduleRoutingConfig.findFirst({
    where: {
      organizationId: orgId,
      module,
      campusId: null,
    },
  })
  return orgDefault
}

async function logAssignment(
  input: RoutingInput,
  result: RoutingResult,
  candidatesConsidered: number
): Promise<void> {
  try {
    await rawPrisma.ticketAssignmentLog.create({
      data: {
        organizationId: input.orgId,
        module: input.module,
        ticketId: input.ticketId,
        assignedToId: result.assignedToId,
        strategy: result.strategy,
        source: result.source,
        reason: result.reason,
        candidatesConsidered,
      },
    })
  } catch (err) {
    log.error({ err: String(err), ticketId: input.ticketId }, 'Failed to log assignment')
  }
}

// ─── Seed Defaults ───────────────────────────────────────────────────────────

const MAINTENANCE_CATEGORIES = [
  'ELECTRICAL',
  'PLUMBING',
  'HVAC',
  'STRUCTURAL',
  'CUSTODIAL_BIOHAZARD',
  'IT_AV',
  'GROUNDS',
  'OTHER',
] as const

const IT_CATEGORIES = [
  'HARDWARE',
  'SOFTWARE',
  'ACCOUNT_PASSWORD',
  'NETWORK',
  'DISPLAY_AV',
  'OTHER',
] as const

/**
 * Seed default routing configuration for an organization.
 * Creates org-wide ModuleRoutingConfig (UNASSIGNED strategy) and
 * RoutingCategoryConfig entries for all standard categories.
 * Idempotent — uses upsert on unique constraints.
 */
export async function seedRoutingDefaults(orgId: string): Promise<void> {
  const modules: Array<{ module: TicketModule; categories: readonly string[] }> = [
    { module: 'MAINTENANCE', categories: MAINTENANCE_CATEGORIES },
    { module: 'IT', categories: IT_CATEGORIES },
  ]

  for (const { module, categories } of modules) {
    // Upsert org-wide routing config (campusId = null)
    // findFirst + create/update since we can't upsert on a nullable unique
    const existing = await rawPrisma.moduleRoutingConfig.findFirst({
      where: { organizationId: orgId, module, campusId: null },
    })
    if (!existing) {
      await rawPrisma.moduleRoutingConfig.create({
        data: {
          organizationId: orgId,
          module,
          strategy: 'UNASSIGNED',
        },
      })
    }

    // Upsert category configs
    for (const categoryKey of categories) {
      await rawPrisma.routingCategoryConfig.upsert({
        where: {
          organizationId_module_categoryKey: {
            organizationId: orgId,
            module,
            categoryKey,
          },
        },
        update: {},
        create: {
          organizationId: orgId,
          module,
          categoryKey,
        },
      })
    }
  }

  log.info({ orgId }, 'Seeded routing defaults')
}
