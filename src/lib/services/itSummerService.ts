/**
 * IT Summer Operations Service
 *
 * Manages summer-mode workflows for device lifecycle:
 * - Summer mode activation / deactivation
 * - Reimaging batches (wipe + reimage devices)
 * - Staging batches (prepare devices for fall deployment)
 * - Repair queue management with vendor tracking
 * - Staging inventory counts
 */

import { z } from 'zod'
import { prisma } from '@/lib/db'

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

export const CreateSummerBatchSchema = z.object({
  name: z.string().min(1).max(200),
  batchType: z.enum(['REIMAGING', 'STAGING']),
  notes: z.string().optional(),
})

// ─── Summer Mode ──────────────────────────────────────────────────────────────

export async function activateSummerMode(startDate?: string, endDate?: string) {
  const config = await prisma.iTDeviceConfig.findFirst()
  if (!config) throw new Error('Device config not found')
  return prisma.iTDeviceConfig.update({
    where: { id: config.id },
    data: {
      summerModeActive: true,
      summerModeStartDate: startDate ? new Date(startDate) : new Date(),
      summerModeEndDate: endDate ? new Date(endDate) : null,
    },
  })
}

export async function deactivateSummerMode() {
  const config = await prisma.iTDeviceConfig.findFirst()
  if (!config) throw new Error('Device config not found')
  return prisma.iTDeviceConfig.update({
    where: { id: config.id },
    data: {
      summerModeActive: false,
      summerModeStartDate: null,
      summerModeEndDate: null,
    },
  })
}

export async function getSummerModeStatus() {
  const config = await prisma.iTDeviceConfig.findFirst()
  return {
    active: config?.summerModeActive ?? false,
    startDate: config?.summerModeStartDate,
    endDate: config?.summerModeEndDate,
  }
}

// ─── Summer Batches ───────────────────────────────────────────────────────────

export async function createSummerBatch(input: z.infer<typeof CreateSummerBatchSchema>, userId: string) {
  return (prisma.iTSummerBatch.create as Function)({
    data: { ...input, createdById: userId },
  })
}

export async function listSummerBatches(filters?: { batchType?: string; status?: string }) {
  const where: Record<string, unknown> = {}
  if (filters?.batchType) where.batchType = filters.batchType
  if (filters?.status) where.status = filters.status

  const batches = await prisma.iTSummerBatch.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { items: true } },
    },
  })

  const batchesWithProgress = await Promise.all(
    batches.map(async (batch) => {
      const completedCount = await prisma.iTSummerBatchItem.count({
        where: { batchId: batch.id, completed: true },
      })
      return {
        ...batch,
        totalItems: batch._count.items,
        completedItems: completedCount,
        remainingItems: batch._count.items - completedCount,
      }
    })
  )

  return batchesWithProgress
}

