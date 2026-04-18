/**
 * IT Damage Assessment Service
 *
 * Handles damage reporting and fee tracking during device collection:
 * - Damage summary aggregation by condition
 * - CSV export for damage reports
 * - Default fee configuration per condition level
 */

import { prisma } from '@/lib/db'

// ─── Get Damage Summary ──────────────────────────────────────────────────────

export async function getDamageSummary(batchId: string) {
  const items = await prisma.iTDeploymentBatchItem.findMany({
    where: { batchId, processed: true, condition: { not: null } },
    include: {
      device: { select: { id: true, assetTag: true } },
      student: { select: { id: true, firstName: true, lastName: true, studentId: true } },
    },
  })

  const byCondition = { EXCELLENT: 0, GOOD: 0, FAIR: 0, POOR: 0, BROKEN: 0 }
  let totalFees = 0

  for (const item of items) {
    if (item.condition) {
      byCondition[item.condition as keyof typeof byCondition]++
    }
    totalFees += item.damageFee || 0
  }

  return {
    totalDevices: items.length,
    byCondition,
    totalFees,
    items,
  }
}

// ─── Export Damage Report (CSV) ───────────────────────────────────────────────

export async function exportDamageReport(batchId: string) {
  const items = await prisma.iTDeploymentBatchItem.findMany({
    where: { batchId, processed: true },
    include: {
      device: { select: { assetTag: true, serialNumber: true, make: true, model: true } },
      student: { select: { firstName: true, lastName: true, studentId: true, grade: true } },
    },
    orderBy: { processedAt: 'asc' },
  })

  // Build CSV
  const headers = ['Asset Tag', 'Serial Number', 'Make', 'Model', 'Student Name', 'Student ID', 'Grade', 'Condition', 'Damage Notes', 'Fee']
  const rows = items.map((item) => [
    item.device.assetTag,
    item.device.serialNumber || '',
    item.device.make || '',
    item.device.model || '',
    item.student ? `${item.student.firstName} ${item.student.lastName}` : '',
    item.student?.studentId || '',
    item.student?.grade || '',
    item.condition || '',
    item.damageNotes || '',
    item.damageFee?.toString() || '0',
  ])

  const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n')
  return csv
}

// ─── Get Default Fees ─────────────────────────────────────────────────────────

export async function getDefaultFees() {
  const config = await prisma.iTDeviceConfig.findFirst()
  return config?.defaultDamageFees || { EXCELLENT: 0, GOOD: 0, FAIR: 25, POOR: 50, BROKEN: 100 }
}

// ─── Update Default Fees ──────────────────────────────────────────────────────

export async function updateDefaultFees(fees: Record<string, number>) {
  const config = await prisma.iTDeviceConfig.findFirst()
  if (!config) throw new Error('Device config not found')
  return prisma.iTDeviceConfig.update({
    where: { id: config.id },
    data: { defaultDamageFees: fees },
  })
}
