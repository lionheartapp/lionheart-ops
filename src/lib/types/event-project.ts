import { z } from 'zod'

// ─── Event Project ──────────────────────────────────────────────────────────

export const CreateEventProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  description: z.string().max(5000).optional(),
  coverImageUrl: z.string().url().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  isMultiDay: z.boolean().optional().default(false),
  expectedAttendance: z.number().int().positive().optional(),
  locationText: z.string().max(500).optional(),
  buildingId: z.string().optional(),
  areaId: z.string().optional(),
  roomId: z.string().optional(),
  campusId: z.string().optional(),
  schoolId: z.string().optional(),
  calendarId: z.string().optional(),
  requiresAV: z.boolean().optional().default(false),
  requiresFacilities: z.boolean().optional().default(false),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type CreateEventProjectInput = z.infer<typeof CreateEventProjectSchema>

export const UpdateEventProjectSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  coverImageUrl: z.string().url().nullable().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  isMultiDay: z.boolean().optional(),
  expectedAttendance: z.number().int().positive().nullable().optional(),
  locationText: z.string().max(500).nullable().optional(),
  buildingId: z.string().nullable().optional(),
  areaId: z.string().nullable().optional(),
  roomId: z.string().nullable().optional(),
  campusId: z.string().nullable().optional(),
  schoolId: z.string().nullable().optional(),
  calendarId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export type UpdateEventProjectInput = z.infer<typeof UpdateEventProjectSchema>

// ─── Schedule Block ─────────────────────────────────────────────────────────

// ─── Schedule Sections ──────────────────────────────────────────────────────

export const CreateScheduleSectionSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  sortOrder: z.number().int().min(0).optional().default(0),
})

export type CreateScheduleSectionInput = z.infer<typeof CreateScheduleSectionSchema>

export const UpdateScheduleSectionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export type UpdateScheduleSectionInput = z.infer<typeof UpdateScheduleSectionSchema>

// ─── Schedule Blocks ────────────────────────────────────────────────────────

export const CreateScheduleBlockSchema = z.object({
  type: z.enum(['SESSION', 'ACTIVITY', 'MEAL', 'FREE_TIME', 'TRAVEL', 'SETUP']),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  locationText: z.string().max(500).optional(),
  leadId: z.string().optional(),
  sectionId: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).optional().default(0),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type CreateScheduleBlockInput = z.infer<typeof CreateScheduleBlockSchema>

export const UpdateScheduleBlockSchema = z.object({
  type: z.enum(['SESSION', 'ACTIVITY', 'MEAL', 'FREE_TIME', 'TRAVEL', 'SETUP']).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  locationText: z.string().max(500).nullable().optional(),
  leadId: z.string().nullable().optional(),
  sectionId: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export type UpdateScheduleBlockInput = z.infer<typeof UpdateScheduleBlockSchema>

// ─── Event Task ─────────────────────────────────────────────────────────────

export const CreateEventTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']).optional().default('TODO'),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional().default('NORMAL'),
  category: z.string().max(100).optional(),
  assigneeId: z.string().optional(),
  dueDate: z.coerce.date().optional(),
})

export type CreateEventTaskInput = z.infer<typeof CreateEventTaskSchema>

export const UpdateEventTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional(),
  category: z.string().max(100).nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
})

export type UpdateEventTaskInput = z.infer<typeof UpdateEventTaskSchema>

// ─── Event Series ────────────────────────────────────────────────────────────

export const CreateEventSeriesSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional(),
  rrule: z.string().optional(),
  defaultStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format').optional(),
  defaultDuration: z.number().int().positive().optional(),
  defaultLocationText: z.string().max(500).optional(),
  defaultBuildingId: z.string().optional(),
  defaultRoomId: z.string().optional(),
  resourceNeeds: z.record(z.string(), z.unknown()).optional(),
  campusId: z.string().optional(),
})

export type CreateEventSeriesInput = z.infer<typeof CreateEventSeriesSchema>

export const UpdateEventSeriesSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  rrule: z.string().nullable().optional(),
  defaultStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'Must be HH:mm format').nullable().optional(),
  defaultDuration: z.number().int().positive().nullable().optional(),
  defaultLocationText: z.string().max(500).nullable().optional(),
  defaultBuildingId: z.string().nullable().optional(),
  defaultRoomId: z.string().nullable().optional(),
  resourceNeeds: z.record(z.string(), z.unknown()).nullable().optional(),
  isActive: z.boolean().optional(),
})

export type UpdateEventSeriesInput = z.infer<typeof UpdateEventSeriesSchema>
