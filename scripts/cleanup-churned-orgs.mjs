#!/usr/bin/env node
/**
 * Cleanup Churned Organizations
 *
 * Hard-deletes organizations whose grace period has expired.
 *
 * Criteria:
 *   - onboardingStatus === 'CHURNED'
 *   - scheduledDeleteAt IS NOT NULL
 *   - scheduledDeleteAt <= now
 *
 * Run via cron (daily is fine):
 *   npm run cleanup:churned
 *
 * Cascading delete: the Organization → everything else FK chain has
 * onDelete: Cascade, so a single delete() removes all related rows.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const now = new Date()

  const candidates = await prisma.organization.findMany({
    where: {
      onboardingStatus: 'CHURNED',
      scheduledDeleteAt: { lte: now },
    },
    select: { id: true, name: true, slug: true, scheduledDeleteAt: true },
  })

  if (candidates.length === 0) {
    console.log('[cleanup] No churned organizations past grace period.')
    return
  }

  console.log(`[cleanup] Found ${candidates.length} organization(s) to delete:`)
  for (const org of candidates) {
    console.log(`  - ${org.name} (${org.slug}) — scheduled ${org.scheduledDeleteAt?.toISOString()}`)
  }

  let deleted = 0
  let failed = 0

  for (const org of candidates) {
    try {
      await prisma.organization.delete({ where: { id: org.id } })
      console.log(`[cleanup] ✓ Deleted ${org.name} (${org.id})`)
      deleted++
    } catch (error) {
      console.error(
        `[cleanup] ✗ Failed to delete ${org.name} (${org.id}):`,
        error instanceof Error ? error.message : error
      )
      failed++
    }
  }

  console.log(`[cleanup] Done. Deleted: ${deleted}, Failed: ${failed}`)
}

main()
  .catch((error) => {
    console.error('[cleanup] Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
