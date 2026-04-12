/**
 * Approval Flow Service (V2)
 *
 * Team-based approval flow. Each entry = one team participating in
 * the event approval pipeline with a trigger rule.
 */

import { prisma, rawPrisma, type OrgPrismaClient } from '@/lib/db'

const db = prisma as unknown as OrgPrismaClient

// ─── Resource Types ─────────────────────────────────────────────────────────

/** Fixed list of resource types that appear as toggles on the event creation form */
export const RESOURCE_TYPES = [
  { value: 'av', label: 'A/V Equipment', formField: 'requiresAV' },
  { value: 'facilities', label: 'Facilities Setup', formField: 'requiresFacilities' },
  { value: 'custodial', label: 'Custodial', formField: 'requiresCustodial' },
  { value: 'security', label: 'Security', formField: 'requiresSecurity' },
  { value: 'athletic', label: 'Athletic Facilities', formField: 'requiresAthleticDirector' },
] as const

export type ResourceType = typeof RESOURCE_TYPES[number]['value']

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ApprovalFlowEntryWithTeam {
  id: string
  teamId: string
  teamName: string
  mode: string
  trigger: string
  resourceType: string | null
  escalationHours: number
  autoSkipIfNotNeeded: boolean
  sortOrder: number
  assignedUserId: string | null
  assignedUserName: string | null
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function getApprovalFlowEntries(): Promise<ApprovalFlowEntryWithTeam[]> {
  const rows = await db.approvalFlowEntry.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      team: { select: { id: true, name: true } },
      assignedUser: { select: { id: true, firstName: true, lastName: true } },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    teamId: row.team.id,
    teamName: row.team.name,
    mode: row.mode,
    trigger: row.trigger,
    resourceType: row.resourceType,
    escalationHours: row.escalationHours,
    autoSkipIfNotNeeded: row.autoSkipIfNotNeeded,
    sortOrder: row.sortOrder,
    assignedUserId: row.assignedUser?.id ?? null,
    assignedUserName: row.assignedUser
      ? `${row.assignedUser.firstName ?? ''} ${row.assignedUser.lastName ?? ''}`.trim() || null
      : null,
  }))
}

export async function addTeamToFlow(data: {
  teamId: string
  mode: string
  trigger: string
  resourceType?: string | null
  escalationHours?: number
  autoSkipIfNotNeeded?: boolean
  sortOrder?: number
  assignedUserId?: string | null
}): Promise<void> {
  // Get next sort order if not specified
  let sortOrder = data.sortOrder
  if (sortOrder === undefined) {
    const maxEntry = await db.approvalFlowEntry.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })
    sortOrder = (maxEntry?.sortOrder ?? -1) + 1
  }

  await db.approvalFlowEntry.create({
    data: {
      teamId: data.teamId,
      mode: data.mode,
      trigger: data.trigger,
      resourceType: data.resourceType ?? null,
      escalationHours: data.escalationHours ?? 72,
      autoSkipIfNotNeeded: data.autoSkipIfNotNeeded ?? true,
      sortOrder,
      assignedUserId: data.assignedUserId ?? null,
    },
  })
}

export async function updateFlowEntry(
  id: string,
  data: {
    mode?: string
    trigger?: string
    resourceType?: string | null
    escalationHours?: number
    autoSkipIfNotNeeded?: boolean
    sortOrder?: number
    assignedUserId?: string | null
  },
): Promise<void> {
  await db.approvalFlowEntry.update({
    where: { id },
    data,
  })
}

export async function removeFromFlow(id: string): Promise<void> {
  await db.approvalFlowEntry.delete({ where: { id } })
}

export async function reorderFlow(orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.approvalFlowEntry.update({
      where: { id: orderedIds[i] },
      data: { sortOrder: i },
    })
  }
}

// ─── Gate Builder (V2) ──────────────────────────────────────────────────────

export interface GateStateV2 {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED'
  teamName: string
  trigger: string
  resourceType: string | null
  sortOrder: number
  respondedById?: string | null
  respondedAt?: string | null
  reason?: string | null
}

export interface EventResourceNeeds {
  requiresAV?: boolean
  requiresFacilities?: boolean
  requiresCustodial?: boolean
  requiresSecurity?: boolean
  requiresAthleticDirector?: boolean
}

/** Map resource type values to event form field names */
const RESOURCE_TO_FIELD: Record<string, string> = {
  av: 'requiresAV',
  facilities: 'requiresFacilities',
  custodial: 'requiresCustodial',
  security: 'requiresSecurity',
  athletic: 'requiresAthleticDirector',
}

export interface BuildGatesResult {
  gates: Record<string, GateStateV2>
  notifications: ApprovalFlowEntryWithTeam[]
}

/**
 * Build approval gates from the org's team-based approval flow.
 * Gate keys = team IDs.
 */
export async function buildGatesFromFlow(
  needs: EventResourceNeeds,
): Promise<BuildGatesResult> {
  const entries = await getApprovalFlowEntries()

  const gates: Record<string, GateStateV2> = {}
  const notifications: ApprovalFlowEntryWithTeam[] = []

  for (const entry of entries) {
    if (entry.trigger === 'ALWAYS') {
      if (entry.mode === 'REQUIRED') {
        gates[entry.teamId] = {
          status: 'PENDING',
          teamName: entry.teamName,
          trigger: 'ALWAYS',
          resourceType: null,
          sortOrder: entry.sortOrder,
        }
      } else {
        notifications.push(entry)
      }
    } else {
      // WHEN_RESOURCE_REQUESTED
      const fieldName = entry.resourceType ? RESOURCE_TO_FIELD[entry.resourceType] : null
      const eventNeedsResource = fieldName
        ? !!(needs as unknown as Record<string, unknown>)[fieldName]
        : false

      if (eventNeedsResource) {
        if (entry.mode === 'REQUIRED') {
          gates[entry.teamId] = {
            status: 'PENDING',
            teamName: entry.teamName,
            trigger: 'WHEN_RESOURCE_REQUESTED',
            resourceType: entry.resourceType,
            sortOrder: entry.sortOrder,
          }
        } else {
          notifications.push(entry)
        }
      } else if (entry.autoSkipIfNotNeeded && entry.mode === 'REQUIRED') {
        gates[entry.teamId] = {
          status: 'SKIPPED',
          teamName: entry.teamName,
          trigger: 'WHEN_RESOURCE_REQUESTED',
          resourceType: entry.resourceType,
          sortOrder: entry.sortOrder,
        }
      }
    }
  }

  return { gates, notifications }
}

/**
 * Check if a gate is actionable — all lower-sortOrder gates must be cleared.
 */
export function isGateActionable(
  gateKey: string,
  gates: Record<string, GateStateV2>,
): boolean {
  const thisGate = gates[gateKey]
  if (!thisGate) return false

  return Object.entries(gates).every(([key, gate]) => {
    if (key === gateKey) return true
    if (gate.sortOrder >= thisGate.sortOrder) return true // same or higher order — don't wait
    return gate.status === 'APPROVED' || gate.status === 'SKIPPED'
  })
}

/**
 * Check if ALL gates are approved/skipped.
 */
export function allGatesCleared(gates: Record<string, GateStateV2>): boolean {
  return Object.values(gates).every(
    (gate) => gate.status === 'APPROVED' || gate.status === 'SKIPPED',
  )
}
