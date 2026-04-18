/**
 * IT Deployment & Collection Batch Service
 *
 * Manages batch deployment (device-to-student) and batch collection
 * (device return + condition assessment) workflows:
 * - Create / list / get batch detail
 * - Add devices to a batch (manual or auto-populate)
 * - Process individual deployment and collection items
 * - Start / complete / cancel batches
 * - Progress tracking
 */

import { z } from 'zod'
import { prisma } from '@/lib/db'

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

export const CreateBatchSchema = z.object({
  name: z.string().min(1).max(200),
  batchType: z.enum(['DEPLOYMENT', 'COLLECTION']),
  schoolId: z.string().optional(),
  grade: z.string().optional(),
  schoolYear: z.string().optional(),
  notes: z.string().optional(),
})

export const ProcessDeploymentItemSchema = z.object({
  studentId: z.string(),
  aupAcknowledged: z.boolean().default(false),
  aupSignature: z.string().optional(),
})

export const ProcessCollectionItemSchema = z.object({
  condition: z.enum(['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'BROKEN']),
  damageNotes: z.string().optional(),
  damagePhotos: z.array(z.string()).default([]),
  damageFee: z.number().min(0).optional(),
})

// ─── Create Batch ─────────────────────────────────────────────────────────────

export async function createBatch(input: z.infer<typeof CreateBatchSchema>, userId: string) {
  return (prisma.iTDeploymentBatch.create as Function)({
    data: { ...input, createdById: userId },
  })
}

// ─── List Batches ─────────────────────────────────────────────────────────────

export async function listBatches(filters?: { batchType?: string; status?: string; schoolId?: string }) {
  const where: Record<string, unknown> = {}
  if (filters?.batchType) where.batchType = filters.batchType
  if (filters?.status) where.status = filters.status
  if (filters?.schoolId) where.schoolId = filters.schoolId

  const batches = await prisma.iTDeploymentBatch.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      school: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
  })

  // Add progress counts
  const batchesWithProgress = await Promise.all(
    batches.map(async (batch) => {
      const processedCount = await prisma.iTDeploymentBatchItem.count({
        where: { batchId: batch.id, processed: true },
      })
      return {
        ...batch,
        totalItems: batch._count.items,
        processedItems: processedCount,
        remainingItems: batch._count.items - processedCount,
      }
    })
  )

  return batchesWithProgress
}

// ─── Get Batch Detail ─────────────────────────────────────────────────────────

