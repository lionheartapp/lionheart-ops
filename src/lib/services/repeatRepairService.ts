/**
 * Repeat Repair Detection Service
 *
 * Identifies three asset alert conditions:
 * 1. REPAIR-01 — Repeat repairs: 3+ completed tickets in the last 12 months
 * 2. REPAIR-02 — Cost threshold: cumulative repair cost exceeds repairThresholdPct * replacementCost
 * 3. REPAIR-03 — End of life: asset age >= expectedLifespanYears
 *
 * For each trigger:
 * - Sends email alert to Head of Maintenance recipients
 * - Creates in-app notifications for recipients
 * - Stores idempotency timestamp on asset (no duplicate alerts within 30 days)
 *
 * For cost threshold: also generates AI replace-vs-repair recommendation via Anthropic.
 */

import Anthropic from '@anthropic-ai/sdk'
import { rawPrisma } from '@/lib/db'
import { createNotification } from '@/lib/services/notificationService'
import {
  sendRepeatRepairAlertEmail,
  sendCostThresholdAlertEmail,
  sendEndOfLifeAlertEmail,
} from '@/lib/services/emailService'

// ─── Types ────────────────────────────────────────────────────────────────────

type Recipient = {
  id: string
  email: string
  firstName: string
  lastName: string
}

type AiRecommendation = {
  recommendation: string
  decision: 'REPLACE' | 'REPAIR' | 'UNKNOWN'
  urgency: 'LOW' | 'MEDIUM' | 'HIGH'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_PLATFORM_URL || 'https://app.lionheartapp.com'
}

function assetLink(assetId: string): string {
  return `${getAppUrl()}/maintenance/assets/${assetId}`
}

/**
 * Find Head of Maintenance recipients for an org.
 * Uses the maintenance:analytics:view permission as the target audience.
 */
