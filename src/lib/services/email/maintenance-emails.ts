/** Maintenance ticket + asset intelligence emails */

import { sendBrandedEmail, getAppUrl, type SendEmailResult } from './transport'

type MaintenanceEmailBase = {
  to: string
  ticketNumber: string
  ticketTitle: string
  ticketLink: string
  orgName?: string
}

type MaintenanceAssignedEmailInput = MaintenanceEmailBase & { priority: string; category: string }
type MaintenanceInProgressEmailInput = MaintenanceEmailBase & { technicianName: string }
type MaintenanceOnHoldEmailInput = MaintenanceEmailBase & { holdReason: string }
type MaintenanceQAReadyEmailInput = MaintenanceEmailBase & { technicianName: string }
type MaintenanceUrgentEmailInput = MaintenanceEmailBase & { priority: string; category: string; location?: string }
type MaintenanceStaleEmailInput = MaintenanceEmailBase & { priority: string; ticketAge: string }
type MaintenanceClaimedEmailInput = MaintenanceEmailBase & { technicianName: string }
type MaintenanceQARejectedEmailInput = MaintenanceEmailBase & { rejectionNote: string }

export async function sendMaintenanceSubmittedEmail(input: MaintenanceAssignedEmailInput): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_submitted', input.to, { ticketNumber: input.ticketNumber, ticketTitle: input.ticketTitle, priority: input.priority, ticketLink: input.ticketLink, appUrl: getAppUrl() })
}

export async function sendMaintenanceAssignedEmail(input: MaintenanceAssignedEmailInput): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_assigned', input.to, { ticketNumber: input.ticketNumber, ticketTitle: input.ticketTitle, priority: input.priority, category: input.category, ticketLink: input.ticketLink, appUrl: getAppUrl() })
}

export async function sendMaintenanceClaimedEmail(input: MaintenanceClaimedEmailInput): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_claimed', input.to, { ticketNumber: input.ticketNumber, ticketTitle: input.ticketTitle, technicianName: input.technicianName, ticketLink: input.ticketLink, appUrl: getAppUrl() })
}

export async function sendMaintenanceInProgressEmail(input: MaintenanceInProgressEmailInput): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_in_progress', input.to, { ticketNumber: input.ticketNumber, ticketTitle: input.ticketTitle, technicianName: input.technicianName, ticketLink: input.ticketLink, appUrl: getAppUrl() })
}

export async function sendMaintenanceOnHoldEmail(input: MaintenanceOnHoldEmailInput): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_on_hold', input.to, { ticketNumber: input.ticketNumber, ticketTitle: input.ticketTitle, holdReason: input.holdReason, ticketLink: input.ticketLink, appUrl: getAppUrl() })
}

export async function sendMaintenanceQAReadyEmail(input: MaintenanceQAReadyEmailInput): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_qa_ready', input.to, { ticketNumber: input.ticketNumber, ticketTitle: input.ticketTitle, technicianName: input.technicianName, ticketLink: input.ticketLink, appUrl: getAppUrl() })
}

export async function sendMaintenanceDoneEmail(input: MaintenanceEmailBase): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_done', input.to, { ticketNumber: input.ticketNumber, ticketTitle: input.ticketTitle, ticketLink: input.ticketLink, appUrl: getAppUrl() })
}

export async function sendMaintenanceUrgentEmail(input: MaintenanceUrgentEmailInput): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_urgent', input.to, { ticketNumber: input.ticketNumber, ticketTitle: input.ticketTitle, priority: input.priority, category: input.category, location: input.location, ticketLink: input.ticketLink, appUrl: getAppUrl() })
}

export async function sendMaintenanceStaleEmail(input: MaintenanceStaleEmailInput): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_stale', input.to, { ticketNumber: input.ticketNumber, ticketTitle: input.ticketTitle, priority: input.priority, ticketAge: input.ticketAge, ticketLink: input.ticketLink, appUrl: getAppUrl() })
}

export async function sendMaintenanceQARejectedEmail(input: MaintenanceQARejectedEmailInput): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_qa_rejected', input.to, { ticketNumber: input.ticketNumber, ticketTitle: input.ticketTitle, rejectionNote: input.rejectionNote, ticketLink: input.ticketLink, appUrl: getAppUrl() })
}

// ─── Asset Intelligence Alerts ───────────────────────────────────────

type RepeatRepairAlertInput = { to: string; assetName: string; assetNumber: string; repairCount: number; assetUrl: string }
type CostThresholdAlertInput = { to: string; assetName: string; assetNumber: string; cumulativeCost: number; replacementCost: number; pct: number; recommendation: string; assetUrl: string }
type EndOfLifeAlertInput = { to: string; assetName: string; assetNumber: string; purchaseYear: string; expectedLifespan: number; assetUrl: string }

export async function sendRepeatRepairAlertEmail(input: RepeatRepairAlertInput): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_repeat_repair', input.to, { assetName: input.assetName, assetNumber: input.assetNumber, repairCount: String(input.repairCount), assetUrl: input.assetUrl, appUrl: getAppUrl() })
}

export async function sendCostThresholdAlertEmail(input: CostThresholdAlertInput): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_cost_threshold', input.to, { assetName: input.assetName, assetNumber: input.assetNumber, cumulativeCost: input.cumulativeCost.toFixed(2), replacementCost: input.replacementCost.toFixed(2), pct: Math.round(input.pct * 100).toString(), recommendation: input.recommendation, assetUrl: input.assetUrl, appUrl: getAppUrl() })
}

export async function sendEndOfLifeAlertEmail(input: EndOfLifeAlertInput): Promise<SendEmailResult> {
  return sendBrandedEmail('maintenance_end_of_life', input.to, { assetName: input.assetName, assetNumber: input.assetNumber, purchaseYear: input.purchaseYear, expectedLifespan: String(input.expectedLifespan), assetUrl: input.assetUrl, appUrl: getAppUrl() })
}