export async function getSummerBatchDetail(batchId: string) {
  const batch = await prisma.iTSummerBatch.findUnique({
    where: { id: batchId },
    include: {
      items: {
        include: {
          device: {
            select: { id: true, assetTag: true, serialNumber: true, deviceType: true, make: true, model: true, status: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!batch) throw new Error('Summer batch not found')
  return batch
}

// ─── Summer Batch Items ───────────────────────────────────────────────────────

export async function addDevicesToSummerBatch(batchId: string, deviceIds: string[]) {
  const batch = await prisma.iTSummerBatch.findUnique({ where: { id: batchId } })
  if (!batch) throw new Error('Batch not found')
  if (batch.status !== 'DRAFT' && batch.status !== 'IN_PROGRESS') throw new Error('Cannot add to completed/cancelled batch')

  return prisma.iTSummerBatchItem.createMany({
    data: deviceIds.map((deviceId) => ({
      batchId,
      deviceId,
      organizationId: '',
    })),
    skipDuplicates: true,
  })
}

export async function markItemCompleted(itemId: string, userId: string) {
  const item = await prisma.iTSummerBatchItem.findUnique({
    where: { id: itemId },
    include: { batch: true },
  })
  if (!item) throw new Error('Item not found')

  // If reimaging batch, update device lastReimageDate
  if (item.batch.batchType === 'REIMAGING') {
    await prisma.iTDevice.update({
      where: { id: item.deviceId },
      data: { lastReimageDate: new Date() },
    })
  }

  // If staging batch, mark device as staged
  if (item.batch.batchType === 'STAGING') {
    await prisma.iTDevice.update({
      where: { id: item.deviceId },
      data: { isStagedForDeployment: true, status: 'STAGED' },
    })
  }

  return prisma.iTSummerBatchItem.update({
    where: { id: itemId },
    data: { completed: true, completedAt: new Date(), completedById: userId },
  })
}

export async function bulkMarkCompleted(batchId: string, itemIds: string[], userId: string) {
  const results = await Promise.all(
    itemIds.map((id) => markItemCompleted(id, userId))
  )
  return results
}

// ─── Summer Batch Lifecycle ───────────────────────────────────────────────────

export async function startSummerBatch(batchId: string) {
  return prisma.iTSummerBatch.update({
    where: { id: batchId },
    data: { status: 'IN_PROGRESS', startedAt: new Date() },
  })
}

export async function completeSummerBatch(batchId: string) {
  return prisma.iTSummerBatch.update({
    where: { id: batchId },
    data: { status: 'COMPLETED', completedAt: new Date() },
  })
}

// ─── Staging Counts ───────────────────────────────────────────────────────────

export async function getStagingCounts() {
  const stagedDevices = await prisma.iTDevice.findMany({
    where: { isStagedForDeployment: true },
    select: { deviceType: true, make: true, model: true },
  })

  const countsByModel: Record<string, number> = {}
  for (const d of stagedDevices) {
    const key = `${d.make || 'Unknown'} ${d.model || d.deviceType}`
    countsByModel[key] = (countsByModel[key] || 0) + 1
  }

  return {
    total: stagedDevices.length,
    byModel: countsByModel,
  }
}

// ─── Repair Queue ─────────────────────────────────────────────────────────────

export async function getRepairQueue(filters?: { queueStatus?: string }) {
  const where: Record<string, unknown> = {}
  if (filters?.queueStatus) where.queueStatus = filters.queueStatus

  return prisma.iTDeviceRepair.findMany({
    where,
    include: {
      device: {
        select: { id: true, assetTag: true, serialNumber: true, deviceType: true, make: true, model: true },
      },
      vendorRepairLog: true,
    },
    orderBy: { repairDate: 'desc' },
  })
}

export async function updateRepairQueueStatus(repairId: string, newStatus: string) {
  return prisma.iTDeviceRepair.update({
    where: { id: repairId },
    data: {
      queueStatus: newStatus as any,
      queueUpdatedAt: new Date(),
    },
  })
}

// ─── Vendor Repair Logs ───────────────────────────────────────────────────────

export async function createVendorRepairLog(repairId: string, data: {
  vendorName: string
  sentDate?: string
  receivedDate?: string
  estimatedCost?: number
  actualCost?: number
  invoiceNumber?: string
  receiptUrl?: string
  notes?: string
}) {
  return prisma.iTVendorRepairLog.create({
    data: {
      repairId,
      vendorName: data.vendorName,
      sentDate: data.sentDate ? new Date(data.sentDate) : null,
      receivedDate: data.receivedDate ? new Date(data.receivedDate) : null,
      estimatedCost: data.estimatedCost,
      actualCost: data.actualCost,
      invoiceNumber: data.invoiceNumber,
      receiptUrl: data.receiptUrl,
      notes: data.notes,
      organizationId: '',
    },
  })
}

export async function updateVendorRepairLog(logId: string, data: Partial<{
  vendorName: string
  sentDate: string
  receivedDate: string
  estimatedCost: number
  actualCost: number
  invoiceNumber: string
  receiptUrl: string
  notes: string
}>) {
  const updateData: Record<string, unknown> = {}
  if (data.vendorName !== undefined) updateData.vendorName = data.vendorName
  if (data.sentDate !== undefined) updateData.sentDate = new Date(data.sentDate)
  if (data.receivedDate !== undefined) updateData.receivedDate = new Date(data.receivedDate)
  if (data.estimatedCost !== undefined) updateData.estimatedCost = data.estimatedCost
  if (data.actualCost !== undefined) updateData.actualCost = data.actualCost
  if (data.invoiceNumber !== undefined) updateData.invoiceNumber = data.invoiceNumber
  if (data.receiptUrl !== undefined) updateData.receiptUrl = data.receiptUrl
  if (data.notes !== undefined) updateData.notes = data.notes

  return prisma.iTVendorRepairLog.update({
    where: { id: logId },
    data: updateData,
  })
}
