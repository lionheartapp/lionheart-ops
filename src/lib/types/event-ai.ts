import type { ScheduleBlockTemplate, TaskTemplate } from './event-template'

/**
 * AI-generated event suggestion from a natural language description.
 * Returned by generateEventFromDescription().
 */
export interface AIEventSuggestion {
  title: string
  description: string
  startsAt: string         // ISO date string (date only, e.g. "2026-04-15")
  endsAt: string           // ISO date string
  isMultiDay: boolean
  expectedAttendance: number
  locationText: string
  suggestedDocs: string[]  // e.g. ["Permission Slip", "Medical Form"]
  suggestedTasks: TaskTemplate[]
  budgetEstimate: AIBudgetLineItem[]
  scheduleBlocks: ScheduleBlockTemplate[]
}

/**
 * A single budget line item from AI estimation.
 */
export interface AIBudgetLineItem {
  category: string
  estimatedMin: number
  estimatedMax: number
}

/**
 * AI-generated multi-day schedule suggestion.
 * Returned by generateSchedule().
 */
export interface AIScheduleSuggestion {
  blocks: ScheduleBlockTemplate[]
  reasoning: string
}

/**
 * AI-generated budget estimate with per-category ranges and totals.
 * Returned by estimateBudget().
 */
export interface AIBudgetEstimate {
  categories: {
    name: string
    estimatedMin: number
    estimatedMax: number
  }[]
  totalMin: number
  totalMax: number
  reasoning: string
}

/**
 * AI-generated status summary for an in-progress EventProject.
 * Returned by generateStatusSummary().
 */
export interface AIStatusSummary {
  summary: string
  completionPercent: number
  atRisk: string[]
  nextSteps: string[]
}

/**
 * AI-generated notification draft.
 * Returned by generateNotificationDraft().
 */
export interface AINotificationDraft {
  subject: string
  body: string
}

/**
 * Input shape for generateStatusSummary().
 */
export interface EventStatusInput {
  title: string
  status: string
  registrationCount: number
  totalTasks: number
  completedTasks: number
  documentCompletionPercent: number
  budgetUtilization: number
  daysUntilEvent: number
}

/**
 * Result from analyzeFeedback().
 */
export interface AIFeedbackAnalysis {
  themes: {
    theme: string
    sentiment: string
    count: number
  }[]
  summary: string
  actionItems: string[]
}
