import { prisma, type OrgPrismaClient } from '@/lib/db'
import { createEventProject } from './eventProjectService'
import { cacheOrgWide, invalidateOrgCache } from '@/lib/cache/route-cache'
import { getOrgContextId } from '@/lib/org-context'

const db = prisma as unknown as OrgPrismaClient

/**
 * Planning seasons + submissions cross-reference each other — submissions
 * counts feed into the seasons list, and phase transitions change season
 * shape. A single 'planning' bucket covers everything.
 */
function invalidatePlanningCache(): void {
  invalidateOrgCache(getOrgContextId(), 'planning')
}

// ── Phase Transitions (state machine) ──────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  SETUP: ['COLLECTING'],
  COLLECTING: ['REVIEWING', 'SETUP'],
  REVIEWING: ['WAR_ROOM', 'COLLECTING'],
  WAR_ROOM: ['FINALIZING', 'REVIEWING'],
  FINALIZING: ['APPROVING', 'WAR_ROOM'],
  APPROVING: ['CLOSED', 'FINALIZING'],
  CLOSED: ['APPROVING'],              // reopen
}

export function canTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

// ── Seasons ────────────────────────────────────────────────────────────

export async function getSeasons(filters?: { campusId?: string; schoolId?: string }) {
  const orgId = getOrgContextId()
  const bucket = `planning:seasons:campus=${filters?.campusId ?? 'all'}:school=${filters?.schoolId ?? 'all'}`
  return cacheOrgWide(orgId, bucket, () =>
    db.planningSeason.findMany({
      where: {
        ...(filters?.campusId ? { campusId: filters.campusId } : {}),
        ...(filters?.schoolId
          ? { OR: [{ schoolId: filters.schoolId }, { schoolId: null }] }
          : {}),
      },
      include: {
        campus: { select: { id: true, name: true } },
        school: { select: { id: true, name: true } },
        _count: { select: { submissions: true, conflicts: true } },
      },
      orderBy: { startDate: 'desc' },
    })
  )
}

export async function getSeasonById(id: string) {
  return db.planningSeason.findUnique({
    where: { id },
    include: {
      campus: { select: { id: true, name: true } },
      school: { select: { id: true, name: true } },
      _count: { select: { submissions: true, conflicts: true, blackoutDates: true } },
    },
  })
}

export async function createSeason(data: {
  name: string
  startDate: Date
  endDate: Date
  submissionOpen: Date
  submissionClose: Date
  finalizationDeadline?: Date
  budgetCap?: number
  campusId?: string
  schoolId?: string
}) {
  const result = await db.planningSeason.create({
    data: {
      name: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      submissionOpen: data.submissionOpen,
      submissionClose: data.submissionClose,
      finalizationDeadline: data.finalizationDeadline || null,
      budgetCap: data.budgetCap || null,
      campusId: data.campusId || null,
      schoolId: data.schoolId || null,
      phase: 'SETUP',
    },
    include: {
      campus: { select: { id: true, name: true } },
      school: { select: { id: true, name: true } },
    },
  })
  invalidatePlanningCache()
  return result
}

export async function updateSeason(id: string, data: {
  name?: string
  startDate?: Date
  endDate?: Date
  submissionOpen?: Date
  submissionClose?: Date
  finalizationDeadline?: Date | null
  budgetCap?: number | null
}) {
  const result = await db.planningSeason.update({
    where: { id },
    data,
    include: {
      campus: { select: { id: true, name: true } },
      school: { select: { id: true, name: true } },
    },
  })
  invalidatePlanningCache()
  return result
}

export async function deleteSeason(id: string) {
  const result = await db.planningSeason.delete({ where: { id } })
  invalidatePlanningCache()
  return result
}

export async function transitionPhase(id: string, newPhase: string) {
  const season = await db.planningSeason.findUnique({ where: { id }, select: { phase: true } })
  if (!season) throw new Error('Season not found')
  if (!canTransition(season.phase, newPhase)) {
    throw new Error(`Invalid phase transition: ${season.phase} → ${newPhase}`)
  }
  const result = await db.planningSeason.update({
    where: { id },
    data: { phase: newPhase },
    include: {
      campus: { select: { id: true, name: true } },
      school: { select: { id: true, name: true } },
    },
  })
  invalidatePlanningCache()
  return result
}

// ── Submissions ────────────────────────────────────────────────────────

