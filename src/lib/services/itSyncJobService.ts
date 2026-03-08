/**
 * IT Sync Job Service
 *
 * Manages ITSyncJob lifecycle for device and roster sync operations:
 * - Job creation (PENDING) linked to an ITSyncConfig
 * - Status transitions (RUNNING, COMPLETED, FAILED)
 * - Progress tracking with record counters
 * - Job listing with filtering and pagination
 */

import { prisma } from '@/lib/db'

// ─── Types ──────────────────────────────────────────────────────────────────

interface JobProgressData {
  recordsCreated?: number
  recordsUpdated?: number
  recordsSkipped?: number
}

interface JobStats {
  recordsCreated: number
  recordsUpdated: number
  recordsSkipped: number
}

interface ListJobsFilters {
  provider?: string
  jobType?: string
  status?: string
  configId?: string
  limit?: number
  offset?: number
}

// ─── Create Job ─────────────────────────────────────────────────────────────

export async function createJob(
  configId: string,
  provider: string,
  jobType: string
) {
  const job = await (prisma.iTSyncJob.create as Function)({
    data: {
      configId,
      provider,
      jobType,
      status: 'PENDING',
    },
  })

  return job
}

// ─── Start Job ──────────────────────────────────────────────────────────────

export async function startJob(jobId: string) {
  const job = await prisma.iTSyncJob.update({
    where: { id: jobId },
    data: {
      status: 'RUNNING',
      startedAt: new Date(),
    },
  })

  return job
}

// ─── Update Job Progress ────────────────────────────────────────────────────

export async function updateJobProgress(jobId: string, data: JobProgressData) {
  const incrementData: Record<string, { increment: number }> = {}

  if (data.recordsCreated) {
    incrementData.recordsCreated = { increment: data.recordsCreated }
  }
  if (data.recordsUpdated) {
    incrementData.recordsUpdated = { increment: data.recordsUpdated }
  }
  if (data.recordsSkipped) {
    incrementData.recordsSkipped = { increment: data.recordsSkipped }
  }

  const job = await prisma.iTSyncJob.update({
    where: { id: jobId },
    data: incrementData,
  })

  return job
}

// ─── Complete Job ───────────────────────────────────────────────────────────

export async function completeJob(jobId: string, stats: JobStats) {
  const job = await prisma.iTSyncJob.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      recordsCreated: stats.recordsCreated,
      recordsUpdated: stats.recordsUpdated,
      recordsSkipped: stats.recordsSkipped,
    },
  })

  return job
}

// ─── Fail Job ───────────────────────────────────────────────────────────────

export async function failJob(jobId: string, errors: string[]) {
  const job = await prisma.iTSyncJob.update({
    where: { id: jobId },
    data: {
      status: 'FAILED',
      completedAt: new Date(),
      errors: errors,
    },
  })

  return job
}

// ─── List Jobs ──────────────────────────────────────────────────────────────

export async function listJobs(filters?: ListJobsFilters) {
  const where: Record<string, unknown> = {}

  if (filters?.provider) where.provider = filters.provider
  if (filters?.jobType) where.jobType = filters.jobType
  if (filters?.status) where.status = filters.status
  if (filters?.configId) where.configId = filters.configId

  const [jobs, total] = await Promise.all([
    prisma.iTSyncJob.findMany({
      where,
      include: {
        config: {
          select: {
            id: true,
            provider: true,
            isEnabled: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    }),
    prisma.iTSyncJob.count({ where }),
  ])

  return { jobs, total }
}

// ─── Get Job ────────────────────────────────────────────────────────────────

export async function getJob(jobId: string) {
  const job = await prisma.iTSyncJob.findUnique({
    where: { id: jobId },
    include: {
      config: {
        select: {
          id: true,
          provider: true,
          isEnabled: true,
        },
      },
    },
  })

  return job
}
