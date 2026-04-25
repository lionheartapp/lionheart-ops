/**
 * Approval Rule Service
 *
 * Manages conditional approval rules. Each rule defines:
 * - Conditions: which events it applies to (school, campus, category)
 * - Steps: the approval chain (teams/people who must approve)
 *
 * Rules are evaluated in sortOrder. The first matching rule's steps apply,
 * plus any isFinalApprover rules always apply at the end.
 */

import { prisma, rawPrisma, type OrgPrismaClient } from '@/lib/db'
import { getOrgContextId } from '@/lib/org-context'

const db = () => prisma as unknown as OrgPrismaClient

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getApprovalRules() {
  const orgId = getOrgContextId()
  return rawPrisma.approvalRule.findMany({
    where: { organizationId: orgId },
    orderBy: { sortOrder: 'asc' },
    include: {
      school: { select: { id: true, name: true, color: true } },
      campus: { select: { id: true, name: true } },
      steps: {
        orderBy: { sortOrder: 'asc' },
        include: {
          team: { select: { id: true, name: true, slug: true } },
          assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
    },
  })
}

export async function getApprovalRuleById(id: string) {
  return rawPrisma.approvalRule.findUnique({
    where: { id },
    include: {
      school: { select: { id: true, name: true, color: true } },
      campus: { select: { id: true, name: true } },
      steps: {
        orderBy: { sortOrder: 'asc' },
        include: {
          team: { select: { id: true, name: true, slug: true } },
          assignedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
    },
  })
}

// ─── Create ───────────────────────────────────────────────────────────────────

interface CreateRuleInput {
  name: string
  description?: string
  schoolId?: string | null
  campusId?: string | null
  eventCategory?: string | null
  isDefault?: boolean
  isFinalApprover?: boolean
}

export async function createApprovalRule(input: CreateRuleInput) {
  const orgId = getOrgContextId()

  // Get max sortOrder for this org
  const maxSort = await rawPrisma.approvalRule.aggregate({
    where: { organizationId: orgId },
    _max: { sortOrder: true },
  })

  return rawPrisma.approvalRule.create({
    data: {
      organizationId: orgId,
      name: input.name,
      description: input.description || null,
      schoolId: input.schoolId || null,
      campusId: input.campusId || null,
      eventCategory: input.eventCategory || null,
      isDefault: input.isDefault ?? false,
      isFinalApprover: input.isFinalApprover ?? false,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  })
}

// ─── Update ───────────────────────────────────────────────────────────────────

interface UpdateRuleInput {
  name?: string
  description?: string | null
  schoolId?: string | null
  campusId?: string | null
  eventCategory?: string | null
  isDefault?: boolean
  isFinalApprover?: boolean
  isActive?: boolean
  executionMode?: string
  sortOrder?: number
}

export async function updateApprovalRule(id: string, input: UpdateRuleInput) {
  return rawPrisma.approvalRule.update({
    where: { id },
    data: input,
  })
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteApprovalRule(id: string) {
  // Cascade deletes steps via onDelete: Cascade
  return rawPrisma.approvalRule.delete({ where: { id } })
}

// ─── Steps ────────────────────────────────────────────────────────────────────

interface AddStepInput {
  ruleId: string
  teamId: string
  mode?: string
  trigger?: string
  resourceType?: string | null
  escalationHours?: number
  assignedUserId?: string | null
}

export async function addStepToRule(input: AddStepInput) {
  const orgId = getOrgContextId()

  // Get max sortOrder for steps in this rule
  const maxSort = await rawPrisma.approvalFlowEntry.aggregate({
    where: { ruleId: input.ruleId },
    _max: { sortOrder: true },
  })

  return rawPrisma.approvalFlowEntry.create({
    data: {
      organizationId: orgId,
      ruleId: input.ruleId,
      teamId: input.teamId,
      mode: input.mode ?? 'REQUIRED',
      trigger: input.trigger ?? 'ALWAYS',
      resourceType: input.resourceType || null,
      escalationHours: input.escalationHours ?? 72,
      assignedUserId: input.assignedUserId || null,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  })
}

export async function updateStep(id: string, data: Record<string, unknown>) {
  return rawPrisma.approvalFlowEntry.update({
    where: { id },
    data,
  })
}

export async function removeStep(id: string) {
  return rawPrisma.approvalFlowEntry.delete({ where: { id } })
}

// ─── Evaluation: which rules apply to an event? ───────────────────────────────

interface EventContext {
  schoolId?: string | null
  campusId?: string | null
  category?: string | null
}

/**
 * Given an event context, returns the ordered list of approval steps.
 * 1. Find the first matching conditional rule
 * 2. Always include isFinalApprover rule steps at the end
 */
export async function resolveApprovalSteps(orgId: string, eventCtx: EventContext) {
  const rules = await rawPrisma.approvalRule.findMany({
    where: { organizationId: orgId, isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      steps: {
        orderBy: { sortOrder: 'asc' },
        include: {
          team: { select: { id: true, name: true } },
        },
      },
    },
  })

  const matchedSteps: typeof rules[0]['steps'] = []
  const finalSteps: typeof rules[0]['steps'] = []

  for (const rule of rules) {
    // Final approver rules always apply
    if (rule.isFinalApprover) {
      finalSteps.push(...rule.steps)
      continue
    }

    // Default rules match when no specific rule matched yet
    if (rule.isDefault) {
      if (matchedSteps.length === 0) {
        matchedSteps.push(...rule.steps)
      }
      continue
    }

    // Conditional matching
    const matchesSchool = !rule.schoolId || rule.schoolId === eventCtx.schoolId
    const matchesCampus = !rule.campusId || rule.campusId === eventCtx.campusId
    const matchesCategory = !rule.eventCategory || rule.eventCategory === eventCtx.category

    if (matchesSchool && matchesCampus && matchesCategory) {
      matchedSteps.push(...rule.steps)
      break // First match wins (rules are sorted by priority)
    }
  }

  return [...matchedSteps, ...finalSteps]
}
