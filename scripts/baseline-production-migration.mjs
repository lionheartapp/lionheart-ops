#!/usr/bin/env node

/**
 * Baseline Production Migration
 *
 * This script creates the _prisma_migrations table on the production database
 * and marks all existing local migrations as "already applied" so that future
 * `prisma migrate deploy` runs only apply NEW migrations.
 *
 * WHY: Production currently uses `db:push` (no migration history). Without a
 * baseline, we can't roll back schema changes, can't audit what changed when,
 * and can't safely apply breaking changes.
 *
 * PREREQUISITES:
 * - Set DATABASE_URL to the PRODUCTION connection string (or use .env)
 * - Back up the production database first
 *
 * USAGE:
 *   # Dry run — shows what would be marked as applied
 *   node scripts/baseline-production-migration.mjs --dry-run
 *
 *   # Apply baseline
 *   node scripts/baseline-production-migration.mjs
 *
 * After running this once, switch deployments to `npx prisma migrate deploy`
 * instead of `db:push:remote`.
 */

import { execSync } from 'child_process'
import { readdirSync } from 'fs'
import { join } from 'path'

const MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations')
const dryRun = process.argv.includes('--dry-run')

// Get all migration directories (exclude .sql files and lock)
const migrations = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .sort()

console.log(`Found ${migrations.length} local migrations to baseline:\n`)
migrations.forEach(m => console.log(`  ${m}`))

if (dryRun) {
  console.log('\n[DRY RUN] Would mark all above as applied. Run without --dry-run to execute.')
  process.exit(0)
}

console.log('\nMarking migrations as applied on production...\n')

for (const migration of migrations) {
  try {
    console.log(`  Resolving: ${migration}`)
    execSync(
      `npx prisma migrate resolve --applied "${migration}"`,
      { stdio: 'inherit', cwd: process.cwd() }
    )
  } catch (error) {
    console.error(`  Failed to resolve ${migration}:`, error.message)
    process.exit(1)
  }
}

console.log('\nBaseline complete. Production now has migration history.')
console.log('Future deployments can use: npx prisma migrate deploy')
