/**
 * IT Board Report Service
 *
 * Aggregates IT device fleet metrics, refresh forecasting, repair/replace analysis,
 * and damage fee collection for superintendent-ready board reports. Also handles
 * AI narrative generation via Gemini and PDF export via jsPDF.
 *
 * Uses rawPrisma for all queries — org ID is passed explicitly.
 *
 * This file re-exports all public API from sub-modules:
 *   - itBoardReport-types.ts  — shared type definitions
 *   - itBoardReport-data.ts   — database queries and metric calculations
 *   - itBoardReport-narrative.ts — AI narrative generation + Ticket ROI
 *   - itBoardReport-pdf.ts    — PDF export with jsPDF
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  AnnualTechReportMetrics,
  RefreshForecastMetrics,
  RepairReplaceMetrics,
  DamageFeeCollectionMetrics,
  ITReportType,
  TicketROIMetrics,
  TicketROIResult,
} from './itBoardReport-types'

// ─── Data Aggregation ─────────────────────────────────────────────────────────
export {
  getAnnualTechReport,
  getRefreshForecast,
  getRepairReplaceSummary,
  getDamageFeeCollection,
} from './itBoardReport-data'

// ─── AI Narrative Generation ──────────────────────────────────────────────────
export {
  generateITNarrative,
  getTicketROINarrative,
} from './itBoardReport-narrative'

// ─── PDF Export ───────────────────────────────────────────────────────────────
export {
  exportITReportPDF,
} from './itBoardReport-pdf'
