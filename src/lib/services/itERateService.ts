/**
 * IT E-Rate Compliance Service
 *
 * Manages E-Rate compliance calendar, task tracking, document retention,
 * and documentation package generation. Uses rawPrisma for all queries.
 */

import { rawPrisma } from '@/lib/db'
import { jsPDF } from 'jspdf'
import { createNotification, createBulkNotifications } from '@/lib/services/notificationService'

// ─── Static Task Definitions ──────────────────────────────────────────────────

const ERATE_TASK_DEFINITIONS = [
  { taskType: 'TECH_PLAN_REVIEW', title: 'Technology Plan Review', defaultMonth: 10, defaultDay: 1, description: 'Board-approved 3-year technology plan review and update' },
  { taskType: 'FORM_470', title: 'Form 470 Filing', defaultMonth: 11, defaultDay: 1, description: 'Post service requests to E-Rate portal (28+ days before contracts)' },
  { taskType: 'VENDOR_SELECTION', title: 'Vendor Selection', defaultMonth: 1, defaultDay: 15, description: 'Evaluate competitive bids and select service providers' },
  { taskType: 'FORM_471', title: 'Form 471 Filing', defaultMonth: 3, defaultDay: 15, description: 'File funding requests with USAC' },
  { taskType: 'FORM_486_CIPA', title: 'Form 486 / CIPA Certification', defaultMonth: 10, defaultDay: 28, description: 'Certify CIPA compliance after receiving funding commitment decision letter' },
  { taskType: 'INVOICE_RECONCILE', title: 'Invoice Reconciliation', defaultMonth: 6, defaultDay: 30, description: 'Quarterly reconciliation of E-Rate funded invoices' },
  { taskType: 'DOC_RETENTION_AUDIT', title: 'Document Retention Audit', defaultMonth: 7, defaultDay: 31, description: 'Verify 10-year document retention compliance' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

export type ERateTaskStatus = 'COMPLETED' | 'OVERDUE' | 'DUE_SOON' | 'UPCOMING'

export interface ERateTaskWithStatus {
  id: string
  taskType: string
  title: string
  description: string | null
  dueDate: Date
  completedAt: Date | null
  completedById: string | null
  completedBy?: { firstName: string | null; lastName: string | null } | null
  documentUrls: string[]
  notes: string | null
  schoolYear: string
  status: ERateTaskStatus
  daysUntilDue: number
  documentCount: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute the due date for a task given a school year string like "2025-2026".
 * If the month is >= 7 (July+), use the first year. If < 7, use the second year.
 */
function computeDueDate(schoolYear: string, month: number, day: number): Date {
  const [firstYear, secondYear] = schoolYear.split('-').map(Number)
  const year = month >= 7 ? firstYear : secondYear
  return new Date(year, month - 1, day)
}

/**
 * Compute the current school year string based on today's date.
 * If month >= 7 (July+), school year is currentYear-nextYear.
 * If month < 7, school year is prevYear-currentYear.
 */
function getCurrentSchoolYear(): string {
  const now = new Date()
  const month = now.getMonth() + 1 // 1-indexed
  const year = now.getFullYear()
  if (month >= 7) {
    return `${year}-${year + 1}`
  }
  return `${year - 1}-${year}`
}

/**
 * Compute task status based on completion and due date.
 */
function computeTaskStatus(completedAt: Date | null, dueDate: Date): ERateTaskStatus {
  if (completedAt) return 'COMPLETED'
  const now = new Date()
  if (dueDate < now) return 'OVERDUE'
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  if (dueDate < thirtyDaysFromNow) return 'DUE_SOON'
  return 'UPCOMING'
}

/**
 * Compute days until due (negative if overdue).
 */
function computeDaysUntilDue(dueDate: Date): number {
  const now = new Date()
  const diffMs = dueDate.getTime() - now.getTime()
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000))
}

/**
 * Get all users in an org who have a specific permission.
 * Same pattern as itNotificationService.ts getUsersWithPermission.
 */
async function getUsersWithPermission(
  orgId: string,
  permission: string
): Promise<{ id: string; email: string; firstName: string; lastName: string }[]> {
  const parts = permission.split(':')
  const resource = parts[0] || ''
  const action = parts[1] || ''
  const scope = parts[2]

  const permWhere = scope
    ? [{ resource, action, scope }]
    : [{ resource, action, scope: 'global' }]

  const users = await rawPrisma.user.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      userRole: {
        permissions: {
          some: {
            permission: {
              OR: [
                { resource: '*', action: '*' }, // super-admin wildcard
                ...permWhere,
              ],
            },
          },
        },
      },
    },
    select: { id: true, email: true, firstName: true, lastName: true },
  })
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName ?? '',
    lastName: u.lastName ?? '',
  }))
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Seed (upsert) the 7 E-Rate tasks for a given school year.
 * Uses the unique constraint [organizationId, taskType, schoolYear].
 * Returns the count of tasks created/updated.
 */
