import { prisma, type OrgPrismaClient } from '@/lib/db'
import { GoogleGenAI } from '@google/genai'
import { logger } from '@/lib/logger'


const log = logger.child({ service: 'eventDashboardService' })
// The db cast is needed because the org-scoped extension models are not in the generated PrismaClient type
const db = prisma as unknown as OrgPrismaClient

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionItemType =
  | 'overdue_task'
  | 'upcoming_deadline'
  | 'pending_approval'
  | 'missing_field'
  | 'no_schedule'
  | 'no_tasks'

export type ResolveAction =
  | { type: 'complete_task'; taskId: string; eventProjectId: string }
  | { type: 'approve_event'; eventProjectId: string }
  | { type: 'navigate'; url: string }

export interface RawActionItem {
  id: string
  type: ActionItemType
  title: string
  description: string
  eventProjectId: string
  eventProjectTitle: string
  dueDate?: Date
  resolveAction: ResolveAction
}

export interface ScoredActionItem extends RawActionItem {
  urgencyScore: number // 1-10
  aiReason: string
}

// Type priority order for rule-based fallback sorting (lower index = higher priority)
const TYPE_PRIORITY: ActionItemType[] = [
  'overdue_task',
  'pending_approval',
  'upcoming_deadline',
  'no_schedule',
  'missing_field',
  'no_tasks',
]

/**
 * Lightweight relative-time helper for the approval queue description.
 * Produces strings like "2 hours ago", "3 days ago", "just now".
 * We intentionally avoid pulling in date-fns here — this file runs on the
 * server and `date-fns` is a pretty hefty dependency for one helper.
 */
