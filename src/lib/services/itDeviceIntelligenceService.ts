import { z } from 'zod'
import { prisma, rawPrisma } from '@/lib/db'
import { claudeTextCompletion, extractJson, getClaudeClient } from '@/lib/services/ai/claude-client'

// ============= Validation Schemas =============

export const UpdateConfigSchema = z.object({
  lemonRepairCount: z.number().int().min(1).max(20).optional(),
  lemonPeriodMonths: z.number().int().min(1).max(24).optional(),
  replaceThresholdPct: z.number().min(0.1).max(1.0).optional(),
  defaultLoanDays: z.number().int().min(1).max(30).optional(),
  overdueGraceDays: z.number().int().min(0).max(7).optional(),
})

export type UpdateConfigInput = z.infer<typeof UpdateConfigSchema>

// ============= Config Defaults =============

const CONFIG_DEFAULTS = {
  lemonRepairCount: 3,
  lemonPeriodMonths: 6,
  replaceThresholdPct: 0.6,
  defaultLoanDays: 5,
  overdueGraceDays: 1,
}

// ============= Shared Includes =============

const deviceWithDetailsInclude = {
  school: { select: { id: true, name: true } },
  building: { select: { id: true, name: true } },
  repairs: {
    orderBy: { repairDate: 'desc' as const },
    select: {
      id: true,
      repairDate: true,
      repairCost: true,
      description: true,
      repairType: true,
      vendor: true,
    },
  },
}

// ============= Service Functions =============

// ------------- Configuration -------------

/**
 * Get or create the ITDeviceConfig for an organization.
 * Uses rawPrisma since ITDeviceConfig has a unique constraint on organizationId
 * and is NOT org-scoped by the Prisma extension.
 */
export async function getDeviceConfig(orgId: string) {
  let config = await rawPrisma.iTDeviceConfig.findUnique({
    where: { organizationId: orgId },
  })

  if (!config) {
    config = await rawPrisma.iTDeviceConfig.create({
      data: {
        organizationId: orgId,
        ...CONFIG_DEFAULTS,
      },
    })
  }

  return config
}

/**
 * Update (upsert) the ITDeviceConfig for an organization.
 * Uses rawPrisma since this model is not org-scoped.
 */
export async function updateDeviceConfig(orgId: string, data: UpdateConfigInput) {
  const validated = UpdateConfigSchema.parse(data)

  const config = await rawPrisma.iTDeviceConfig.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      ...CONFIG_DEFAULTS,
      ...validated,
    },
    update: validated,
  })

  return config
}

// ------------- Lemon Detection -------------

/**
 * Detect "lemon" devices: devices that have had >= N repairs within the last M months.
 * Sets isLemon=true and lemonFlaggedAt=now for newly flagged devices.
 * Uses rawPrisma for cross-model aggregation queries.
 * Returns the count of newly flagged devices.
 */
export async function detectLemons(orgId: string): Promise<number> {
  const config = await getDeviceConfig(orgId)
  const { lemonRepairCount, lemonPeriodMonths } = config

  // Calculate the lookback date
  const lookbackDate = new Date()
  lookbackDate.setMonth(lookbackDate.getMonth() - lemonPeriodMonths)

  // Find devices with >= N repairs in the period
  // Group repairs by deviceId and count
  const repairCounts = await rawPrisma.iTDeviceRepair.groupBy({
    by: ['deviceId'],
    where: {
      organizationId: orgId,
      repairDate: { gte: lookbackDate },
    },
    _count: { id: true },
    having: {
      id: { _count: { gte: lemonRepairCount } },
    },
  })

  const lemonDeviceIds = repairCounts.map((r: any) => r.deviceId)

  if (lemonDeviceIds.length === 0) {
    return 0
  }

  // Only flag devices that are not already flagged
  const result = await rawPrisma.iTDevice.updateMany({
    where: {
      id: { in: lemonDeviceIds },
      organizationId: orgId,
      isLemon: false,
      deletedAt: null,
    },
    data: {
      isLemon: true,
      lemonFlaggedAt: new Date(),
    },
  })

  return result.count
}

/**
 * List all devices flagged as lemons.
 * Includes school, current assignment (student name), and repair count.
 */
