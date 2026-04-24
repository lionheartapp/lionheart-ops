#!/usr/bin/env node
/**
 * Purge stress-test notifications from the database.
 *
 * Deletes all Notification rows whose title contains "Stress" or "VU"
 * (matching patterns like "Stress Create VU121 Iter2...").
 *
 * Usage:
 *   node scripts/purge-test-notifications.mjs            # dry-run (default)
 *   node scripts/purge-test-notifications.mjs --execute   # actually delete
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const dryRun = !process.argv.includes('--execute')

async function main() {
  // Find matching notifications
  const matches = await prisma.notification.findMany({
    where: {
      OR: [
        { title: { contains: 'Stress' } },
        { title: { contains: 'VU1' } },
      ],
    },
    select: { id: true, title: true, isRead: true, createdAt: true },
  })

  console.log(`Found ${matches.length} stress-test notification(s).`)

  if (matches.length === 0) {
    console.log('Nothing to purge.')
    return
  }

  // Show a sample
  const sample = matches.slice(0, 5)
  console.log('\nSample titles:')
  for (const n of sample) {
    console.log(`  - [${n.isRead ? 'read' : 'unread'}] ${n.title}`)
  }
  if (matches.length > 5) {
    console.log(`  ... and ${matches.length - 5} more`)
  }

  if (dryRun) {
    console.log('\nDry run — no rows deleted. Pass --execute to delete.')
    return
  }

  // Delete all matching rows
  const ids = matches.map((n) => n.id)
  const result = await prisma.notification.deleteMany({
    where: { id: { in: ids } },
  })

  console.log(`\nDeleted ${result.count} notification(s).`)
}

main()
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
