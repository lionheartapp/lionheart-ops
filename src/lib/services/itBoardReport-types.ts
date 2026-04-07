/**
 * IT Board Report Service — Shared Types
 *
 * Type definitions used across data aggregation, PDF export, and AI narrative modules.
 */

export interface AnnualTechReportMetrics {
  period: { from: Date; to: Date }
  totalDevices: number
  activeDevices: number
  costPerStudent: number | null
  repairRate: number // % of devices that had repairs
  fleetAgeDistribution: { range: string; count: number }[] // <1yr, 1-2yr, 2-3yr, 3-4yr, >4yr
  yoyComparison: {
    thisYear: { ticketCount: number; deviceCount: number; totalRepairCost: number }
    lastYear: { ticketCount: number; deviceCount: number; totalRepairCost: number }
  }
  itStaffToStudentRatio: string | null
  topIssueTypes: { issueType: string; count: number }[]
}

export interface RefreshForecastMetrics {
  thresholdYears: number
  devicesDueIn1Year: { count: number; projectedCost: number; models: { model: string; count: number; estCost: number }[] }
  devicesDueIn2Years: { count: number; projectedCost: number; models: { model: string; count: number; estCost: number }[] }
  devicesDueIn3Years: { count: number; projectedCost: number; models: { model: string; count: number; estCost: number }[] }
  staggeredBudget: { year1: number; year2: number; year3: number }
}

export interface RepairReplaceMetrics {
  lemonDevices: {
    id: string; assetTag: string; model: string | null
    cumulativeRepairCost: number; estimatedReplacementCost: number
    recommendation: 'repair' | 'replace'
    netSavings: number
  }[]
  totalRepairCost: number
  totalReplacementCost: number
  netSavings: number
}

export interface DamageFeeCollectionMetrics {
  totalAssessed: number
  totalPaid: number
  totalOutstanding: number
  totalWaived: number
  byCondition: { condition: string; count: number; totalFee: number }[]
  agingBuckets: { bucket: string; count: number; amount: number }[] // Current, 30-day, 60-day, 90-day+
  bySchool: { schoolId: string; schoolName: string; assessed: number; paid: number; outstanding: number }[]
}

export type ITReportType = 'annual' | 'refresh-forecast' | 'repair-replace' | 'damage-fees'

export interface TicketROIMetrics {
  totalTicketsResolved: number
  avgResolutionHours: number
  yoyImprovement: number | null // percentage
  estimatedCostSavings: number
  topIssueCategories: { issueType: string; count: number; avgHours: number }[]
  ticketsByMonth: { month: string; count: number }[]
}

export interface TicketROIResult {
  metrics: TicketROIMetrics
  narrative: string
}