export async function getSubmissions(seasonId: string, filters?: { status?: string; submittedById?: string }) {
  const orgId = getOrgContextId()
  const bucket = `planning:submissions:season=${seasonId}:status=${filters?.status ?? 'all'}:by=${filters?.submittedById ?? 'all'}`
  return cacheOrgWide(orgId, bucket, () =>
    db.planningSubmission.findMany({
      where: {
        planningSeasonId: seasonId,
        ...(filters?.status ? { submissionStatus: filters.status } : {}),
        ...(filters?.submittedById ? { submittedById: filters.submittedById } : {}),
      },
      include: {
        submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        resourceNeeds: true,
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  )
}

export async function getSubmissionById(id: string) {
  return db.planningSubmission.findUnique({
    where: { id },
    include: {
      submittedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      resourceNeeds: true,
      comments: {
        include: { author: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
}

export async function createSubmission(data: {
  planningSeasonId: string
  submittedById: string
  title: string
  description?: string
  preferredDate: Date
  alternateDate1?: Date
  alternateDate2?: Date
  duration: number
  isOutdoor?: boolean
  expectedAttendance?: number
  targetAudience?: string
  priority?: string
  estimatedBudget?: number
  resourceNeeds?: Array<{ resourceType: string; details?: string }>
}) {
  const { resourceNeeds, ...rest } = data
  const result = await db.planningSubmission.create({
    data: {
      ...rest,
      isOutdoor: data.isOutdoor ?? false,
      priority: data.priority || 'IMPORTANT',
      submissionStatus: 'DRAFT',
      resourceNeeds: resourceNeeds?.length
        ? { create: resourceNeeds.map((r) => ({ resourceType: r.resourceType, details: r.details || null })) }
        : undefined,
    },
    include: {
      submittedBy: { select: { id: true, firstName: true, lastName: true } },
      resourceNeeds: true,
    },
  })
  // Bumps _count.submissions on the parent season list.
  invalidatePlanningCache()
  return result
}

export async function updateSubmission(id: string, data: {
  title?: string
  description?: string
  preferredDate?: Date
  alternateDate1?: Date | null
  alternateDate2?: Date | null
  duration?: number
  isOutdoor?: boolean
  expectedAttendance?: number | null
  targetAudience?: string | null
  priority?: string
  estimatedBudget?: number | null
}) {
  const result = await db.planningSubmission.update({
    where: { id },
    data,
    include: {
      submittedBy: { select: { id: true, firstName: true, lastName: true } },
      resourceNeeds: true,
    },
  })
  invalidatePlanningCache()
  return result
}

export async function submitSubmission(id: string) {
  const result = await db.planningSubmission.update({
    where: { id },
    data: { submissionStatus: 'SUBMITTED' },
  })
  invalidatePlanningCache()

  // Auto-detect conflicts against other submissions
  if (result.planningSeasonId) {
    detectConflicts(id, result.planningSeasonId).catch(() => {
      // Non-blocking — conflict detection failure shouldn't break submission
    })
  }

  return result
}

export async function reviewSubmission(id: string, data: {
  status: string // APPROVED_IN_PRINCIPLE, NEEDS_REVISION, DECLINED
  adminNotes?: string
}) {
  const result = await db.planningSubmission.update({
    where: { id },
    data: {
      submissionStatus: data.status,
      adminNotes: data.adminNotes || null,
    },
  })
  invalidatePlanningCache()
  return result
}

// ── Comments ───────────────────────────────────────────────────────────

export async function getComments(submissionId: string) {
  const orgId = getOrgContextId()
  const bucket = `planning:comments:submission=${submissionId}`
  return cacheOrgWide(orgId, bucket, () =>
    db.planningComment.findMany({
      where: { planningSubmissionId: submissionId },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
  )
}

export async function addComment(data: {
  planningSubmissionId: string
  authorId: string
  message: string
  isAdminOnly?: boolean
}) {
  const result = await db.planningComment.create({
    data: {
      planningSubmissionId: data.planningSubmissionId,
      authorId: data.authorId,
      message: data.message,
      isAdminOnly: data.isAdminOnly ?? false,
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
    },
  })
  // Bumps _count.comments on the parent submission list.
  invalidatePlanningCache()
  return result
}

// ── Blackout Dates ─────────────────────────────────────────────────────

export async function getBlackoutDates(seasonId: string) {
  const orgId = getOrgContextId()
  const bucket = `planning:blackouts:season=${seasonId}`
  return cacheOrgWide(orgId, bucket, () =>
    db.planningBlackoutDate.findMany({
      where: { planningSeasonId: seasonId },
      orderBy: { date: 'asc' },
    })
  )
}

export async function addBlackoutDate(data: {
  planningSeasonId: string
  date: Date
  reason?: string
}) {
  const result = await db.planningBlackoutDate.create({
    data: {
      planningSeasonId: data.planningSeasonId,
      date: data.date,
      reason: data.reason || null,
    },
  })
  invalidatePlanningCache()
  return result
}

export async function removeBlackoutDate(id: string) {
  const result = await db.planningBlackoutDate.delete({ where: { id } })
  invalidatePlanningCache()
  return result
}

// ── Conflicts ──────────────────────────────────────────────────────────

export async function getConflicts(seasonId: string) {
  const orgId = getOrgContextId()
  const bucket = `planning:conflicts:season=${seasonId}`
  return cacheOrgWide(orgId, bucket, () =>
    db.planningConflict.findMany({
      where: { planningSeasonId: seasonId },
      orderBy: [{ isResolved: 'asc' }, { severity: 'asc' }, { createdAt: 'desc' }],
    })
  )
}

/**
 * Detect and create conflicts for a newly submitted proposal.
 * Checks against all other non-draft, non-declined submissions in the same season.
 * Creates PlanningConflict records for date overlaps and resource bottlenecks.
 */
export async function detectConflicts(submissionId: string, seasonId: string) {
  const submission = await db.planningSubmission.findUnique({
    where: { id: submissionId },
    include: { resourceNeeds: true },
  })
  if (!submission) return []

  // All competing submissions (not drafts, not declined, not the current one)
  const others = await db.planningSubmission.findMany({
    where: {
      planningSeasonId: seasonId,
      id: { not: submissionId },
      submissionStatus: { notIn: ['DRAFT', 'DECLINED'] },
    },
    include: { resourceNeeds: true, submittedBy: { select: { firstName: true, lastName: true } } },
  })

  const newConflicts: Array<{
    planningSeasonId: string
    conflictType: 'DATE_OVERLAP' | 'RESOURCE_BOTTLENECK'
    severity: 'CRITICAL' | 'WARNING' | 'INFO'
    description: string
    affectedIds: string[]
    suggestedResolution: string | null
  }> = []

  const subDates = [
    submission.preferredDate,
    submission.alternateDate1,
    submission.alternateDate2,
  ].filter(Boolean).map((d) => new Date(d!).toDateString())

  for (const other of others) {
    const otherDates = [
      other.preferredDate,
      other.alternateDate1,
      other.alternateDate2,
    ].filter(Boolean).map((d) => new Date(d!).toDateString())

    // Check date overlap (preferred dates match)
    const preferredOverlap =
      new Date(submission.preferredDate).toDateString() ===
      new Date(other.preferredDate).toDateString()

    const anyDateOverlap = subDates.some((d) => otherDates.includes(d))

    if (preferredOverlap) {
      const otherName = other.submittedBy
        ? `${other.submittedBy.firstName || ''} ${other.submittedBy.lastName || ''}`.trim()
        : 'Another user'

      newConflicts.push({
        planningSeasonId: seasonId,
        conflictType: 'DATE_OVERLAP',
        severity: 'CRITICAL',
        description: `"${submission.title}" and "${other.title}" are both scheduled for ${new Date(submission.preferredDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`,
        affectedIds: [submissionId, other.id],
        suggestedResolution: 'Consider using alternate dates or coordinate timing to avoid overlap.',
      })
    } else if (anyDateOverlap) {
      newConflicts.push({
        planningSeasonId: seasonId,
        conflictType: 'DATE_OVERLAP',
        severity: 'WARNING',
        description: `"${submission.title}" and "${other.title}" have overlapping alternate dates.`,
        affectedIds: [submissionId, other.id],
        suggestedResolution: 'Review alternate dates to ensure no scheduling conflict.',
      })
    }

    // Check resource conflicts (same resource type needed on overlapping dates)
    if (anyDateOverlap && submission.resourceNeeds.length > 0 && other.resourceNeeds.length > 0) {
      const subResources = new Set(submission.resourceNeeds.map((r: { resourceType: string }) => r.resourceType))
      const sharedResources = other.resourceNeeds
        .filter((r: { resourceType: string }) => subResources.has(r.resourceType))
        .map((r: { resourceType: string }) => r.resourceType)

      if (sharedResources.length > 0) {
        newConflicts.push({
          planningSeasonId: seasonId,
          conflictType: 'RESOURCE_BOTTLENECK',
          severity: 'WARNING',
          description: `"${submission.title}" and "${other.title}" both need ${sharedResources.join(', ').toLowerCase().replace(/_/g, ' ')} on overlapping dates.`,
          affectedIds: [submissionId, other.id],
          suggestedResolution: 'Coordinate resource sharing or stagger event times.',
        })
      }
    }
  }

  // Deduplicate: don't create a conflict if the same pair already has one of the same type
  const existingConflicts = await db.planningConflict.findMany({
    where: { planningSeasonId: seasonId, isResolved: false },
    select: { conflictType: true, affectedIds: true },
  })

  const isExisting = (type: string, ids: string[]) =>
    existingConflicts.some((ec) => {
      if (ec.conflictType !== type) return false
      const existingIds = Array.isArray(ec.affectedIds) ? ec.affectedIds as string[] : []
      return ids.every((id) => existingIds.includes(id))
    })

  const toCreate = newConflicts.filter((c) => !isExisting(c.conflictType, c.affectedIds))

  if (toCreate.length > 0) {
    await Promise.all(
      toCreate.map((c) => db.planningConflict.create({ data: c }))
    )
    invalidatePlanningCache()
  }

  return toCreate
}

// ── Bulk Publish ───────────────────────────────────────────────────────

/**
 * Publishes all APPROVED submissions in a season by creating EventProject records
 * (which in turn create CalendarEvent bridge records via confirmEventProject).
 *
 * This replaces the old pattern of creating CalendarEvents directly.
 * Each submission becomes an EventProject with source=PLANNING_SUBMISSION.
 *
 * Resource requests maintain backward compatibility by referencing the CalendarEvent
 * created by the bridge. EventProject ID is stored in request metadata for traceability.
 */
export async function bulkPublish(seasonId: string, calendarId: string) {
  const submissions = await db.planningSubmission.findMany({
    where: {
      planningSeasonId: seasonId,
      submissionStatus: 'APPROVED',
    },
    include: {
      submittedBy: { select: { id: true } },
      resourceNeeds: true,
    },
  })

  const results = []
  for (const sub of submissions) {
    // Create EventProject (source=PLANNING_SUBMISSION auto-confirms and creates CalendarEvent bridge)
    const project = await createEventProject(
      {
        title: sub.title,
        description: sub.description || undefined,
        startsAt: sub.preferredDate,
        endsAt: new Date(sub.preferredDate.getTime() + sub.duration * 60000),
        calendarId,
        isMultiDay: false,
        isOffCampus: false,
        requiresAV: false,
        requiresFacilities: false,
      },
      sub.submittedBy.id,
      'PLANNING_SUBMISSION',
      sub.id,
    )

    // Find the CalendarEvent bridge record created by confirmEventProject
    // so we can attach resource requests to it (backward compatible)
    const bridgeEvent = await db.calendarEvent.findFirst({
      where: { sourceModule: 'event-project', sourceId: project.id },
      select: { id: true },
    })

    // Create resource requests from planning needs
    // If bridge event exists, attach to it; otherwise skip (no calendar available)
    if (sub.resourceNeeds.length > 0 && bridgeEvent) {
      for (const need of sub.resourceNeeds) {
        await db.eventResourceRequest.create({
          data: {
            eventId: bridgeEvent.id,
            resourceType: need.resourceType,
            details: need.details
              ? { description: need.details, eventProjectId: project.id, planningSubmissionId: sub.id }
              : { eventProjectId: project.id, planningSubmissionId: sub.id },
            requestStatus: 'PENDING',
          },
        })
      }
    }

    await db.planningSubmission.update({
      where: { id: sub.id },
      data: { submissionStatus: 'PUBLISHED' },
    })

    results.push({
      submissionId: sub.id,
      eventProjectId: project.id,
      calendarEventId: bridgeEvent?.id ?? null,
    })
  }

  // Submissions flipped to PUBLISHED + new EventProjects created — blast the
  // planning bucket so season/submission lists refresh.
  invalidatePlanningCache()
  return results
}
