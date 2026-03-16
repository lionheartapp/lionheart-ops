import { z } from 'zod'

/**
 * A single block in a template schedule, using day offsets instead of absolute dates.
 * dayOffset=0 means the event start day; dayOffset=1 means day 2, etc.
 */
export interface ScheduleBlockTemplate {
  dayOffset: number
  startTime: string  // HH:mm
  endTime: string    // HH:mm
  title: string
  type: string       // SESSION, MEAL, TRAVEL, ACTIVITY, BREAK, etc.
  location?: string
}

/**
 * A task skeleton — no assignees, no due dates, just the shape.
 */
export interface TaskTemplate {
  title: string
  category?: string  // "Logistics", "Communications", "Venue", "Volunteers", etc.
  priority?: string  // LOW, NORMAL, HIGH, CRITICAL
}

/**
 * A group structure template.
 */
export interface GroupTemplate {
  name: string
  type: string       // CABIN, BUS, ACTIVITY, TABLE, etc.
  capacity?: number
}

/**
 * A notification rule template.
 */
export interface NotificationRuleTemplate {
  triggerType: string    // DAYS_BEFORE, DAYS_AFTER, ON_DATE, etc.
  offsetDays?: number
  conditionType?: string
  label: string
  subject: string
}

/**
 * The full serialized template data stored as JSON in EventTemplate.templateData.
 */
export interface TemplateData {
  scheduleBlocks: ScheduleBlockTemplate[]
  budgetCategories: string[]
  taskTemplates: TaskTemplate[]
  documentTypes: string[]
  groupStructure: GroupTemplate[]
  notificationRules: NotificationRuleTemplate[]
}

/**
 * Input for creating a new EventTemplate (from an existing EventProject).
 */
export const CreateTemplateInputSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(200),
  description: z.string().max(1000).optional(),
  eventType: z.string().max(100).optional(),
})

export type CreateTemplateInput = z.infer<typeof CreateTemplateInputSchema>

/**
 * Input for creating an EventProject from a template.
 */
export const CreateFromTemplateInputSchema = z.object({
  title: z.string().min(1, 'Event title is required').max(300),
  startsAt: z.string().datetime({ message: 'startsAt must be a valid ISO datetime' }),
  endsAt: z.string().datetime({ message: 'endsAt must be a valid ISO datetime' }),
  locationText: z.string().max(500).optional(),
})

export type CreateFromTemplateInput = z.infer<typeof CreateFromTemplateInputSchema>

/**
 * EventTemplate as returned from the database (summary shape for lists).
 */
export interface EventTemplateSummary {
  id: string
  name: string
  description: string | null
  eventType: string | null
  expectedAttendance: number | null
  durationDays: number | null
  isMultiDay: boolean
  usageCount: number
  lastUsedAt: string | null
  createdAt: string
  createdBy: {
    id: string
    name: string | null
    firstName: string | null
    lastName: string | null
  }
}

/**
 * Full EventTemplate detail including templateData.
 */
export interface EventTemplateDetail extends EventTemplateSummary {
  templateData: TemplateData
  sourceEventProjectId: string | null
}