export async function getLemonDevices() {
  const devices = await (prisma.iTDevice.findMany as Function)({
    where: { isLemon: true },
    include: {
      school: { select: { id: true, name: true } },
      building: { select: { id: true, name: true } },
      assignments: {
        where: { returnedAt: null },
        take: 1,
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, grade: true },
          },
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      },
      _count: {
        select: { repairs: true },
      },
    },
    orderBy: { lemonFlaggedAt: 'desc' },
  })

  return devices
}

// ------------- Repair vs Replace Analysis -------------

/**
 * Calculate whether to repair or replace a device based on cumulative repair costs
 * relative to the original purchase price.
 */
export async function calculateRepairVsReplace(deviceId: string) {
  const device = await (prisma.iTDevice.findUnique as Function)({
    where: { id: deviceId },
    include: {
      repairs: {
        select: { repairCost: true },
      },
    },
  })

  if (!device) {
    throw new Error('Device not found')
  }

  const purchasePrice = device.purchasePrice || 0
  const totalRepairCost = device.repairs.reduce(
    (sum: number, r: any) => sum + (r.repairCost || 0),
    0
  )

  // Get the org config for the threshold
  const config = await rawPrisma.iTDeviceConfig.findUnique({
    where: { organizationId: device.organizationId },
  })
  const threshold = config?.replaceThresholdPct ?? CONFIG_DEFAULTS.replaceThresholdPct

  const ratio = purchasePrice > 0 ? totalRepairCost / purchasePrice : 0
  const recommendation: 'repair' | 'replace' =
    purchasePrice > 0 && totalRepairCost >= purchasePrice * threshold
      ? 'replace'
      : 'repair'

  return {
    deviceId,
    assetTag: device.assetTag,
    purchasePrice,
    totalRepairCost,
    threshold,
    recommendation,
    ratio: Math.round(ratio * 100) / 100,
  }
}

// ------------- AI Recommendations -------------

/**
 * Get an AI-powered recommendation for a device (repair, replace, or keep).
 * Falls back to a simple rule-based recommendation if ANTHROPIC_API_KEY is not set.
 * Stores the result in the device's aiRecommendation field.
 */
export async function getAIRecommendation(deviceId: string, orgId: string) {
  // Gather device data
  const device = await (prisma.iTDevice.findUnique as Function)({
    where: { id: deviceId },
    include: {
      ...deviceWithDetailsInclude,
      assignments: {
        where: { returnedAt: null },
        take: 1,
        include: {
          student: { select: { firstName: true, lastName: true, grade: true } },
        },
      },
    },
  })

  if (!device) {
    throw new Error('Device not found')
  }

  const purchasePrice = device.purchasePrice || 0
  const totalRepairCost = device.repairs.reduce(
    (sum: number, r: any) => sum + (r.repairCost || 0),
    0
  )
  const repairCount = device.repairs.length
  const ageMonths = device.purchaseDate
    ? Math.floor(
        (Date.now() - new Date(device.purchaseDate).getTime()) /
          (1000 * 60 * 60 * 24 * 30)
      )
    : null

  const hasAI = !!getClaudeClient()

  let recommendation: {
    action: 'repair' | 'replace' | 'monitor'
    reasoning: string
    confidence: number
  }

  if (hasAI) {
    // Use Claude AI for recommendation
    recommendation = await getClaudeRecommendation({
      assetTag: device.assetTag,
      deviceType: device.deviceType,
      make: device.make,
      model: device.model,
      purchasePrice,
      totalRepairCost,
      repairCount,
      ageMonths,
      isLemon: device.isLemon,
      repairHistory: device.repairs.map((r: any) => ({
        date: r.repairDate,
        cost: r.repairCost,
        type: r.repairType,
        description: r.description,
      })),
    })
  } else {
    // Rule-based fallback
    recommendation = getRuleBasedRecommendation({
      purchasePrice,
      totalRepairCost,
      repairCount,
      ageMonths,
      isLemon: device.isLemon,
    })
  }

  // Store the recommendation on the device
  await (prisma.iTDevice.update as Function)({
    where: { id: deviceId },
    data: {
      aiRecommendation: recommendation,
      aiRecommendationAt: new Date(),
    },
  })

  return {
    deviceId,
    assetTag: device.assetTag,
    ...recommendation,
    generatedAt: new Date().toISOString(),
    source: hasAI ? 'claude' : 'rule-based',
  }
}

/**
 * Call Claude API for a device recommendation.
 */
