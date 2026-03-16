/**
 * eventTemplateService.ts
 *
 * Template CRUD: save an EventProject as a reusable template, create a new
 * EventProject from a template, list and delete templates.
 *
 * Templates strip all participant data, absolute dates, and IDs — storing
 * only the structural skeleton (schedule offsets, task shapes, group structure, etc.)
 */

import { prisma } from '@/lib/db'
import { rawPrisma } from '@/lib/db'
import type {
  CreateTemplateInput,
  CreateFromTemplateInput,
  TemplateData,
  ScheduleBlockTemplate,
  TaskTemplate,
  GroupTemplate,
  NotificationRuleTemplate,
  EventTemplateSummary,
  EventTemplateDetail,
} from '@/lib/types/event-template'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert an absolute DateTime into a day offset (relative to event start) and time string.
 */
function toBlockTemplate(
  block: {
    startsAt: Date
    endsAt: Date
    title: string
    type: string
    locationText: string | null
  },
  eventStartsAt: Date,
): ScheduleBlockTemplate {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const dayOffset = Math.floor((block.startsAt.getTime() - eventStartsAt.getTime()) / MS_PER_DAY)

  const startHours = block.startsAt.getUTCHours().toString().padStart(2, '0')
  const startMins = block.startsAt.getUTCMinutes().toString().padStart(2, '0')
  const endHours = block.endsAt.getUTCHours().toString().padStart(2, '0')
  const endMins = block.endsAt.getUTCMinutes().toString().padStart(2, '0')

  return {
    dayOffset: Math.max(0, dayOffset),
    startTime: `${startHours}:${startMins}`,
    endTime: `${endHours}:${endMins}`,
    title: block.title,
    type: block.type,
    ...(block.locationText ? { location: block.locationText } : {}),
  }
}

/**
 * Apply schedule block templates to an absolute start date, returning concrete DateTime pairs.
 */
function applyDateOffsets(
  blocks: ScheduleBlockTemplate[],
  startsAt: Date,
): { startsAt: Date; endsAt: Date; title: string; type: string; locationText: string | null; sortOrder: number }[] {
  return blocks.map((block, idx) => {
    const MS_PER_DAY = 24 * 60 * 60 * 1000
    const baseDay = new Date(startsAt.getTime() + block.dayOffset * MS_PER_DAY)

    const [startH, startM] = block.startTime.split(':').map(Number)
    const [endH, endM] = block.endTime.split(':').map(Number)

    const blockStart = new Date(baseDay)
    blockStart.setUTCHours(startH ?? 0, startM ?? 0, 0, 0)

    const blockEnd = new Date(baseDay)
    blockEnd.setUTCHours(endH ?? 0, endM ?? 0, 0, 0)

    return {
      startsAt: blockStart,
      endsAt: blockEnd,
      title: block.title,
      type: block.type,
      locationText: block.location ?? null,
      sortOrder: idx,
    }
  })
}

// ---------------------------------------------------------------------------
// getTemplates
// ---------------------------------------------------------------------------

export async function getTemplates(opts?: {
  eventType?: string
}): Promise<EventTemplateSummary[]> {
  const templates = await (prisma as any).eventTemplate.findMany({
    where: opts?.eventType ? { eventType: opts.eventType } : undefined,
    orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
    include: {
      createdBy: {
        select: { id: true, name: true, firstName: true, lastName: true },
      },
    },
  })

  return templates.map((t: any) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    eventType: t.eventType,
    expectedAttendance: t.expectedAttendance,
    durationDays: t.durationDays,
    isMultiDay: t.isMultiDay,
    usageCount: t.usageCount,
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    createdBy: t.createdBy,
  }))
}

// ---------------------------------------------------------------------------
// getTemplate
// ---------------------------------------------------------------------------

export async function getTemplate(templateId: string): Promise<EventTemplateDetail | null> {
  const t = await (prisma as any).eventTemplate.findFirst({
    where: { id: templateId },
    include: {
      createdBy: {
        select: { id: true, name: true, firstName: true, lastName: true },
      },
    },
  })

  if (!t) return null

  return {
    id: t.id,
    name: t.name,
    description: t.description,
    eventType: t.eventType,
    expectedAttendance: t.expectedAttendance,
    durationDays: t.durationDays,
    isMultiDay: t.isMultiDay,
    usageCount: t.usageCount,
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    createdBy: t.createdBy,
    templateData: t.templateData as TemplateData,
    sourceEventProjectId: t.sourceEventProjectId,
  }
}

// ---------------------------------------------------------------------------
// saveAsTemplate
// ---------------------------------------------------------------------------

/**
 * Save an existing EventProject as a reusable template.
 * Strips all dates (converts to offsets), participant data, and IDs.
 */
