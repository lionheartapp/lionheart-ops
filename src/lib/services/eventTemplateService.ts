/**
 * eventTemplateService.ts
 *
 * Template CRUD: save an EventProject as a reusable template, create a new
 * EventProject from a template, list and delete templates.
 *
 * Templates strip all participant data, absolute dates, and IDs — storing
 * only the structural skeleton (schedule offsets, task shapes, group structure, etc.)
 */

import { prisma, rawPrisma, type OrgPrismaClient } from '@/lib/db'
import { cacheOrgWide, invalidateOrgCache } from '@/lib/cache/route-cache'
import { getOrgContextId } from '@/lib/org-context'
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
  const orgId = getOrgContextId()
  const bucket = `event-templates:list:type=${opts?.eventType ?? 'all'}`

  return cacheOrgWide(orgId, bucket, async () => {
    const templates = await (prisma as unknown as OrgPrismaClient).eventTemplate.findMany({
      where: opts?.eventType ? { eventType: opts.eventType } : undefined,
      orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
      include: {
        createdBy: {
          select: { id: true, name: true, firstName: true, lastName: true },
        },
      },
    })

    return templates.map((t: Record<string, unknown>) => ({
      id: t.id as string,
      name: t.name as string,
      description: t.description as string | null,
      eventType: t.eventType as string,
      expectedAttendance: t.expectedAttendance as number | null,
      durationDays: t.durationDays as number,
      isMultiDay: t.isMultiDay as boolean,
      usageCount: t.usageCount as number,
      lastUsedAt: (t.lastUsedAt as Date | null)?.toISOString() ?? null,
      createdAt: (t.createdAt as Date).toISOString(),
      createdBy: t.createdBy as { id: string; name: string | null; firstName: string | null; lastName: string | null },
    }))
  })
}

// ---------------------------------------------------------------------------
// getTemplate
// ---------------------------------------------------------------------------

export async function getTemplate(templateId: string): Promise<EventTemplateDetail | null> {
  const t = await (prisma as unknown as OrgPrismaClient).eventTemplate.findFirst({
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
  const project = await (prisma as unknown as OrgPrismaClient).eventProject.findFirst({
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
    (block: Record<string, unknown>) => toBlockTemplate(block as { startsAt: Date; endsAt: Date; title: string; type: string; locationText: string | null }, project.startsAt),
  )

  const taskTemplates: TaskTemplate[] = project.tasks.map((task: Record<string, unknown>) => ({
    title: task.title as string,
    ...(task.category ? { category: task.category as string } : {}),
    ...(task.priority ? { priority: task.priority as string } : {}),
  }))

  const documentTypes: string[] = project.documentRequirements.map((doc: Record<string, unknown>) => doc.label as string)

  const groupStructure: GroupTemplate[] = project.groups.map((group: Record<string, unknown>) => ({
    name: group.name as string,
    type: group.type as string,
    ...(group.capacity ? { capacity: group.capacity as number } : {}),
  }))

  // TODO: Capture notification rules from the source EventProject once the
  // notification rules feature is built (Phase 22 plan 04). Currently stores
  // an empty array, so templates created now will not include any notification
  // configuration. When implemented, query the project's notification rules
  // and map them to NotificationRuleTemplate shapes (strip absolute times,
  // keep relative offsets and channel preferences).
  const notificationRules: NotificationRuleTemplate[] = []

  // TODO: Capture budget categories from EventBudgetItem records once the
  // budgets feature is built (Phase 22 plan 01). Currently stores an empty
  // array, so templates created now will not include budget structure. When
  // implemented, query project.budgetItems, extract unique category names,
  // and optionally include default amounts as reference values.
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

  const created = await (prisma as unknown as OrgPrismaClient).eventTemplate.create({
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

  // New template added — invalidate cached lists for this org.
  invalidateOrgCache(getOrgContextId(), 'event-templates')

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
): Promise<{ eventProjectId: string; docRequirementsCreated: number; docRequirementsFailed: number }> {
  const template = await (prisma as unknown as OrgPrismaClient).eventTemplate.findFirst({
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
  const project = await (prisma as unknown as OrgPrismaClient).eventProject.create({
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
        type: block.type as import('@prisma/client').EventScheduleBlockType,
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
        priority: (task.priority ?? 'NORMAL') as import('@prisma/client').EventTaskPriority,
        status: 'TODO' as const,
        createdById: userId,
      })),
    })
  }

  // Create document requirements from template
  let docRequirementsCreated = 0
  let docRequirementsFailed = 0
  if (templateData.documentTypes?.length > 0) {
    try {
      const result = await rawPrisma.eventDocumentRequirement.createMany({
        data: templateData.documentTypes.map((docLabel) => ({
          organizationId: project.organizationId,
          eventProjectId: project.id,
          label: docLabel,
          documentType: 'custom',
          isRequired: true,
        })),
      })
      docRequirementsCreated = result.count
      docRequirementsFailed = templateData.documentTypes.length - result.count
      if (docRequirementsFailed > 0) {
        console.warn(
          `[eventTemplateService] Template ${templateId}: ${docRequirementsCreated}/${templateData.documentTypes.length} document requirements created, ${docRequirementsFailed} skipped`
        )
      }
    } catch (err) {
      docRequirementsFailed = templateData.documentTypes.length
      console.warn(
        `[eventTemplateService] Template ${templateId}: failed to create document requirements — ${err instanceof Error ? err.message : 'unknown error'}`
      )
    }
  }

  // Increment template usage
  await (prisma as unknown as OrgPrismaClient).eventTemplate.update({
    where: { id: templateId },
    data: {
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  })

  // usageCount/lastUsedAt feed into ordering, so cached lists are now stale.
  invalidateOrgCache(getOrgContextId(), 'event-templates')

  return {
    eventProjectId: project.id,
    docRequirementsCreated,
    docRequirementsFailed,
  }
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
  invalidateOrgCache(getOrgContextId(), 'event-templates')
}