export async function seedERateCalendar(orgId: string, schoolYear: string): Promise<number> {
  let count = 0

  for (const def of ERATE_TASK_DEFINITIONS) {
    const dueDate = computeDueDate(schoolYear, def.defaultMonth, def.defaultDay)

    await (rawPrisma.iTERateTask as any).upsert({
      where: {
        organizationId_taskType_schoolYear: {
          organizationId: orgId,
          taskType: def.taskType,
          schoolYear,
        },
      },
      update: {
        title: def.title,
        description: def.description,
        dueDate,
      },
      create: {
        organizationId: orgId,
        taskType: def.taskType,
        title: def.title,
        description: def.description,
        dueDate,
        schoolYear,
      },
    })
    count++
  }

  return count
}

/**
 * Get all E-Rate tasks for a school year, enriched with status info.
 * If no schoolYear is provided, uses the current school year.
 * Tasks are sorted by dueDate ascending.
 */
export async function getERateTasks(
  orgId: string,
  schoolYear?: string
): Promise<ERateTaskWithStatus[]> {
  const targetYear = schoolYear || getCurrentSchoolYear()

  const tasks = await (rawPrisma.iTERateTask as any).findMany({
    where: {
      organizationId: orgId,
      schoolYear: targetYear,
      deletedAt: null,
    },
    include: {
      completedBy: {
        select: { firstName: true, lastName: true },
      },
      _count: {
        select: { documents: true },
      },
    },
    orderBy: { dueDate: 'asc' },
  })

  return tasks.map((task: any) => ({
    id: task.id,
    taskType: task.taskType,
    title: task.title,
    description: task.description,
    dueDate: task.dueDate,
    completedAt: task.completedAt,
    completedById: task.completedById,
    completedBy: task.completedBy,
    documentUrls: task.documentUrls || [],
    notes: task.notes,
    schoolYear: task.schoolYear,
    status: computeTaskStatus(task.completedAt, task.dueDate),
    daysUntilDue: computeDaysUntilDue(task.dueDate),
    documentCount: task._count?.documents ?? 0,
  }))
}

/**
 * Mark an E-Rate task as completed. Sets completedAt, completedById,
 * and optionally merges documentUrls and notes.
 */
export async function completeERateTask(
  orgId: string,
  taskId: string,
  userId: string,
  data: { documentUrls?: string[]; notes?: string }
): Promise<any> {
  // Fetch existing task to merge documentUrls
  const existing = await (rawPrisma.iTERateTask as any).findFirst({
    where: {
      id: taskId,
      organizationId: orgId,
      deletedAt: null,
    },
  })

  if (!existing) {
    throw new Error('E-Rate task not found')
  }

  const mergedDocUrls = [
    ...(existing.documentUrls || []),
    ...(data.documentUrls || []),
  ]

  const updated = await (rawPrisma.iTERateTask as any).update({
    where: { id: taskId },
    data: {
      completedAt: new Date(),
      completedById: userId,
      documentUrls: mergedDocUrls,
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
    },
    include: {
      completedBy: {
        select: { firstName: true, lastName: true },
      },
    },
  })

  return updated
}

/**
 * List E-Rate documents with optional filters by schoolYear and taskId.
 * Includes uploadedBy user name and task title. Ordered by createdAt desc.
 */
