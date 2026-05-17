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

// ─── Org-scope guards ─────────────────────────────────────────────────────────
//
// These helpers exist because every write/read on ApprovalRule and
// ApprovalFlowEntry in this service uses `rawPrisma`, which bypasses the
// org-scoped Prisma extension. Without an explicit organizationId filter, a
// caller could read or mutate records belonging to another tenant just by
// guessing an id. Each guard verifies that the row exists AND belongs to the
// caller's current org context. Throws an Error('… not found') which the
// route-level withAuth wrapper translates into a 404.

async function assertRuleInOrg(ruleId: string, orgId: string): Promise<void> {
  const rule = await rawPrisma.approvalRule.findFirst({
    where: { id: ruleId, organizationId: orgId },
    select: { id: true },
  })
  if (!rule) {
    throw new Error('Approval rule not found')
  }
}

async function assertStepInOrg(stepId: string, orgId: string): Promise<void> {
  const step = await rawPrisma.approvalFlowEntry.findFirst({
    where: { id: stepId, organizationId: orgId },
    select: { id: true },
  })
  if (!step) {
    throw new Error('Approval step not found')
  }
}

async function assertTeamInOrg(teamId: string, orgId: string): Promise<void> {
  const team = await rawPrisma.team.findFirst({
    where: { id: teamId, organizationId: orgId },
    select: { id: true },
  })
  if (!team) {
    throw new Error('Team not found in this organization')
  }
}

