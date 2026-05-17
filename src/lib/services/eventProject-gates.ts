/**
 * Event Project Service — Multi-Gate Approval Workflow
 *
 * Config-driven gate types, builder, and validation helpers.
 * Reads ApprovalChannelConfig to determine which gates to create,
 * supporting all 6 channel types (not just the original 3).
 */

import { getApprovalConfigs, seedDefaultApprovalConfigs } from './approvalConfigService'

// ─── Multi-Gate Approval Types ──────────────────────────────────────────────

/**
 * Gate state stored in EventProject.approvalGates JSON field.
 */
export interface GateState {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED'
  respondedById?: string | null
  respondedAt?: string | null
  reason?: string | null
}

export type GateType = 'admin' | 'facilities' | 'av' | 'custodial' | 'security'

export interface ApprovalGates {
  admin?: GateState
  facilities?: GateState
  av?: GateState
  custodial?: GateState
  security?: GateState
}

// ─── Channel ↔ Gate Key Translation ────────────────────────────────────────

/** Map ApprovalChannel enum values to gate keys in the JSON field */
export const CHANNEL_TO_GATE: Record<string, GateType> = {
  ADMIN: 'admin',
  FACILITIES: 'facilities',
  AV_PRODUCTION: 'av',
  CUSTODIAL: 'custodial',
  SECURITY: 'security',
}

/** Reverse: gate key → ApprovalChannel enum value */
export const GATE_TO_CHANNEL: Record<GateType, string> = {
  admin: 'ADMIN',
  facilities: 'FACILITIES',
  av: 'AV_PRODUCTION',
  custodial: 'CUSTODIAL',
  security: 'SECURITY',
}

/** Human-readable labels and default link URLs for each gate type */
export const GATE_META: Record<GateType, { label: string; defaultUrl: string }> = {
  admin: { label: 'Admin', defaultUrl: '/events' },
  av: { label: 'A/V Production', defaultUrl: '/events/approvals' },
  facilities: { label: 'Facilities', defaultUrl: '/events/approvals' },
  custodial: { label: 'Custodial', defaultUrl: '/events/approvals' },
  security: { label: 'Security', defaultUrl: '/events/approvals' },
}

// ─── Event Metadata → Channel Mapping ──────────────────────────────────────

/** Which event metadata flag triggers which channel */
const CHANNEL_TRIGGERS: Record<string, string> = {
  AV_PRODUCTION: 'requiresAV',
  FACILITIES: 'requiresFacilities',
  CUSTODIAL: 'requiresCustodial',
  SECURITY: 'requiresSecurity',
  // ADMIN has no trigger — it's always evaluated based on config mode
}

// ─── Gate Helpers ───────────────────────────────────────────────────────────

export interface EventResourceNeeds {
  requiresAV: boolean
  requiresFacilities: boolean
  requiresCustodial?: boolean
  requiresSecurity?: boolean
}

/**
 * Build approval gates by reading the org's ApprovalChannelConfig.
 *
 * For each channel:
 *   DISABLED → skip
 *   REQUIRED → create PENDING gate (or SKIPPED if autoApproveIfNoResource
 *              and the event doesn't need that resource)
 *   NOTIFICATION → no gate (non-blocking), added to notifications list
 *
 * If no config exists for the org, seeds defaults first (Admin=REQUIRED,
 * others=NOTIFICATION) to prevent silent auto-confirm.
 */
export async function buildApprovalGatesFromConfig(
  orgId: string,
  needs: EventResourceNeeds,
): Promise<{ gates: ApprovalGates; notifications: string[] }> {
  // Fetch org config, seeding defaults if none exist
  let configs = await getApprovalConfigs()
  if (configs.length === 0) {
    await seedDefaultApprovalConfigs(orgId)
    configs = await getApprovalConfigs()
  }

  const gates: ApprovalGates = {}
  const notifications: string[] = []

  for (const config of configs) {
    const channelType = config.channelType as string
    const gateKey = CHANNEL_TO_GATE[channelType]
    if (!gateKey) continue

    const mode = config.mode as string

    if (mode === 'DISABLED') continue

    if (mode === 'NOTIFICATION') {
      notifications.push(channelType)
      continue
    }

    // mode === 'REQUIRED'
    const triggerField = CHANNEL_TRIGGERS[channelType]

    if (triggerField) {
      // Resource-specific channel — check if the event needs it
      const eventNeedsResource = !!(needs as unknown as Record<string, unknown>)[triggerField]

      if (eventNeedsResource) {
        gates[gateKey] = { status: 'PENDING' }
      } else if (config.autoApproveIfNoResource) {
        gates[gateKey] = { status: 'SKIPPED' }
      }
      // If autoApproveIfNoResource is false and event doesn't need it, skip entirely
    } else {
      // No trigger field (Admin) — always create as PENDING when REQUIRED
      gates[gateKey] = { status: 'PENDING' }
    }
  }

  return { gates, notifications }
}

/**
 * Legacy builder — kept for backward compatibility during migration.
 * New code should use buildApprovalGatesFromConfig instead.
 */
export function buildApprovalGates(requiresAV: boolean, requiresFacilities: boolean): ApprovalGates {
  const gates: ApprovalGates = {
    admin: { status: 'PENDING' },
  }
  if (requiresAV) {
    gates.av = { status: 'PENDING' }
  }
  if (requiresFacilities) {
    gates.facilities = { status: 'PENDING' }
  }
  return gates
}

/**
 * Check if prerequisite gates are cleared, meaning the Admin gate is
 * actionable. Admin waits for ALL other gates to clear (not just AV + Facilities).
 */
export function isAdminGateActionable(gates: ApprovalGates): boolean {
  return Object.entries(gates).every(([key, gate]) => {
    if (key === 'admin') return true
    if (!gate) return true
    return gate.status === 'APPROVED' || gate.status === 'SKIPPED'
  })
}

/**
 * Check if ALL gates are approved/skipped (event can be confirmed).
 */
export function allGatesApproved(gates: ApprovalGates): boolean {
  return Object.entries(gates).every(([, gate]) => {
    if (!gate) return true
    return gate.status === 'APPROVED' || gate.status === 'SKIPPED'
  })
}

/**
 * Look up the assigned team ID for a gate type from the org's config.
 * Used by notifications and escalation — replaces hardcoded GATE_TEAM_SLUGS.
 */
export async function getTeamIdForGate(gateKey: GateType): Promise<string | null> {
  const channelType = GATE_TO_CHANNEL[gateKey]
  const configs = await getApprovalConfigs()
  const match = configs.find((c) => (c as Record<string, unknown>).channelType === channelType)
  return (match as Record<string, unknown> | undefined)?.assignedTeamId as string | null ?? null
}

/**
 * Look up escalation hours for a gate type from config. Falls back to 72.
 */
export async function getEscalationHoursForGate(gateKey: GateType): Promise<number> {
  const channelType = GATE_TO_CHANNEL[gateKey]
  const configs = await getApprovalConfigs()
  const match = configs.find((c) => (c as Record<string, unknown>).channelType === channelType)
  return ((match as Record<string, unknown> | undefined)?.escalationHours as number) ?? 72
}
