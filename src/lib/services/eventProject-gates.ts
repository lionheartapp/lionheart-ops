/**
 * Event Project Service — Multi-Gate Approval Workflow
 *
 * Gate state types, builder, and validation helpers for the multi-gate
 * approval system (AV, Facilities, Admin).
 */

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

export interface ApprovalGates {
  av?: GateState
  facilities?: GateState
  admin: GateState
}

export type GateType = 'av' | 'facilities' | 'admin'

// ─── Gate Helpers ───────────────────────────────────────────────────────────

/**
 * Initializes approval gates on an EventProject when it's submitted.
 * Called from createEventProject for DIRECT_REQUEST source.
 *
 * Gate logic:
 * - requiresAV=true -> creates an 'av' gate (PENDING)
 * - requiresFacilities=true -> creates a 'facilities' gate (PENDING)
 * - Admin gate is always created but starts PENDING
 * - If no AV/Facilities needed, admin gate is immediately actionable
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
 * Check if prerequisite gates (AV, Facilities) are cleared,
 * meaning the Admin gate is actionable.
 */
export function isAdminGateActionable(gates: ApprovalGates): boolean {
  const avCleared = !gates.av || gates.av.status === 'APPROVED' || gates.av.status === 'SKIPPED'
  const facilitiesCleared = !gates.facilities || gates.facilities.status === 'APPROVED' || gates.facilities.status === 'SKIPPED'
  return avCleared && facilitiesCleared
}

/**
 * Check if ALL gates are approved (event can be confirmed).
 */
export function allGatesApproved(gates: ApprovalGates): boolean {
  const adminOk = gates.admin.status === 'APPROVED'
  const avOk = !gates.av || gates.av.status === 'APPROVED' || gates.av.status === 'SKIPPED'
  const facilitiesOk = !gates.facilities || gates.facilities.status === 'APPROVED' || gates.facilities.status === 'SKIPPED'
  return adminOk && avOk && facilitiesOk
}