async function getClaudeRecommendation(
  deviceData: {
    assetTag: string
    deviceType: string
    make: string | null
    model: string | null
    purchasePrice: number
    totalRepairCost: number
    repairCount: number
    ageMonths: number | null
    isLemon: boolean
    repairHistory: Array<{
      date: Date
      cost: number
      type: string | null
      description: string | null
    }>
  }
): Promise<{ action: 'repair' | 'replace' | 'monitor'; reasoning: string; confidence: number }> {
  const prompt = `You are an IT asset management advisor for a school. Analyze this device and recommend whether to REPAIR, REPLACE, or MONITOR it.

Device: ${deviceData.make || 'Unknown'} ${deviceData.model || deviceData.deviceType} (Asset: ${deviceData.assetTag})
Purchase Price: $${deviceData.purchasePrice.toFixed(2)}
Total Repair Costs: $${deviceData.totalRepairCost.toFixed(2)} (${deviceData.repairCount} repairs)
Age: ${deviceData.ageMonths !== null ? `${deviceData.ageMonths} months` : 'Unknown'}
Lemon Flagged: ${deviceData.isLemon ? 'Yes' : 'No'}
Cost Ratio: ${deviceData.purchasePrice > 0 ? ((deviceData.totalRepairCost / deviceData.purchasePrice) * 100).toFixed(0) : 'N/A'}%

Recent Repair History:
${deviceData.repairHistory
  .slice(0, 5)
  .map((r) => `- ${new Date(r.date).toLocaleDateString()}: ${r.type || 'General'} ($${r.cost.toFixed(2)}) - ${r.description || 'No description'}`)
  .join('\n') || 'No repairs on record'}

Return ONLY valid JSON:
{
  "action": "repair" | "replace" | "monitor",
  "reasoning": "2-3 sentence explanation",
  "confidence": 0.0 to 1.0
}`

  try {
    const result = await claudeTextCompletion(prompt)
    if (result) {
      const parsed = extractJson<{ action?: string; reasoning?: string; confidence?: number }>(result)
      if (parsed) {
        return {
          action: ['repair', 'replace', 'monitor'].includes(parsed.action || '')
            ? (parsed.action as 'repair' | 'replace' | 'monitor')
            : 'monitor',
          reasoning: String(parsed.reasoning || 'AI analysis complete.'),
          confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
        }
      }
    }
  } catch (err) {
    console.error('[itDeviceIntelligence] Claude API error:', err)
  }

  // Fallback if Claude fails to return valid JSON
  return getRuleBasedRecommendation({
    purchasePrice: deviceData.purchasePrice,
    totalRepairCost: deviceData.totalRepairCost,
    repairCount: deviceData.repairCount,
    ageMonths: deviceData.ageMonths,
    isLemon: deviceData.isLemon,
  })
}

/**
 * Simple rule-based recommendation when Gemini is unavailable.
 */
function getRuleBasedRecommendation(data: {
  purchasePrice: number
  totalRepairCost: number
  repairCount: number
  ageMonths: number | null
  isLemon: boolean
}): { action: 'repair' | 'replace' | 'monitor'; reasoning: string; confidence: number } {
  const { purchasePrice, totalRepairCost, repairCount, ageMonths, isLemon } = data
  const costRatio = purchasePrice > 0 ? totalRepairCost / purchasePrice : 0

  // Replace: lemon device with high repair costs
  if (isLemon && costRatio >= 0.6) {
    return {
      action: 'replace',
      reasoning: `Device is flagged as a lemon with ${repairCount} repairs. Total repair costs ($${totalRepairCost.toFixed(2)}) have reached ${(costRatio * 100).toFixed(0)}% of the purchase price ($${purchasePrice.toFixed(2)}). Replacement is recommended.`,
      confidence: 0.85,
    }
  }

  // Replace: repair costs exceed purchase price
  if (costRatio >= 1.0) {
    return {
      action: 'replace',
      reasoning: `Total repair costs ($${totalRepairCost.toFixed(2)}) have exceeded the original purchase price ($${purchasePrice.toFixed(2)}). Continued repair is not cost-effective.`,
      confidence: 0.9,
    }
  }

  // Replace: old device with rising costs
  if (ageMonths !== null && ageMonths > 48 && costRatio >= 0.5) {
    return {
      action: 'replace',
      reasoning: `Device is ${Math.floor(ageMonths / 12)} years old with repair costs at ${(costRatio * 100).toFixed(0)}% of purchase price. Age and accumulating costs suggest replacement.`,
      confidence: 0.75,
    }
  }

  // Monitor: lemon flagged but costs still manageable
  if (isLemon) {
    return {
      action: 'monitor',
      reasoning: `Device is flagged as a lemon with ${repairCount} repairs, but repair costs are still at ${(costRatio * 100).toFixed(0)}% of purchase price. Monitor closely for further issues.`,
      confidence: 0.7,
    }
  }

  // Monitor: moderate repair history
  if (repairCount >= 2 || costRatio >= 0.3) {
    return {
      action: 'monitor',
      reasoning: `Device has had ${repairCount} repair(s) with costs at ${(costRatio * 100).toFixed(0)}% of purchase price. No immediate action needed but worth monitoring.`,
      confidence: 0.65,
    }
  }

  // Repair: low risk, continue using
  return {
    action: 'repair',
    reasoning: `Device is in acceptable condition with ${repairCount} repair(s) and costs at ${(costRatio * 100).toFixed(0)}% of purchase price. Continue normal maintenance.`,
    confidence: 0.8,
  }
}