export async function saveAsTemplate(
  eventProjectId: string,
  input: CreateTemplateInput,
  userId: string,
): Promise<EventTemplateDetail> {
  // Load EventProject with all its structural children
  const project = await (prisma as any).eventProject.findFirst({
    where: { id: eventProjectId },
    include: {
      scheduleBlocks: {
        orderBy: { startsAt: 'asc' },
      },
      tasks: {
        where: { status: { not: 'CANCELLED' } },
        orderBy: { createdAt: 'asc' },
      },
      documentRequirements: {
        orderBy: { createdAt: 'asc' },
      },
      groups: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
      },
      registrations: {
        select: { id: true },
      },
    },
  })

  if (!project) {
    throw new Error(`EventProject not found: ${eventProjectId}`)
  }

  // Derive structural data — strip personal info and absolute dates
  const scheduleBlockTemplates: ScheduleBlockTemplate[] = project.scheduleBlocks.map(
    (block: any) => toBlockTemplate(block, project.startsAt),
  )

  const taskTemplates: TaskTemplate[] = project.tasks.map((task: any) => ({
    title: task.title,
    ...(task.category ? { category: task.category } : {}),
    ...(task.priority ? { priority: task.priority } : {}),
  }))

  const documentTypes: string[] = project.documentRequirements.map((doc: any) => doc.label as string)

  const groupStructure: GroupTemplate[] = project.groups.map((group: any) => ({
    name: group.name,
    type: group.type,
    ...(group.capacity ? { capacity: group.capacity } : {}),
  }))

  // Notification rules — empty for now (Phase 22 plan 04 handles notification rules)
  const notificationRules: NotificationRuleTemplate[] = []

  // Budget categories — extracted from EventBudgetItem model when available
  // For now, store an empty array (Phase 22 plan 01 handles budgets)
  const budgetCategories: string[] = []

  const durationMs = project.endsAt.getTime() - project.startsAt.getTime()
  const durationDays = Math.max(1, Math.ceil(durationMs / (24 * 60 * 60 * 1000)))

  const templateData: TemplateData = {
    scheduleBlocks: scheduleBlockTemplates,
    budgetCategories,
    taskTemplates,
    documentTypes,
    groupStructure,
    notificationRules,
  }

  const expectedAttendance =
    project.registrations.length > 0 ? project.registrations.length : project.expectedAttendance

  const created = await (prisma as any).eventTemplate.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      sourceEventProjectId: eventProjectId,
      templateData,
      eventType: input.eventType ?? null,
      expectedAttendance: expectedAttendance ?? null,
      durationDays,
      isMultiDay: project.isMultiDay,
      createdById: userId,
    },
    include: {
      createdBy: {
        select: { id: true, name: true, firstName: true, lastName: true },
      },
    },
  })

  return {
    id: created.id,
    name: created.name,
    description: created.description,
    eventType: created.eventType,
    expectedAttendance: created.expectedAttendance,
    durationDays: created.durationDays,
    isMultiDay: created.isMultiDay,
    usageCount: created.usageCount,
    lastUsedAt: created.lastUsedAt?.toISOString() ?? null,
    createdAt: created.createdAt.toISOString(),
    createdBy: created.createdBy,
    templateData: created.templateData as TemplateData,
    sourceEventProjectId: created.sourceEventProjectId,
  }
}

// ---------------------------------------------------------------------------
// createFromTemplate
// ---------------------------------------------------------------------------

/**
 * Create a new EventProject from a template, applying date offsets to schedule blocks.
 * Increments usageCount and lastUsedAt on the template.
 */
export async function createFromTemplate(
  templateId: string,
  overrides: CreateFromTemplateInput,
  userId: string,
): Promise<{ eventProjectId: string }> {
  const template = await (prisma as any).eventTemplate.findFirst({
    where: { id: templateId },
  })

  if (!template) {
    throw new Error(`EventTemplate not found: ${templateId}`)
  }

  const templateData = template.templateData as TemplateData
  const startsAt = new Date(overrides.startsAt)
  const endsAt = new Date(overrides.endsAt)
  const isMultiDay = endsAt.getTime() - startsAt.getTime() > 24 * 60 * 60 * 1000

  // Create the EventProject
  const project = await (prisma as any).eventProject.create({
    data: {
      title: overrides.title,
      startsAt,
      endsAt,
      isMultiDay,
      locationText: overrides.locationText ?? null,
      expectedAttendance: template.expectedAttendance ?? null,
      status: 'DRAFT',
      source: 'DIRECT_REQUEST',
      createdById: userId,
    },
  })

  // Create schedule blocks from template offsets
  if (templateData.scheduleBlocks?.length > 0) {
    const concreteBlocks = applyDateOffsets(templateData.scheduleBlocks, startsAt)

    await rawPrisma.eventScheduleBlock.createMany({
      data: concreteBlocks.map((block) => ({
        organizationId: project.organizationId,
        eventProjectId: project.id,
        type: block.type as any,
        title: block.title,
        startsAt: block.startsAt,
        endsAt: block.endsAt,
        locationText: block.locationText,
        sortOrder: block.sortOrder,
      })),
    })
  }

  // Create tasks from template
  if (templateData.taskTemplates?.length > 0) {
    await rawPrisma.eventTask.createMany({
      data: templateData.taskTemplates.map((task) => ({
        organizationId: project.organizationId,
        eventProjectId: project.id,
        title: task.title,
        category: task.category ?? null,
        priority: (task.priority as any) ?? 'NORMAL',
        status: 'TODO',
        createdById: userId,
      })),
    })
  }

  // Create document requirements from template
  if (templateData.documentTypes?.length > 0) {
    try {
      await rawPrisma.eventDocumentRequirement.createMany({
        data: templateData.documentTypes.map((docLabel) => ({
          organizationId: project.organizationId,
          eventProjectId: project.id,
          label: docLabel,
          documentType: 'custom',
          isRequired: true,
        })),
      })
    } catch {
      // Non-fatal: model may not have all required fields from template
    }
  }

  // Increment template usage
  await (prisma as any).eventTemplate.update({
    where: { id: templateId },
    data: {
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  })

  return { eventProjectId: project.id }
}

// ---------------------------------------------------------------------------
// deleteTemplate
// ---------------------------------------------------------------------------

/**
 * Hard-delete a template. Templates have no soft-delete.
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  await rawPrisma.eventTemplate.delete({
    where: { id: templateId },
  })
}
