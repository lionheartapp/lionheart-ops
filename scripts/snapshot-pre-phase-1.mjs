#!/usr/bin/env node
/**
 * Pre-Phase-1 snapshot — reads current facilities + core identity data
 * and writes it to scripts/snapshots/pre-phase-1-local.json.
 *
 * Uses raw SQL so it works regardless of whether the Prisma schema has
 * already been rewritten. Safe to run on the CURRENT (pre-rewrite) DB.
 *
 * Usage:
 *   node scripts/snapshot-pre-phase-1.mjs
 *
 * This is a rollback safety net. Run before drop + db:push.
 */

import { PrismaClient } from '@prisma/client'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const prisma = new PrismaClient()

const TABLES = [
  // Core identity (keep)
  'Organization',
  'User',
  'Role',
  'Permission',
  'RolePermission',
  'Team',
  'UserTeam',
  // Facilities (being rebuilt — snapshot for rollback)
  'School',
  'Campus',
  'Building',
  'Area',
  'Room',
  'BuildingSchool',
  'AreaSchool',
  'UserCampusAssignment',
  'UserRoomAssignment',
]

async function tableExists(name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    name
  )
  return rows.length > 0
}

async function dumpTable(name) {
  if (!(await tableExists(name))) {
    return { exists: false, rows: [] }
  }
  // eslint-disable-next-line no-console
  const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${name}"`)
  return { exists: true, rows }
}

async function main() {
  const outDir = path.join(__dirname, 'snapshots')
  await fs.mkdir(outDir, { recursive: true })

  const snapshot = {
    takenAt: new Date().toISOString(),
    databaseUrl: (process.env.DATABASE_URL || '').replace(/:[^@]+@/, ':****@'),
    tables: {},
  }

  let total = 0
  for (const t of TABLES) {
    const { exists, rows } = await dumpTable(t)
    snapshot.tables[t] = { exists, count: rows.length, rows }
    total += rows.length
    console.log(
      `  ${t.padEnd(24)} ${exists ? String(rows.length).padStart(5) + ' rows' : '(missing)'}`
    )
  }

  const outPath = path.join(outDir, 'pre-phase-1-local.json')
  // JSON replacer — handle BigInts and Dates
  const json = JSON.stringify(
    snapshot,
    (_k, v) => (typeof v === 'bigint' ? v.toString() : v),
    2
  )
  await fs.writeFile(outPath, json)

  console.log(`\nWrote ${total} rows total to:`)
  console.log(`  ${outPath}`)
  console.log(
    `\nThis is your rollback artifact. Keep it until Phase 1b is verified.`
  )
}

main()
  .catch((err) => {
    console.error('Snapshot failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