async function getMaintenanceAnalyticsRecipients(orgId: string): Promise<Recipient[]> {
  const users = await rawPrisma.user.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      userRole: {
        permissions: {
          some: {
            permission: {
              OR: [
                { resource: '*', action: '*' },               // super-admin wildcard
                { resource: 'maintenance', action: 'analytics', scope: 'view' },
                { resource: 'maintenance', action: '*' },      // maintenance-head wildcard
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

// ─── AI Recommendation ────────────────────────────────────────────────────────

/**
 * Generate a replace-vs-repair recommendation using Anthropic Claude.
 * Returns a fallback object if ANTHROPIC_API_KEY is not configured or if the call fails.
 */
export async function generateReplaceVsRepairRecommendation(
  asset: {
    name: string
    make: string | null
    model: string | null
    category: string | null
    purchaseDate: Date | null
    expectedLifespanYears: number | null
    replacementCost: number | null
    repairThresholdPct: number
  },
  cumulativeRepairCost: number
): Promise<AiRecommendation> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim()

  if (!apiKey) {
    return {
      recommendation: 'AI recommendation unavailable — ANTHROPIC_API_KEY not configured',
      decision: 'UNKNOWN',
      urgency: 'MEDIUM',
    }
  }

  const pct = asset.replacementCost
    ? Math.round((cumulativeRepairCost / asset.replacementCost) * 100)
    : 0

  const prompt = `You are a facilities management expert. Analyze this asset and provide a replace-vs-repair recommendation.

Asset: ${asset.name} (${asset.make ?? 'Unknown make'} ${asset.model ?? 'Unknown model'})
Category: ${asset.category ?? 'Not specified'}
Purchase Date: ${asset.purchaseDate ? asset.purchaseDate.toISOString().split('T')[0] : 'Unknown'}
Expected Lifespan: ${asset.expectedLifespanYears ?? 'Not specified'} years
Replacement Cost: $${asset.replacementCost?.toFixed(2) ?? 'Unknown'}
Cumulative Repair Cost: $${cumulativeRepairCost.toFixed(2)} (${pct}% of replacement cost)
Repair Threshold: ${Math.round(asset.repairThresholdPct * 100)}%

Provide a concise recommendation (2-3 sentences) covering:
1. Whether to repair or replace
2. Key financial reasoning
3. Suggested timeline for action

Respond with JSON: { "recommendation": "...", "decision": "REPLACE" | "REPAIR", "urgency": "LOW" | "MEDIUM" | "HIGH" }`

  try {
    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Extract JSON from the response (may be wrapped in markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return {
        recommendation: text || 'Failed to parse recommendation',
        decision: 'UNKNOWN',
        urgency: 'MEDIUM',
      }
    }

    const parsed = JSON.parse(jsonMatch[0]) as AiRecommendation
    return {
      recommendation: parsed.recommendation || 'No recommendation generated',
      decision: ['REPLACE', 'REPAIR'].includes(parsed.decision) ? parsed.decision : 'UNKNOWN',
      urgency: ['LOW', 'MEDIUM', 'HIGH'].includes(parsed.urgency) ? parsed.urgency : 'MEDIUM',
    }
  } catch (err) {
    console.error('[repeatRepairService] AI recommendation failed:', err)
    return {
      recommendation: 'Failed to generate recommendation — please review asset manually',
      decision: 'UNKNOWN',
      urgency: 'MEDIUM',
    }
  }
}

// ─── Detection Functions ──────────────────────────────────────────────────────

/**
 * Detect end-of-life for a single asset.
 * Exported for direct use in unit tests or one-off checks.
 */
export function detectEndOfLife(asset: {
  purchaseDate: Date | null
  expectedLifespanYears: number | null
}): boolean {
  if (!asset.purchaseDate || !asset.expectedLifespanYears) return false
  const ageYears = (Date.now() - new Date(asset.purchaseDate).getTime()) / (365.25 * 24 * 3600 * 1000)
  return ageYears >= asset.expectedLifespanYears
}

/**
 * Run all three detection checks across every active, non-decommissioned asset for an org.
 * Idempotent: alerts are only re-sent after 30 days from the last alert.
 *
 * @returns Counts of alerts triggered per category
 */
export async function runRepeatRepairDetection(orgId: string): Promise<{
  repeatRepair: number
  costThreshold: number
  endOfLife: number
}> {
  const now = new Date()
  const twelveMonthsAgo = new Date(now)
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const counters = { repeatRepair: 0, costThreshold: 0, endOfLife: 0 }

  // Step A — Load all active assets with ticket history + costs
  const assets = await rawPrisma.maintenanceAsset.findMany({
    where: {
      organizationId: orgId,
      deletedAt: null,
      status: { not: 'DECOMMISSIONED' },
    },
    include: {
      tickets: {
        where: { deletedAt: null, status: 'DONE' },
        include: {
          costEntries: { select: { amount: true } },
          laborEntries: {
            select: {
              durationMinutes: true,
              technician: {
                select: {
                  technicianProfile: { select: { loadedHourlyRate: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  if (assets.length === 0) return counters

  // Step B — Find Head of Maintenance recipients
  const recipients = await getMaintenanceAnalyticsRecipients(orgId)
  if (recipients.length === 0) {
    console.log(`[repeatRepairService] No analytics recipients found for org ${orgId} — skipping detection`)
    return counters
  }

  // Step C — Process each asset
  for (const asset of assets) {
    const assetUrl = assetLink(asset.id)

    // ── Compute cumulative repair cost ────────────────────────────────────────
    let cumulativeRepairCost = 0
    for (const ticket of asset.tickets) {
      for (const entry of ticket.costEntries) {
        cumulativeRepairCost += entry.amount
      }
      for (const labor of ticket.laborEntries) {
        if (labor.durationMinutes && labor.technician?.technicianProfile?.loadedHourlyRate) {
          cumulativeRepairCost += (labor.durationMinutes / 60) * labor.technician.technicianProfile.loadedHourlyRate
        }
      }
    }

    // ── REPAIR-01: Repeat Repair Detection ───────────────────────────────────
    const repairsInYear = asset.tickets.filter(
      (t) => new Date(t.updatedAt) >= twelveMonthsAgo
    )

    if (repairsInYear.length >= 3) {
      const alreadySent = asset.repeatAlertSentAt && new Date(asset.repeatAlertSentAt) >= thirtyDaysAgo
      if (!alreadySent) {
        // Send email alerts (fire-and-forget)
        for (const recipient of recipients) {
          sendRepeatRepairAlertEmail({
            to: recipient.email,
            assetName: asset.name,
            assetNumber: asset.assetNumber,
            repairCount: repairsInYear.length,
            assetUrl,
          }).catch((err) =>
            console.error(`[repeatRepairService] Repeat repair email failed for ${recipient.email}:`, err)
          )
        }

        // Create in-app notifications
        for (const recipient of recipients) {
          createNotification({
            userId: recipient.id,
            title: `Repeat Repair: ${asset.name}`,
            body: `Asset ${asset.assetNumber} has had ${repairsInYear.length} repairs in the last 12 months.`,
            type: 'maintenance_repeat_repair',
            linkUrl: assetUrl,
          }).catch((err) =>
            console.error(`[repeatRepairService] Repeat repair notification failed for ${recipient.id}:`, err)
          )
        }

        // Update idempotency timestamp
        await rawPrisma.maintenanceAsset.update({
          where: { id: asset.id },
          data: { repeatAlertSentAt: now },
        })

        counters.repeatRepair++
      }
    }

    // ── REPAIR-02: Cost Threshold Detection ───────────────────────────────────
    if (
      asset.replacementCost != null &&
      cumulativeRepairCost >= asset.repairThresholdPct * asset.replacementCost
    ) {
      const alreadySent = asset.costAlertSentAt && new Date(asset.costAlertSentAt) >= thirtyDaysAgo
      if (!alreadySent) {
        // Check if AI recommendation is already fresh
        let recommendation: AiRecommendation
        const aiIsFresh = asset.aiRecommendationAt && new Date(asset.aiRecommendationAt) >= thirtyDaysAgo

        if (aiIsFresh && asset.aiRecommendation) {
          recommendation = asset.aiRecommendation as AiRecommendation
        } else {
          recommendation = await generateReplaceVsRepairRecommendation(asset, cumulativeRepairCost)
        }

        const pct = Math.round((cumulativeRepairCost / asset.replacementCost) * 100)
        const recommendationText = recommendation.recommendation

        // Send email alerts (fire-and-forget)
        for (const recipient of recipients) {
          sendCostThresholdAlertEmail({
            to: recipient.email,
            assetName: asset.name,
            assetNumber: asset.assetNumber,
            cumulativeCost: cumulativeRepairCost,
            replacementCost: asset.replacementCost,
            pct: asset.repairThresholdPct,
            recommendation: recommendationText,
            assetUrl,
          }).catch((err) =>
            console.error(`[repeatRepairService] Cost threshold email failed for ${recipient.email}:`, err)
          )
        }

        // Create in-app notifications
        for (const recipient of recipients) {
          createNotification({
            userId: recipient.id,
            title: `Cost Threshold Exceeded: ${asset.name}`,
            body: `Repair costs ($${cumulativeRepairCost.toFixed(0)}) have reached ${pct}% of replacement cost ($${asset.replacementCost.toFixed(0)}).`,
            type: 'maintenance_cost_threshold',
            linkUrl: assetUrl,
          }).catch((err) =>
            console.error(`[repeatRepairService] Cost threshold notification failed for ${recipient.id}:`, err)
          )
        }

        // Store AI recommendation and update idempotency timestamp
        await rawPrisma.maintenanceAsset.update({
          where: { id: asset.id },
          data: {
            costAlertSentAt: now,
            aiRecommendation: recommendation,
            aiRecommendationAt: aiIsFresh ? asset.aiRecommendationAt : now,
          },
        })

        counters.costThreshold++
      }
    }

    // ── REPAIR-03: End of Life Detection ─────────────────────────────────────
    if (detectEndOfLife(asset)) {
      const alreadySent = asset.eolAlertSentAt && new Date(asset.eolAlertSentAt) >= thirtyDaysAgo
      if (!alreadySent) {
        const purchaseYear = asset.purchaseDate
          ? new Date(asset.purchaseDate).getFullYear().toString()
          : 'Unknown'

        // Send email alerts (fire-and-forget)
        for (const recipient of recipients) {
          sendEndOfLifeAlertEmail({
            to: recipient.email,
            assetName: asset.name,
            assetNumber: asset.assetNumber,
            purchaseYear,
            expectedLifespan: asset.expectedLifespanYears!,
            assetUrl,
          }).catch((err) =>
            console.error(`[repeatRepairService] End of life email failed for ${recipient.email}:`, err)
          )
        }

        // Create in-app notifications
        for (const recipient of recipients) {
          createNotification({
            userId: recipient.id,
            title: `End of Life: ${asset.name}`,
            body: `Asset ${asset.assetNumber} has exceeded its expected lifespan of ${asset.expectedLifespanYears} years.`,
            type: 'maintenance_end_of_life',
            linkUrl: assetUrl,
          }).catch((err) =>
            console.error(`[repeatRepairService] End of life notification failed for ${recipient.id}:`, err)
          )
        }

        // Update idempotency timestamp
        await rawPrisma.maintenanceAsset.update({
          where: { id: asset.id },
          data: { eolAlertSentAt: now },
        })

        counters.endOfLife++
      }
    }
  }

  return counters
}