export async function getBatchDetail(batchId: string) {
  const batch = await prisma.iTDeploymentBatch.findUnique({
    where: { id: batchId },
    include: {
      school: { select: { id: true, name: true } },
      items: {
        include: {
          device: {
            select: { id: true, assetTag: true, serialNumber: true, deviceType: true, make: true, model: true, status: true },
          },
          student: {
            select: { id: true, firstName: true, lastName: true, studentId: true, grade: true, email: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!batch) throw new Error('Batch not found')
  return batch
}

// ─── Add Devices to Batch ─────────────────────────────────────────────────────

export async function addDevicesToBatch(batchId: string, deviceIds: string[]) {
  // Verify batch exists and is in DRAFT status
  const batch = await prisma.iTDeploymentBatch.findUnique({ where: { id: batchId } })
  if (!batch) throw new Error('Batch not found')
  if (batch.status !== 'DRAFT') throw new Error('Can only add devices to DRAFT batches')

  const items = await prisma.iTDeploymentBatchItem.createMany({
    data: deviceIds.map((deviceId) => ({
      batchId,
      deviceId,
      organizationId: '', // auto-injected by org-scoped prisma
    })),
    skipDuplicates: true,
  })
  return items
}

// ─── Auto-Populate Batch ──────────────────────────────────────────────────────

export async function autoPopulateBatch(batchId: string, filters: { schoolId?: string; grade?: string; deviceType?: string }) {
  const batch = await prisma.iTDeploymentBatch.findUnique({ where: { id: batchId } })
  if (!batch) throw new Error('Batch not found')
  if (batch.status !== 'DRAFT') throw new Error('Can only auto-populate DRAFT batches')

  const deviceWhere: Record<string, unknown> = { status: 'ACTIVE', deletedAt: null }
  if (filters.schoolId) deviceWhere.schoolId = filters.schoolId
  if (filters.deviceType) deviceWhere.deviceType = filters.deviceType

  const devices = await prisma.iTDevice.findMany({
    where: deviceWhere,
    select: { id: true },
  })

  if (devices.length === 0) return { added: 0 }

  const result = await prisma.iTDeploymentBatchItem.createMany({
    data: devices.map((d) => ({
      batchId,
      deviceId: d.id,
      organizationId: '',
    })),
    skipDuplicates: true,
  })

  return { added: result.count }
}

// ─── Start Batch ──────────────────────────────────────────────────────────────

export async function startBatch(batchId: string) {
  return prisma.iTDeploymentBatch.update({
    where: { id: batchId },
    data: { status: 'IN_PROGRESS', startedAt: new Date() },
  })
}

// ─── Process Deployment Item ──────────────────────────────────────────────────

export async function processDeploymentItem(itemId: string, input: z.infer<typeof ProcessDeploymentItemSchema>, userId: string) {
  const item = await prisma.iTDeploymentBatchItem.findUnique({
    where: { id: itemId },
    include: { batch: true },
  })
  if (!item) throw new Error('Item not found')
  if (item.batch.status !== 'IN_PROGRESS') throw new Error('Batch is not in progress')

  // Assign device to student
  await prisma.iTDeviceAssignment.create({
    data: {
      deviceId: item.deviceId,
      studentId: input.studentId,
      assignedById: userId,
      organizationId: '',
    },
  })

  // Update device status
  await prisma.iTDevice.update({
    where: { id: item.deviceId },
    data: { status: 'ACTIVE', isStagedForDeployment: false },
  })

  return prisma.iTDeploymentBatchItem.update({
    where: { id: itemId },
    data: {
      studentId: input.studentId,
      processed: true,
      processedAt: new Date(),
      processedById: userId,
      aupAcknowledged: input.aupAcknowledged,
      aupAcknowledgedAt: input.aupAcknowledged ? new Date() : null,
      aupSignature: input.aupSignature,
    },
  })
}

// ─── Process Collection Item ──────────────────────────────────────────────────

export async function processCollectionItem(itemId: string, input: z.infer<typeof ProcessCollectionItemSchema>, userId: string) {
  const item = await prisma.iTDeploymentBatchItem.findUnique({
    where: { id: itemId },
    include: { batch: true, device: { include: { assignments: { where: { returnedAt: null } } } } },
  })
  if (!item) throw new Error('Item not found')
  if (item.batch.status !== 'IN_PROGRESS') throw new Error('Batch is not in progress')

  // Return any active assignment
  const activeAssignment = item.device.assignments.find((a: any) => !a.returnedAt)
  if (activeAssignment) {
    await prisma.iTDeviceAssignment.update({
      where: { id: activeAssignment.id },
      data: { returnedAt: new Date() },
    })
  }

  // Update device status based on condition
  const newStatus = input.condition === 'BROKEN' ? 'REPAIR' : 'ACTIVE'
  await prisma.iTDevice.update({
    where: { id: item.deviceId },
    data: { status: newStatus },
  })

  // If broken, create a repair record
  if (input.condition === 'BROKEN') {
    await prisma.iTDeviceRepair.create({
      data: {
        deviceId: item.deviceId,
        description: input.damageNotes || 'Damage found during collection',
        queueStatus: 'PENDING',
        organizationId: '',
      },
    })
  }

  return prisma.iTDeploymentBatchItem.update({
    where: { id: itemId },
    data: {
      processed: true,
      processedAt: new Date(),
      processedById: userId,
      condition: input.condition,
      damageNotes: input.damageNotes,
      damagePhotos: input.damagePhotos,
      damageFee: input.damageFee,
    },
  })
}

// ─── Complete Batch ───────────────────────────────────────────────────────────

export async function completeBatch(batchId: string) {
  const batch = await prisma.iTDeploymentBatch.findUnique({
    where: { id: batchId },
    include: { _count: { select: { items: true } } },
  })
  if (!batch) throw new Error('Batch not found')
  if (batch.status !== 'IN_PROGRESS') throw new Error('Batch is not in progress')

  return prisma.iTDeploymentBatch.update({
    where: { id: batchId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  })
}

// ─── Cancel Batch ─────────────────────────────────────────────────────────────

export async function cancelBatch(batchId: string) {
  return prisma.iTDeploymentBatch.update({
    where: { id: batchId },
    data: { status: 'CANCELLED' },
  })
}

// ─── Get Batch Progress ───────────────────────────────────────────────────────

export async function getBatchProgress(batchId: string) {
  const total = await prisma.iTDeploymentBatchItem.count({ where: { batchId } })
  const processed = await prisma.iTDeploymentBatchItem.count({ where: { batchId, processed: true } })
  return { total, processed, remaining: total - processed }
}
