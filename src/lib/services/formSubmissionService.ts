/**
 * Form Submission Service
 *
 * Manages FormSubmission records — CRUD, status transitions, listing,
 * and CSV export for the submissions table and event responses tab.
 */

import { prisma } from '@/lib/db'
import type { SubmissionStatus } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubmissionFilters {
  formId: string
  status?: SubmissionStatus
  search?: string
  isDraft?: boolean
}

export interface SubmissionWithForm {
  id: string
  formId: string
  organizationId: string
  submittedBy: string | null
  submitterName: string | null
  submitterEmail: string | null
  data: Record<string, unknown>
  status: SubmissionStatus
  isDraft: boolean
  draftExpiresAt: Date | null
  approvedBy: string | null
  approvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// ─── List Submissions ────────────────────────────────────────────────────────

export async function listSubmissions(filters: SubmissionFilters) {
  const where: Record<string, unknown> = {
    formId: filters.formId,
  }

  if (filters.status) {
    where.status = filters.status
  }

  if (filters.isDraft !== undefined) {
    where.isDraft = filters.isDraft
  }

  if (filters.search) {
    const term = filters.search.trim()
    where.OR = [
      { submitterName: { contains: term, mode: 'insensitive' } },
      { submitterEmail: { contains: term, mode: 'insensitive' } },
    ]
  }

  const submissions = await prisma.formSubmission.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  })

  return submissions as SubmissionWithForm[]
}

// ─── Get Single Submission ───────────────────────────────────────────────────

export async function getSubmission(submissionId: string) {
  return prisma.formSubmission.findUnique({
    where: { id: submissionId },
  }) as Promise<SubmissionWithForm | null>
}

// ─── Create Submission (authenticated) ───────────────────────────────────────

export async function createSubmission(data: {
  formId: string
  submittedBy: string
  submitterName?: string | null
  submitterEmail?: string | null
  data: Record<string, unknown>
  isDraft?: boolean
}) {
  const status: SubmissionStatus = data.isDraft ? 'DRAFT' : 'SUBMITTED'
  const draftExpiresAt = data.isDraft
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    : null

  return (prisma.formSubmission.create as Function)({
    data: {
      formId: data.formId,
      submittedBy: data.submittedBy,
      submitterName: data.submitterName ?? null,
      submitterEmail: data.submitterEmail ?? null,
      data: data.data,
      status,
      isDraft: data.isDraft ?? false,
      draftExpiresAt,
    },
  })
}

// ─── Update Submission Data (drafts only) ────────────────────────────────────

export async function updateDraft(submissionId: string, fieldData: Record<string, unknown>) {
  const sub = await prisma.formSubmission.findUnique({
    where: { id: submissionId },
    select: { isDraft: true },
  })

  if (!sub?.isDraft) {
    throw new Error('Only drafts can be updated')
  }

  return prisma.formSubmission.update({
    where: { id: submissionId },
    data: {
      data: fieldData,
      draftExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })
}

// ─── Submit Draft ────────────────────────────────────────────────────────────

export async function submitDraft(submissionId: string) {
  return prisma.formSubmission.update({
    where: { id: submissionId },
    data: {
      status: 'SUBMITTED',
      isDraft: false,
      draftExpiresAt: null,
    },
  })
}

// ─── Transition Status ───────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<SubmissionStatus, SubmissionStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: ['SUBMITTED'], // allow re-submission
}

export async function transitionStatus(
  submissionId: string,
  newStatus: SubmissionStatus,
  userId: string
) {
  const sub = await prisma.formSubmission.findUnique({
    where: { id: submissionId },
    select: { status: true },
  })

  if (!sub) throw new Error('Submission not found')

  const allowed = VALID_TRANSITIONS[sub.status]
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot transition from ${sub.status} to ${newStatus}`)
  }

  const updateData: Record<string, unknown> = { status: newStatus }

  if (newStatus === 'APPROVED') {
    updateData.approvedBy = userId
    updateData.approvedAt = new Date()
  }

  if (newStatus === 'SUBMITTED' && sub.status === 'DRAFT') {
    updateData.isDraft = false
    updateData.draftExpiresAt = null
  }

  return prisma.formSubmission.update({
    where: { id: submissionId },
    data: updateData,
  })
}

// ─── Delete Submission ───────────────────────────────────────────────────────

export async function deleteSubmission(submissionId: string) {
  // Soft-delete is handled by the Prisma extension
  return prisma.formSubmission.delete({
    where: { id: submissionId },
  })
}

// ─── Submission Count ────────────────────────────────────────────────────────

export async function getSubmissionCount(formId: string) {
  const [total, pending, draft] = await Promise.all([
    prisma.formSubmission.count({ where: { formId, isDraft: false } }),
    prisma.formSubmission.count({ where: { formId, status: 'PENDING_APPROVAL' } }),
    prisma.formSubmission.count({ where: { formId, isDraft: true } }),
  ])
  return { total, pending, draft }
}

// ─── CSV Export ──────────────────────────────────────────────────────────────

export async function exportSubmissionsAsCsv(
  formId: string,
  fieldKeys: string[],
  fieldLabels: Record<string, string>
): Promise<string> {
  const submissions = await prisma.formSubmission.findMany({
    where: { formId, isDraft: false },
    orderBy: { createdAt: 'asc' },
  })

  // Header row
  const headers = [
    'Submitted At',
    'Status',
    'Submitter Name',
    'Submitter Email',
    ...fieldKeys.map((k) => fieldLabels[k] || k),
  ]

  const rows = submissions.map((sub) => {
    const data = (sub.data ?? {}) as Record<string, unknown>
    return [
      sub.createdAt.toISOString(),
      sub.status,
      sub.submitterName ?? '',
      sub.submitterEmail ?? '',
      ...fieldKeys.map((k) => {
        const val = data[k]
        if (val == null) return ''
        if (Array.isArray(val)) return val.join('; ')
        return String(val)
      }),
    ]
  })

  // Escape CSV values
  function escCsv(val: string): string {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`
    }
    return val
  }

  const lines = [headers.map(escCsv).join(',')]
  for (const row of rows) {
    lines.push(row.map(escCsv).join(','))
  }

  return lines.join('\n')
}