async function assertUserInOrg(userId: string, orgId: string): Promise<void> {
  const user = await rawPrisma.user.findFirst({
    where: { id: userId, organizationId: orgId, deletedAt: null },
    select: { id: true },
  })
  if (!user) {
    throw new Error('User not found in this organization')
  }
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getApprovalRules(module?: string) {
  const orgId = getOrgContextId()
  return rawPrisma.approvalRule.findMany({
    where: { organizationId: orgId, ...(module ? { module } : {}) },
    orderBy: { sortOrder: 'asc' },
    include: {
      school: { select: { id: true, name: true, color: true } },
      campus: { select: { id: true, name: true } },
      maintenanceBuilding: { select: { id: true, name: true } },
      steps: {
        orderBy: { sortOrder: 'asc' },
        include: {
          team: { select: { id: true, name: true, slug: true } },
          assignedUser: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        },
      },
    },
  })
}

export async function getApprovalRuleById(id: string) {
  const orgId = getOrgContextId()
  // Multi-tenant safety: filter by organizationId so a caller in org A cannot
  // read another org's rule by guessing the id.
  return rawPrisma.approvalRule.findFirst({
    where: { id, organizationId: orgId },
    include: {
      school: { select: { id: true, name: true, color: true } },
      campus: { select: { id: true, name: true } },
      steps: {
        orderBy: { sortOrder: 'asc' },
        include: {
          team: { select: { id: true, name: true, slug: true } },
          assignedUser: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        },
      },
    },
  })
}

// ─── Create ───────────────────────────────────────────────────────────────────

interface CreateRuleInput {
  name: string
  module?: string
  description?: string
  schoolId?: string | null
  campusId?: string | null
  // Event conditions
  eventCategory?: string | null
  minAttendance?: number | null
  requiresResource?: string | null
  isOffCampus?: boolean | null
  // Maintenance conditions
  maintenanceCategory?: string | null
  maintenancePriority?: string | null
  maintenanceBuildingId?: string | null
  maintenanceMinCost?: number | null
  isDefault?: boolean
  isFinalApprover?: boolean
}

export async function createApprovalRule(input: CreateRuleInput) {
  const orgId = getOrgContextId()

  const maxSort = await rawPrisma.approvalRule.aggregate({
    where: { organizationId: orgId, module: input.module || 'EVENT' },
    _max: { sortOrder: true },
  })

  return rawPrisma.approvalRule.create({
    data: {
      organizationId: orgId,
      module: input.module || 'EVENT',
      name: input.name,
      description: input.description || null,
      schoolId: input.schoolId || null,
      campusId: input.campusId || null,
      eventCategory: input.eventCategory || null,
      minAttendance: input.minAttendance ?? null,
      requiresResource: input.requiresResource || null,
      isOffCampus: input.isOffCampus ?? null,
      maintenanceCategory: input.maintenanceCategory || null,
      maintenancePriority: input.maintenancePriority || null,
      maintenanceBuildingId: input.maintenanceBuildingId || null,
      maintenanceMinCost: input.maintenanceMinCost ?? null,
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
  minAttendance?: number | null
  requiresResource?: string | null
  isOffCampus?: boolean | null
  maintenanceCategory?: string | null
  maintenancePriority?: string | null
  maintenanceBuildingId?: string | null
  maintenanceMinCost?: number | null
  isDefault?: boolean
  isFinalApprover?: boolean
  isActive?: boolean
  executionMode?: string
  sortOrder?: number
}

export async function updateApprovalRule(id: string, input: UpdateRuleInput) {
  const orgId = getOrgContextId()
  // CR-001: verify the rule belongs to caller's org before mutating.
  await assertRuleInOrg(id, orgId)
  return rawPrisma.approvalRule.update({
    where: { id },
    data: input,
  })
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteApprovalRule(id: string) {
  const orgId = getOrgContextId()
  // CR-002: verify the rule belongs to caller's org before deleting.
  await assertRuleInOrg(id, orgId)
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

  // CR-004: verify the parent rule, the team, and the optional assigned user
  // all belong to the caller's org before creating a flow entry. Without these
  // checks, a caller could attach steps to another tenant's rule, or attach
  // approvers from another tenant.
  await assertRuleInOrg(input.ruleId, orgId)
  await assertTeamInOrg(input.teamId, orgId)
  if (input.assignedUserId) {
    await assertUserInOrg(input.assignedUserId, orgId)
  }

  // Get max sortOrder for steps in this rule
  const maxSort = await rawPrisma.approvalFlowEntry.aggregate({
    where: { ruleId: input.ruleId, organizationId: orgId },
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
  const orgId = getOrgContextId()
  // CR-003: verify the step belongs to caller's org before mutating.
  await assertStepInOrg(id, orgId)
  // If the caller is reassigning to a different user/team, verify those
  // referenced resources belong to the same org as well.
  if (typeof data.assignedUserId === 'string' && data.assignedUserId.length > 0) {
    await assertUserInOrg(data.assignedUserId, orgId)
  }
  if (typeof data.teamId === 'string' && data.teamId.length > 0) {
    await assertTeamInOrg(data.teamId, orgId)
  }
  return rawPrisma.approvalFlowEntry.update({
    where: { id },
    data,
  })
}

export async function removeStep(id: string) {
  const orgId = getOrgContextId()
  // CR-003: verify the step belongs to caller's org before deleting.
  await assertStepInOrg(id, orgId)
  return rawPrisma.approvalFlowEntry.delete({ where: { id } })
}

// ─── Evaluation: which rules apply to an event? ───────────────────────────────

interface EventContext {
  schoolId?: string | null
  campusId?: string | null
  category?: string | null
  expectedAttendance?: number | null
  requiresAV?: boolean
  requiresFacilities?: boolean
  requiresCustodial?: boolean
  requiresSecurity?: boolean
  isOffCampus?: boolean
}

/**
 * Given an event context, returns the ordered list of approval steps.
 * All matching conditional rules are merged (not just first match).
 * Steps are deduplicated by team+user so the same approver isn't added twice.
 * Default rules only apply when no conditional rules matched.
 * isFinalApprover rules always apply at the end.
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
  const defaultSteps: typeof rules[0]['steps'] = []
  const finalSteps: typeof rules[0]['steps'] = []

  for (const rule of rules) {
    // Final approver rules always apply
    if (rule.isFinalApprover) {
      finalSteps.push(...rule.steps)
      continue
    }

    // Collect default rules separately — only used if no conditional match
    if (rule.isDefault) {
      defaultSteps.push(...rule.steps)
      continue
    }

    // Conditional matching — merge ALL matching rules
    const matchesSchool = !rule.schoolId || rule.schoolId === eventCtx.schoolId
    const matchesCampus = !rule.campusId || rule.campusId === eventCtx.campusId
    const matchesCategory = !rule.eventCategory || rule.eventCategory === eventCtx.category
    const matchesAttendance = rule.minAttendance == null || (eventCtx.expectedAttendance ?? 0) >= rule.minAttendance
    const matchesResource = !rule.requiresResource || (
      (rule.requiresResource === 'av' && eventCtx.requiresAV) ||
      (rule.requiresResource === 'facilities' && eventCtx.requiresFacilities) ||
      (rule.requiresResource === 'custodial' && eventCtx.requiresCustodial) ||
      (rule.requiresResource === 'security' && eventCtx.requiresSecurity)
    )
    const matchesOffCampus = rule.isOffCampus == null || rule.isOffCampus === (eventCtx.isOffCampus ?? false)

    if (matchesSchool && matchesCampus && matchesCategory && matchesAttendance && matchesResource && matchesOffCampus) {
      matchedSteps.push(...rule.steps)
    }
  }

  // Use default rules only when no conditional rules matched
  const baseSteps = matchedSteps.length > 0 ? matchedSteps : defaultSteps

  // Deduplicate: same team + same user shouldn't appear twice
  const seen = new Set<string>()
  const deduped = baseSteps.filter((step) => {
    const key = `${step.teamId}:${step.assignedUserId ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return [...deduped, ...finalSteps]
}

// ─── Maintenance approval step resolution ────────────────────────────────────

interface MaintenanceTicketContext {
  schoolId?: string | null
  campusId?: string | null
  category?: string | null
  priority?: string | null
  buildingId?: string | null
  estimatedRepairCostUSD?: number | null
}

/**
 * Given a maintenance ticket context, returns the ordered list of approval steps.
 * Same merge-all-matching-rules logic as event approval.
 */
export async function resolveMaintenanceApprovalSteps(orgId: string, ticketCtx: MaintenanceTicketContext) {
  const rules = await rawPrisma.approvalRule.findMany({
    where: { organizationId: orgId, module: 'MAINTENANCE', isActive: true },
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
  const defaultSteps: typeof rules[0]['steps'] = []
  const finalSteps: typeof rules[0]['steps'] = []

  for (const rule of rules) {
    if (rule.isFinalApprover) {
      finalSteps.push(...rule.steps)
      continue
    }

    if (rule.isDefault) {
      defaultSteps.push(...rule.steps)
      continue
    }

    // Shared conditions
    const matchesSchool = !rule.schoolId || rule.schoolId === ticketCtx.schoolId
    const matchesCampus = !rule.campusId || rule.campusId === ticketCtx.campusId

    // Maintenance-specific conditions
    const matchesCategory = !rule.maintenanceCategory || rule.maintenanceCategory === ticketCtx.category
    const matchesPriority = !rule.maintenancePriority || rule.maintenancePriority === ticketCtx.priority
    const matchesBuilding = !rule.maintenanceBuildingId || rule.maintenanceBuildingId === ticketCtx.buildingId
    const matchesCost = rule.maintenanceMinCost == null || (ticketCtx.estimatedRepairCostUSD ?? 0) >= rule.maintenanceMinCost

    if (matchesSchool && matchesCampus && matchesCategory && matchesPriority && matchesBuilding && matchesCost) {
      matchedSteps.push(...rule.steps)
    }
  }

  const baseSteps = matchedSteps.length > 0 ? matchedSteps : defaultSteps

  const seen = new Set<string>()
  const deduped = baseSteps.filter((step) => {
    const key = `${step.teamId}:${step.assignedUserId ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return [...deduped, ...finalSteps]
}

// ─── IT approval step resolution ─────────────────────────────────────────────

interface ITTicketContext {
  schoolId?: string | null
  campusId?: string | null
  issueType?: string | null
  priority?: string | null
  buildingId?: string | null
}

/**
 * Given an IT ticket context, returns the ordered list of approval steps.
 * Same merge-all-matching-rules logic as event/maintenance approval.
 */
export async function resolveITApprovalSteps(orgId: string, ticketCtx: ITTicketContext) {
  const rules = await rawPrisma.approvalRule.findMany({
    where: { organizationId: orgId, module: 'IT', isActive: true, formDefinitionId: null },
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

  return evaluateRulesWithContext(rules, {
    schoolId: ticketCtx.schoolId,
    campusId: ticketCtx.campusId,
    category: ticketCtx.issueType,
    priority: ticketCtx.priority,
    buildingId: ticketCtx.buildingId,
  })
}

// ─── Form-scoped approval resolution ─────────────────────────────────────────

export interface FormSubmissionContext {
  schoolId?: string | null
  campusId?: string | null
  category?: string | null
  expectedAttendance?: number | null
  requiresAV?: boolean
  requiresFacilities?: boolean
  requiresCustodial?: boolean
  requiresSecurity?: boolean
  isOffCampus?: boolean
  priority?: string | null
  buildingId?: string | null
  estimatedCost?: number | null
  issueType?: string | null
}

/**
 * Resolves approval steps scoped to a specific form.
 * Checks form-scoped rules first. If none configured, falls back to legacy
 * module-level resolution for backwards compatibility.
 */
export async function resolveFormApprovalSteps(
  orgId: string,
  formDefinitionId: string,
  ctx: FormSubmissionContext
) {
  // 1. Try form-scoped rules first
  const formRules = await rawPrisma.approvalRule.findMany({
    where: { organizationId: orgId, formDefinitionId, isActive: true },
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

  if (formRules.length > 0) {
    return evaluateRulesWithContext(formRules, ctx)
  }

  // 2. Fallback: legacy global rules (no formDefinitionId) matching module
  const form = await rawPrisma.formDefinition.findUnique({
    where: { id: formDefinitionId },
    select: { context: true, systemKey: true },
  })

  if (!form) return []

  // Determine which legacy resolver to use based on form context
  const isIT = form.systemKey === 'it_request'
  const isMaintenance = form.systemKey === 'facilities_request' || form.context === 'TICKET_CATEGORY'

  if (isIT) {
    return resolveITApprovalSteps(orgId, {
      schoolId: ctx.schoolId,
      campusId: ctx.campusId,
      issueType: ctx.issueType ?? ctx.category,
      priority: ctx.priority,
      buildingId: ctx.buildingId,
    })
  }

  if (isMaintenance) {
    return resolveMaintenanceApprovalSteps(orgId, {
      schoolId: ctx.schoolId,
      campusId: ctx.campusId,
      category: ctx.category,
      priority: ctx.priority,
      buildingId: ctx.buildingId,
      estimatedRepairCostUSD: ctx.estimatedCost,
    })
  }

  // Default: event approval
  return resolveApprovalSteps(orgId, {
    schoolId: ctx.schoolId,
    campusId: ctx.campusId,
    category: ctx.category,
    expectedAttendance: ctx.expectedAttendance,
    requiresAV: ctx.requiresAV,
    requiresFacilities: ctx.requiresFacilities,
    requiresCustodial: ctx.requiresCustodial,
    requiresSecurity: ctx.requiresSecurity,
    isOffCampus: ctx.isOffCampus,
  })
}

// ─── Shared rule evaluation logic ────────────────────────────────────────────

interface EvalContext {
  schoolId?: string | null
  campusId?: string | null
  category?: string | null
  expectedAttendance?: number | null
  requiresAV?: boolean
  requiresFacilities?: boolean
  requiresCustodial?: boolean
  requiresSecurity?: boolean
  isOffCampus?: boolean
  priority?: string | null
  buildingId?: string | null
  estimatedCost?: number | null
  issueType?: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RuleWithSteps = any

/**
 * Shared evaluation logic for all approval rule types.
 * Merges all matching conditional rules, falls back to defaults if none match,
 * always appends final approver rules, and deduplicates by team+user.
 */
function evaluateRulesWithContext(rules: RuleWithSteps[], ctx: EvalContext) {
  const matchedSteps: RuleWithSteps[] = []
  const defaultSteps: RuleWithSteps[] = []
  const finalSteps: RuleWithSteps[] = []

  for (const rule of rules) {
    if (rule.isFinalApprover) {
      finalSteps.push(...rule.steps)
      continue
    }

    if (rule.isDefault) {
      defaultSteps.push(...rule.steps)
      continue
    }

    // Shared conditions
    const matchesSchool = !rule.schoolId || rule.schoolId === ctx.schoolId
    const matchesCampus = !rule.campusId || rule.campusId === ctx.campusId

    // Event conditions
    const matchesEventCategory = !rule.eventCategory || rule.eventCategory === ctx.category
    const matchesAttendance = rule.minAttendance == null || (ctx.expectedAttendance ?? 0) >= rule.minAttendance
    const matchesResource = !rule.requiresResource || (
      (rule.requiresResource === 'av' && ctx.requiresAV) ||
      (rule.requiresResource === 'facilities' && ctx.requiresFacilities) ||
      (rule.requiresResource === 'custodial' && ctx.requiresCustodial) ||
      (rule.requiresResource === 'security' && ctx.requiresSecurity)
    )
    const matchesOffCampus = rule.isOffCampus == null || rule.isOffCampus === (ctx.isOffCampus ?? false)

    // Maintenance/IT conditions
    const matchesMaintenanceCategory = !rule.maintenanceCategory || rule.maintenanceCategory === (ctx.category ?? ctx.issueType)
    const matchesPriority = !rule.maintenancePriority || rule.maintenancePriority === ctx.priority
    const matchesBuilding = !rule.maintenanceBuildingId || rule.maintenanceBuildingId === ctx.buildingId
    const matchesCost = rule.maintenanceMinCost == null || (ctx.estimatedCost ?? 0) >= rule.maintenanceMinCost

    const allMatch = matchesSchool && matchesCampus &&
      matchesEventCategory && matchesAttendance && matchesResource && matchesOffCampus &&
      matchesMaintenanceCategory && matchesPriority && matchesBuilding && matchesCost

    if (allMatch) {
      matchedSteps.push(...rule.steps)
    }
  }

  const baseSteps = matchedSteps.length > 0 ? matchedSteps : defaultSteps

  const seen = new Set<string>()
  const deduped = baseSteps.filter((step: RuleWithSteps) => {
    const key = `${step.teamId}:${step.assignedUserId ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return [...deduped, ...finalSteps]
}

// ─── Form-scoped CRUD helpers ────────────────────────────────────────────────

export async function getFormApprovalRules(formDefinitionId: string) {
  const orgId = getOrgContextId()
  return rawPrisma.approvalRule.findMany({
    where: { organizationId: orgId, formDefinitionId },
    orderBy: { sortOrder: 'asc' },
    include: {
      school: { select: { id: true, name: true, color: true } },
      campus: { select: { id: true, name: true } },
      maintenanceBuilding: { select: { id: true, name: true } },
      steps: {
        orderBy: { sortOrder: 'asc' },
        include: {
          team: { select: { id: true, name: true, slug: true } },
          assignedUser: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        },
      },
    },
  })
}

export async function createFormApprovalRule(formDefinitionId: string, input: CreateRuleInput) {
  const orgId = getOrgContextId()

  // Verify the form belongs to this org
  const form = await rawPrisma.formDefinition.findFirst({
    where: { id: formDefinitionId, organizationId: orgId },
    select: { id: true },
  })
  if (!form) throw new Error('Form not found')

  const maxSort = await rawPrisma.approvalRule.aggregate({
    where: { organizationId: orgId, formDefinitionId },
    _max: { sortOrder: true },
  })

  return rawPrisma.approvalRule.create({
    data: {
      organizationId: orgId,
      formDefinitionId,
      module: input.module || 'EVENT',
      name: input.name,
      description: input.description || null,
      schoolId: input.schoolId || null,
      campusId: input.campusId || null,
      eventCategory: input.eventCategory || null,
      minAttendance: input.minAttendance ?? null,
      requiresResource: input.requiresResource || null,
      isOffCampus: input.isOffCampus ?? null,
      maintenanceCategory: input.maintenanceCategory || null,
      maintenancePriority: input.maintenancePriority || null,
      maintenanceBuildingId: input.maintenanceBuildingId || null,
      maintenanceMinCost: input.maintenanceMinCost ?? null,
      isDefault: input.isDefault ?? false,
      isFinalApprover: input.isFinalApprover ?? false,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  })
}