function describeRelativeTime(date: Date): string {
  const now = Date.now()
  const diffMs = now - date.getTime()
  if (diffMs < 60 * 1000) return 'just now'
  const minutes = Math.floor(diffMs / (60 * 1000))
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.floor(months / 12)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

// ─── Action Item Collection ───────────────────────────────────────────────────

/**
 * Collects all action items from active EventProjects.
 * Active = CONFIRMED or IN_PROGRESS status.
 * Generates items for: overdue tasks, upcoming deadlines, pending approvals,
 * missing schedules, no tasks, and missing required fields.
 */
export async function collectRawActionItems(orgId: string): Promise<RawActionItem[]> {
  const now = new Date()
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  // Fetch active projects (CONFIRMED + IN_PROGRESS)
  const activeProjects = await db.eventProject.findMany({
    where: {
      status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
    },
    include: {
      tasks: {
        where: { status: { not: 'DONE' } },
        orderBy: { dueDate: 'asc' },
      },
      scheduleBlocks: {
        select: { id: true },
      },
    },
    orderBy: { startsAt: 'asc' },
  })

  // Also fetch PENDING_APPROVAL projects separately for that action item type
  const pendingProjects = await db.eventProject.findMany({
    where: { status: 'PENDING_APPROVAL' },
    select: {
      id: true,
      title: true,
      createdAt: true,
      startsAt: true,
      createdBy: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const items: RawActionItem[] = []

  // ── Process PENDING_APPROVAL projects ───────────────────────────────────────
  // Title = the event's actual name (the most-recognizable identifier).
  // Description = who submitted + when, not boilerplate "awaiting approval" text.
  for (const project of pendingProjects) {
    const creator = project.createdBy as { firstName?: string | null; lastName?: string | null; email?: string | null } | null
    const requesterName = creator?.firstName
      ? `${creator.firstName} ${creator.lastName || ''}`.trim()
      : creator?.email || 'Unknown'
    const submittedAgo = project.createdAt
      ? describeRelativeTime(new Date(project.createdAt as Date))
      : null
    items.push({
      id: `pending_approval_${project.id}`,
      type: 'pending_approval',
      title: project.title as string,
      description: submittedAgo
        ? `Submitted ${submittedAgo} by ${requesterName} — needs admin approval`
        : `Submitted by ${requesterName} — needs admin approval`,
      eventProjectId: project.id as string,
      eventProjectTitle: project.title as string,
      dueDate: project.startsAt ? new Date(project.startsAt as Date) : undefined,
      resolveAction: { type: 'approve_event', eventProjectId: project.id as string },
    })
  }

  // ── Process active projects ─────────────────────────────────────────────────
  for (const project of activeProjects) {
    const projectTitle = project.title as string
    const projectId = project.id as string
    const tasks = project.tasks as Array<{
      id: string
      title: string
      dueDate: Date | null
      status: string
    }>
    const scheduleBlockCount = (project.scheduleBlocks as unknown[]).length

    // Overdue tasks: dueDate < now and status != DONE
    for (const task of tasks) {
      if (task.dueDate && new Date(task.dueDate) < now) {
        items.push({
          id: `overdue_task_${task.id}`,
          type: 'overdue_task',
          title: `Overdue Task: ${task.title}`,
          description: `Task in "${projectTitle}" was due on ${new Date(task.dueDate).toLocaleDateString()} and is not yet complete.`,
          eventProjectId: projectId,
          eventProjectTitle: projectTitle,
          dueDate: new Date(task.dueDate),
          resolveAction: { type: 'complete_task', taskId: task.id, eventProjectId: projectId },
        })
      }
    }

    // Upcoming deadlines: tasks due within 3 days
    for (const task of tasks) {
      if (
        task.dueDate &&
        new Date(task.dueDate) >= now &&
        new Date(task.dueDate) <= threeDaysFromNow
      ) {
        items.push({
          id: `upcoming_deadline_${task.id}`,
          type: 'upcoming_deadline',
          title: `Deadline Soon: ${task.title}`,
          description: `Task in "${projectTitle}" is due on ${new Date(task.dueDate).toLocaleDateString()} — only a few days away.`,
          eventProjectId: projectId,
          eventProjectTitle: projectTitle,
          dueDate: new Date(task.dueDate),
          resolveAction: { type: 'navigate', url: `/events/${projectId}?tab=tasks` },
        })
      }
    }

    // Missing schedule: confirmed projects with 0 schedule blocks and startsAt within 14 days
    const startsAt = project.startsAt ? new Date(project.startsAt) : null
    if (
      scheduleBlockCount === 0 &&
      startsAt &&
      startsAt > now &&
      startsAt <= fourteenDaysFromNow
    ) {
      items.push({
        id: `no_schedule_${projectId}`,
        type: 'no_schedule',
        title: 'Schedule Missing',
        description: `"${projectTitle}" starts ${startsAt.toLocaleDateString()} but has no schedule blocks. Add the run-of-show before the event.`,
        eventProjectId: projectId,
        eventProjectTitle: projectTitle,
        dueDate: startsAt,
        resolveAction: { type: 'navigate', url: `/events/${projectId}?tab=schedule` },
      })
    }

    // No tasks: confirmed projects with 0 tasks
    const allTasks = project.tasks as unknown[]
    if (allTasks.length === 0) {
      // Check if there are actually zero tasks total (including DONE ones)
      const totalTaskCount = await db.eventTask.count({ where: { eventProjectId: projectId } })
      if (totalTaskCount === 0) {
        items.push({
          id: `no_tasks_${projectId}`,
          type: 'no_tasks',
          title: 'No Tasks Created',
          description: `"${projectTitle}" is confirmed but has no planning tasks. Add tasks to track what needs to get done.`,
          eventProjectId: projectId,
          eventProjectTitle: projectTitle,
          dueDate: startsAt ?? undefined,
          resolveAction: { type: 'navigate', url: `/events/${projectId}?tab=tasks` },
        })
      }
    }

    // Missing fields: confirmed projects where description or locationText is null
    const missingFields: string[] = []
    if (!project.description) missingFields.push('description')
    if (!project.locationText) missingFields.push('location')

    if (missingFields.length > 0) {
      items.push({
        id: `missing_field_${projectId}`,
        type: 'missing_field',
        title: 'Incomplete Event Details',
        description: `"${projectTitle}" is missing: ${missingFields.join(', ')}. Complete the event info so attendees know what to expect.`,
        eventProjectId: projectId,
        eventProjectTitle: projectTitle,
        dueDate: startsAt ?? undefined,
        resolveAction: { type: 'navigate', url: `/events/${projectId}?tab=overview` },
      })
    }
  }

  return items
}

// ─── AI Scoring ───────────────────────────────────────────────────────────────

/**
 * Sorts items by type priority without AI — used as fallback.
 */
function ruleBasedSort(items: RawActionItem[]): ScoredActionItem[] {
  const baseScoreByType: Record<ActionItemType, number> = {
    overdue_task: 9,
    pending_approval: 8,
    upcoming_deadline: 7,
    no_schedule: 5,
    missing_field: 4,
    no_tasks: 3,
  }

  return items
    .map((item) => ({
      ...item,
      urgencyScore: baseScoreByType[item.type] ?? 5,
      aiReason: 'Sorted by priority type (AI scoring unavailable)',
    }))
    .sort((a, b) => {
      // Primary: urgency score descending
      if (b.urgencyScore !== a.urgencyScore) return b.urgencyScore - a.urgencyScore
      // Secondary: due date ascending (sooner first)
      const aDate = a.dueDate?.getTime() ?? Infinity
      const bDate = b.dueDate?.getTime() ?? Infinity
      return aDate - bDate
    })
}

/**
 * Calls Gemini to score and rank action items by urgency.
 * Falls back to rule-based sorting if AI is unavailable or fails.
 */
export async function scoreActionItems(items: RawActionItem[]): Promise<ScoredActionItem[]> {
  if (items.length === 0) return []

  // Skip AI for 3 or fewer items — rule-based is fine
  if (items.length <= 3) {
    return ruleBasedSort(items)
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY
  if (!apiKey) {
    return ruleBasedSort(items).map((item) => ({
      ...item,
      aiReason: 'AI scoring unavailable — GEMINI_API_KEY not set',
    }))
  }

  try {
    const client = new GoogleGenAI({ apiKey })

    const itemsForPrompt = items.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      description: item.description,
      eventTitle: item.eventProjectTitle,
      dueDate: item.dueDate ? item.dueDate.toISOString() : null,
    }))

    const prompt = `You are an AI assistant helping a school event coordinator prioritize their action items.

Review these ${items.length} action items from school events and rank each by urgency (1-10, where 10 is most urgent).

Consider:
- Overdue tasks are always high urgency (8-10)
- Pending approvals block the event from proceeding (7-9)
- Upcoming deadlines get more urgent the closer they are (6-8)
- Missing schedules for imminent events are critical (5-8)
- Missing fields impede communication (3-5)
- Events with no tasks at all are low urgency if the event is far away (2-4)

Action items (JSON array):
${JSON.stringify(itemsForPrompt, null, 2)}

Respond with ONLY a valid JSON array matching exactly this shape, one entry per action item:
[
  { "id": "<item id>", "urgencyScore": <number 1-10>, "reason": "<one sentence explanation>" }
]

Include ALL ${items.length} items. Do not add any text outside the JSON array.`

    const result = await client.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
    })

    const responseText = result.text || ''
    // Extract JSON array from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      log.warn('Gemini returned non-JSON, using rule-based sort')
      return ruleBasedSort(items)
    }

    const scores = JSON.parse(jsonMatch[0]) as Array<{
      id: string
      urgencyScore: number
      reason: string
    }>

    // Build lookup map for fast merge
    const scoreMap = new Map(scores.map((s) => [s.id, s]))

    const scored = items.map((item): ScoredActionItem => {
      const score = scoreMap.get(item.id)
      return {
        ...item,
        urgencyScore: score?.urgencyScore ?? 5,
        aiReason: score?.reason ?? 'AI scoring result unavailable for this item',
      }
    })

    // Sort by urgency score descending, then by due date ascending
    return scored.sort((a, b) => {
      if (b.urgencyScore !== a.urgencyScore) return b.urgencyScore - a.urgencyScore
      const aDate = a.dueDate?.getTime() ?? Infinity
      const bDate = b.dueDate?.getTime() ?? Infinity
      return aDate - bDate
    })
  } catch (err) {
    log.error({ err: String(err) }, 'Gemini scoring failed, falling back to rule-based sort')
    return ruleBasedSort(items)
  }
}