// ------------- Aggregated Recommendations -------------

/**
 * Get devices that need attention: flagged as lemon OR repair costs > 50% of purchase price.
 * Returns devices with repair summary for the recommendations dashboard.
 */
export async function getRecommendations() {
  // Get all devices with their repair totals
  const devices = await (prisma.iTDevice.findMany as Function)({
    where: {
      OR: [
        { isLemon: true },
        // We filter by cost ratio in application code since Prisma
        // cannot do computed-field filtering in where clauses
      ],
    },
    include: {
      school: { select: { id: true, name: true } },
      building: { select: { id: true, name: true } },
      repairs: {
        select: { repairCost: true, repairDate: true, repairType: true },
      },
      assignments: {
        where: { returnedAt: null },
        take: 1,
        include: {
          student: { select: { id: true, firstName: true, lastName: true, grade: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: [{ isLemon: 'desc' }, { lemonFlaggedAt: 'desc' }],
  })

  // Also query non-lemon devices that might have high repair costs
  const allDevicesWithRepairs = await (prisma.iTDevice.findMany as Function)({
    where: {
      isLemon: false,
      repairs: { some: {} }, // has at least one repair
    },
    include: {
      school: { select: { id: true, name: true } },
      building: { select: { id: true, name: true } },
      repairs: {
        select: { repairCost: true, repairDate: true, repairType: true },
      },
      assignments: {
        where: { returnedAt: null },
        take: 1,
        include: {
          student: { select: { id: true, firstName: true, lastName: true, grade: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  })

  // Filter non-lemon devices where repair cost > 50% of purchase price
  const highCostDevices = allDevicesWithRepairs.filter((d: any) => {
    if (!d.purchasePrice || d.purchasePrice <= 0) return false
    const totalCost = d.repairs.reduce(
      (sum: number, r: any) => sum + (r.repairCost || 0),
      0
    )
    return totalCost / d.purchasePrice > 0.5
  })

  // Merge and deduplicate
  const deviceMap = new Map<string, any>()
  for (const d of devices) {
    deviceMap.set(d.id, d)
  }
  for (const d of highCostDevices) {
    if (!deviceMap.has(d.id)) {
      deviceMap.set(d.id, d)
    }
  }

  // Enrich with repair summary
  const results = Array.from(deviceMap.values()).map((d: any) => {
    const totalRepairCost = d.repairs.reduce(
      (sum: number, r: any) => sum + (r.repairCost || 0),
      0
    )
    const costRatio =
      d.purchasePrice && d.purchasePrice > 0
        ? Math.round((totalRepairCost / d.purchasePrice) * 100) / 100
        : null

    return {
      ...d,
      repairSummary: {
        totalRepairCost,
        repairCount: d.repairs.length,
        costRatio,
        lastRepairDate: d.repairs[0]?.repairDate || null,
      },
    }
  })

  // Sort: replace candidates first (high cost ratio), then lemons, then rest
  results.sort((a: any, b: any) => {
    const aScore = (a.isLemon ? 100 : 0) + (a.repairSummary.costRatio || 0) * 100
    const bScore = (b.isLemon ? 100 : 0) + (b.repairSummary.costRatio || 0) * 100
    return bScore - aScore
  })

  return results
}