export async function getERateDocuments(
  orgId: string,
  filters: { schoolYear?: string; taskId?: string }
): Promise<any[]> {
  const where: any = {
    organizationId: orgId,
  }

  if (filters.schoolYear) {
    where.schoolYear = filters.schoolYear
  }
  if (filters.taskId) {
    where.taskId = filters.taskId
  }

  const documents = await (rawPrisma.iTERateDocument as any).findMany({
    where,
    include: {
      uploadedBy: {
        select: { firstName: true, lastName: true },
      },
      task: {
        select: { title: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return documents
}

/**
 * Upload / create a new E-Rate document record.
 * Default retentionYears is 10. retentionUntil is computed as createdAt + retentionYears.
 */
export async function uploadERateDocument(
  orgId: string,
  data: {
    title: string
    fileUrl: string
    fileType?: string
    schoolYear: string
    taskId?: string
    uploadedById?: string
    tags?: string[]
    retentionYears?: number
  }
): Promise<any> {
  const retentionYears = data.retentionYears ?? 10
  const now = new Date()
  const retentionUntil = new Date(now)
  retentionUntil.setFullYear(retentionUntil.getFullYear() + retentionYears)

  const document = await (rawPrisma.iTERateDocument as any).create({
    data: {
      organizationId: orgId,
      title: data.title,
      fileUrl: data.fileUrl,
      fileType: data.fileType ?? null,
      schoolYear: data.schoolYear,
      taskId: data.taskId ?? null,
      uploadedById: data.uploadedById ?? null,
      tags: data.tags ?? [],
      retentionUntil,
    },
    include: {
      uploadedBy: {
        select: { firstName: true, lastName: true },
      },
      task: {
        select: { title: true },
      },
    },
  })

  return document
}

/**
 * Generate a PDF documentation package for E-Rate compliance.
 * Includes:
 *   - Cover page with org name, school year, generation date
 *   - Task status table (all 7 tasks)
 *   - CIPA Evidence section (content filter event count)
 *   - Device inventory summary
 *   - Document archive list
 */
export async function generateERateDocPackage(
  orgId: string,
  schoolYear: string
): Promise<Buffer> {
  // Fetch all data in parallel
  const [org, tasks, filterEventCount, deviceStats, documents] = await Promise.all([
    rawPrisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    }),
    (rawPrisma.iTERateTask as any).findMany({
      where: { organizationId: orgId, schoolYear, deletedAt: null },
      include: {
        completedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { dueDate: 'asc' },
    }),
    (rawPrisma.iTContentFilterEvent as any).count({
      where: { organizationId: orgId },
    }),
    (rawPrisma.iTDevice as any).findMany({
      where: { organizationId: orgId, deletedAt: null },
      select: { status: true },
    }),
    (rawPrisma.iTERateDocument as any).findMany({
      where: { organizationId: orgId, schoolYear },
      include: {
        uploadedBy: { select: { firstName: true, lastName: true } },
        task: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const orgName = org?.name || 'Organization'
  const totalDevices = deviceStats.length
  const activeDevices = deviceStats.filter((d: any) => d.status === 'ACTIVE').length

  // ─── Build PDF ────────────────────────────────────────────────────────────

  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = 0

  // --- Cover Page ---
  y = 60
  doc.setFontSize(24)
  doc.text('E-Rate Documentation Package', pageWidth / 2, y, { align: 'center' })

  y += 20
  doc.setFontSize(16)
  doc.text(`School Year: ${schoolYear}`, pageWidth / 2, y, { align: 'center' })

  y += 12
  doc.setFontSize(14)
  doc.text(orgName, pageWidth / 2, y, { align: 'center' })

  y += 12
  doc.setFontSize(10)
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth / 2, y, { align: 'center' })

  // --- Task Status Table ---
  doc.addPage()
  y = margin

  doc.setFontSize(16)
  doc.text('E-Rate Task Status', margin, y)
  y += 10

  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Task', margin, y)
  doc.text('Due Date', margin + 80, y)
  doc.text('Status', margin + 120, y)
  doc.text('Completed', margin + 150, y)
  y += 6

  // Divider line
  doc.setDrawColor(200)
  doc.line(margin, y, margin + contentWidth, y)
  y += 4

  doc.setFont('helvetica', 'normal')

  for (const task of tasks) {
    const status = computeTaskStatus(task.completedAt, task.dueDate)
    const dueDateStr = task.dueDate
      ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'N/A'
    const completedStr = task.completedAt
      ? new Date(task.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '-'

    doc.text(task.title.substring(0, 35), margin, y)
    doc.text(dueDateStr, margin + 80, y)
    doc.text(status, margin + 120, y)
    doc.text(completedStr, margin + 150, y)
    y += 7

    if (y > 270) {
      doc.addPage()
      y = margin
    }
  }

  // --- CIPA Evidence Section ---
  y += 10
  if (y > 250) {
    doc.addPage()
    y = margin
  }

  doc.setFontSize(16)
  doc.text('CIPA Compliance Evidence', margin, y)
  y += 10

  doc.setFontSize(10)
  doc.text(`Content filter events recorded for ${schoolYear}: ${filterEventCount}`, margin, y)
  y += 7
  doc.text('Content filtering is actively monitored and logged as required by CIPA.', margin, y)

  // --- Device Inventory Summary ---
  y += 15
  if (y > 250) {
    doc.addPage()
    y = margin
  }

  doc.setFontSize(16)
  doc.text('Device Inventory Summary', margin, y)
  y += 10

  doc.setFontSize(10)
  doc.text(`Total devices: ${totalDevices}`, margin, y)
  y += 7
  doc.text(`Active devices: ${activeDevices}`, margin, y)

  // --- Document Archive List ---
  y += 15
  if (y > 250) {
    doc.addPage()
    y = margin
  }

  doc.setFontSize(16)
  doc.text('Document Archive', margin, y)
  y += 10

  if (documents.length === 0) {
    doc.setFontSize(10)
    doc.text('No documents archived for this school year.', margin, y)
  } else {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Title', margin, y)
    doc.text('Task', margin + 70, y)
    doc.text('Uploaded By', margin + 120, y)
    doc.text('Date', margin + 155, y)
    y += 6

    doc.setDrawColor(200)
    doc.line(margin, y, margin + contentWidth, y)
    y += 4

    doc.setFont('helvetica', 'normal')

    for (const docItem of documents) {
      const uploaderName = docItem.uploadedBy
        ? `${docItem.uploadedBy.firstName || ''} ${docItem.uploadedBy.lastName || ''}`.trim() || 'Unknown'
        : 'Unknown'
      const taskName = docItem.task?.title || '-'
      const dateStr = new Date(docItem.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

      doc.text(docItem.title.substring(0, 30), margin, y)
      doc.text(taskName.substring(0, 22), margin + 70, y)
      doc.text(uploaderName.substring(0, 15), margin + 120, y)
      doc.text(dateStr, margin + 155, y)
      y += 7

      if (y > 270) {
        doc.addPage()
        y = margin
      }
    }
  }

  // Output as Buffer
  return Buffer.from(doc.output('arraybuffer'))
}

/**
 * Send E-Rate deadline reminders at tiered intervals (60, 30, 14, 7, 3 days).
 * For each triggered reminder, finds users with 'it:erate:manage' permission
 * and sends them bulk notifications.
 */
export async function sendERateReminders(orgId?: string): Promise<void> {
  try {
    // Build the org filter
    const orgFilter: any = orgId ? { organizationId: orgId } : {}

    // Find all incomplete E-Rate tasks that are not deleted
    const tasks = await (rawPrisma.iTERateTask as any).findMany({
      where: {
        ...orgFilter,
        completedAt: null,
        deletedAt: null,
      },
    })

    const now = new Date()

    // Group tasks by org for efficient user lookups
    const tasksByOrg = new Map<string, any[]>()
    for (const task of tasks) {
      const existingTasks = tasksByOrg.get(task.organizationId) || []
      existingTasks.push(task)
      tasksByOrg.set(task.organizationId, existingTasks)
    }

    for (const [taskOrgId, orgTasks] of tasksByOrg) {
      // Look up users with it:erate:manage permission for this org
      const erateUsers = await getUsersWithPermission(taskOrgId, 'it:erate:manage')
      if (erateUsers.length === 0) continue

      for (const task of orgTasks) {
        const daysLeft = computeDaysUntilDue(task.dueDate)
        if (daysLeft < 0) continue // Already overdue, skip reminders

        const dueDateStr = new Date(task.dueDate).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })

        // Check each reminder tier in order (largest to smallest)
        const tiers: { days: number; flag: string }[] = [
          { days: 60, flag: 'remindedAt60Days' },
          { days: 30, flag: 'remindedAt30Days' },
          { days: 14, flag: 'remindedAt14Days' },
          { days: 7, flag: 'remindedAt7Days' },
          { days: 3, flag: 'remindedAt3Days' },
        ]

        for (const tier of tiers) {
          if (daysLeft <= tier.days && !task[tier.flag]) {
            // Update the flag
            await (rawPrisma.iTERateTask as any).update({
              where: { id: task.id },
              data: { [tier.flag]: true },
            })

            // Send notifications to all E-Rate managers
            await createBulkNotifications(
              erateUsers.map((u) => ({
                userId: u.id,
                type: 'erate_reminder' as any,
                title: `E-Rate Deadline: ${task.title}`,
                body: `${daysLeft} days remaining to complete ${task.title} (due ${dueDateStr})`,
                linkUrl: '/it?tab=erate',
              }))
            )
          }
        }
      }
    }
  } catch (err) {
    console.error('[ERateService] sendERateReminders failed:', err)
  }
}