/**
 * Composes collectRawActionItems and scoreActionItems.
 * Returns AI-prioritized (or rule-sorted fallback) action items.
 */
export async function getAIPrioritizedActions(orgId: string): Promise<ScoredActionItem[]> {
  const raw = await collectRawActionItems(orgId)
  return scoreActionItems(raw)
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export interface DashboardStats {
  totalActiveEvents: number
  overdueItems: number
  upcomingDeadlines: number
  pendingApprovals: number
}

/**
 * Derives summary stats from a list of action items.
 * Also fetches the total active event count separately.
 */
export async function getDashboardStats(items: RawActionItem[]): Promise<DashboardStats> {
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const now = new Date()

  const totalActiveEvents = await db.eventProject.count({
    where: { status: { in: ['CONFIRMED', 'IN_PROGRESS', 'PENDING_APPROVAL'] } },
  })

  return {
    totalActiveEvents,
    overdueItems: items.filter((i) => i.type === 'overdue_task').length,
    upcomingDeadlines: items.filter(
      (i) =>
        (i.type === 'upcoming_deadline' || i.type === 'overdue_task') &&
        i.dueDate &&
        i.dueDate >= now &&
        i.dueDate <= sevenDaysFromNow,
    ).length,
    pendingApprovals: items.filter((i) => i.type === 'pending_approval').length,
  }
}
