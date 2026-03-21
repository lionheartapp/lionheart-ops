#!/usr/bin/env node
/**
 * Copy Linfield Christian School data from remote Supabase to local Postgres.
 *
 * Usage: node scripts/copy-linfield-local.mjs
 *
 * Prerequisites:
 *   - Local Postgres running with `lionheart_local` database
 *   - Schema already pushed via `npm run db:push`
 */

import pg from 'pg'
const { Client } = pg

const LINFIELD_ORG_ID = 'cmm53helb0000n8hbhthyh4b7'

const REMOTE_URL = 'postgresql://postgres.yvpbnzeycowtvuxiidbj:Godforgives!02712@aws-0-us-west-2.pooler.supabase.com:5432/postgres'
const LOCAL_URL = 'postgresql://mkerley@localhost:5432/lionheart_local'

async function main() {
  const remote = new Client({ connectionString: REMOTE_URL, ssl: { rejectUnauthorized: false } })
  const local = new Client({ connectionString: LOCAL_URL })

  await remote.connect()
  await local.connect()
  console.log('Connected to both databases.\n')

  // Disable FK checks for clean import
  await local.query('SET session_replication_role = replica;')
  console.log('FK checks disabled.\n')

  // Clear ALL local data
  console.log('Clearing existing local data...')
  const allTables = [
    'PasswordSetupToken', 'Notification', 'TenantModule',
    'CalendarEvent', 'Calendar',
    'RegistrationForm', 'EventProject',
    'DraftEvent', 'Event',
    'InventoryItem', 'Ticket',
    'UserRoomAssignment', 'TeacherSchedule',
    'Room', 'Area', 'Building', 'School', 'Campus',
    'UserTeam', 'RolePermission', 'User', 'Team', 'Role',
    'Permission', 'Organization',
  ]
  for (const table of allTables) {
    try {
      await local.query(`DELETE FROM "${table}"`)
    } catch {
      // Table might not exist
    }
  }
  console.log('Local data cleared.\n')

  // Get JSONB columns for a table so we know which arrays to stringify
  async function getJsonbColumns(table) {
    const { rows } = await local.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND data_type IN ('json', 'jsonb') AND table_schema = 'public'`,
      [table]
    )
    return new Set(rows.map(r => r.column_name))
  }

  // --- Helper: serialize a value for Postgres parameterized query ---
  function serializeValue(val, isJsonb = false) {
    if (val === null || val === undefined) return null
    if (val instanceof Date) return val
    if (Buffer.isBuffer(val)) return val
    // JSONB columns: stringify objects and arrays
    if (isJsonb && (Array.isArray(val) || typeof val === 'object')) return JSON.stringify(val)
    if (Array.isArray(val)) return val  // Postgres array type
    if (typeof val === 'object') return JSON.stringify(val)
    return val
  }

  // --- Copy table helper ---
  async function copyTable(label, table, whereClause) {
    const query = `SELECT * FROM "${table}" ${whereClause}`
    const { rows } = await remote.query(query)
    if (rows.length === 0) {
      console.log(`  ${label} ${table}: 0 rows (skipped)`)
      return 0
    }

    const jsonbCols = await getJsonbColumns(table)
    const cols = Object.keys(rows[0])
    const quotedCols = cols.map(c => `"${c}"`)

    let inserted = 0
    const batchSize = 50
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      const values = []
      const placeholders = []
      let paramIdx = 1

      for (const row of batch) {
        const rowPlaceholders = []
        for (const col of cols) {
          values.push(serializeValue(row[col], jsonbCols.has(col)))
          rowPlaceholders.push(`$${paramIdx++}`)
        }
        placeholders.push(`(${rowPlaceholders.join(', ')})`)
      }

      const insertSQL = `INSERT INTO "${table}" (${quotedCols.join(', ')}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`
      try {
        await local.query(insertSQL, values)
        inserted += batch.length
      } catch (e) {
        // Fallback: insert one at a time
        for (const row of batch) {
          const singleValues = cols.map(col => serializeValue(row[col], jsonbCols.has(col)))
          const singlePlaceholders = singleValues.map((_, i) => `$${i + 1}`)
          try {
            await local.query(
              `INSERT INTO "${table}" (${quotedCols.join(', ')}) VALUES (${singlePlaceholders.join(', ')}) ON CONFLICT DO NOTHING`,
              singleValues
            )
            inserted++
          } catch (e2) {
            console.error(`    Skipped row in ${table}: ${e2.message.slice(0, 120)}`)
          }
        }
      }
    }

    console.log(`  ${label} ${table}: ${inserted} rows`)
    return inserted
  }

  const ORG = `WHERE "organizationId" = '${LINFIELD_ORG_ID}'`
  const ORG_ID = `WHERE id = '${LINFIELD_ORG_ID}'`
  const BY_USER = `WHERE "userId" IN (SELECT id FROM "User" WHERE "organizationId" = '${LINFIELD_ORG_ID}')`
  const BY_ROLE = `WHERE "roleId" IN (SELECT id FROM "Role" WHERE "organizationId" = '${LINFIELD_ORG_ID}')`
  const BY_EVENT_PROJECT = `WHERE "eventProjectId" IN (SELECT id FROM "EventProject" WHERE "organizationId" = '${LINFIELD_ORG_ID}')`

  let total = 0
  let step = 0

  // Foundation
  total += await copyTable(`${++step}.`, 'Organization', ORG_ID)
  total += await copyTable(`${++step}.`, 'Permission', '')  // global
  total += await copyTable(`${++step}.`, 'Role', ORG)
  total += await copyTable(`${++step}.`, 'RolePermission', BY_ROLE)

  // Campus (before School, Building, etc.)
  total += await copyTable(`${++step}.`, 'Campus', ORG)

  // People
  total += await copyTable(`${++step}.`, 'School', ORG)
  total += await copyTable(`${++step}.`, 'User', ORG)
  total += await copyTable(`${++step}.`, 'Team', ORG)
  total += await copyTable(`${++step}.`, 'UserTeam', BY_USER)

  // Facilities
  total += await copyTable(`${++step}.`, 'Building', ORG)
  total += await copyTable(`${++step}.`, 'Area', ORG)
  total += await copyTable(`${++step}.`, 'Room', ORG)
  total += await copyTable(`${++step}.`, 'UserRoomAssignment', ORG)
  total += await copyTable(`${++step}.`, 'TeacherSchedule', ORG)

  // Operations
  total += await copyTable(`${++step}.`, 'Ticket', ORG)
  total += await copyTable(`${++step}.`, 'InventoryItem', ORG)

  // Events
  total += await copyTable(`${++step}.`, 'Event', ORG)
  total += await copyTable(`${++step}.`, 'DraftEvent', ORG)
  total += await copyTable(`${++step}.`, 'Calendar', ORG)
  total += await copyTable(`${++step}.`, 'CalendarEvent', ORG)
  total += await copyTable(`${++step}.`, 'EventProject', ORG)
  total += await copyTable(`${++step}.`, 'RegistrationForm', BY_EVENT_PROJECT)

  // Misc
  total += await copyTable(`${++step}.`, 'Notification', ORG)
  total += await copyTable(`${++step}.`, 'PasswordSetupToken', BY_USER)
  total += await copyTable(`${++step}.`, 'TenantModule', ORG)

  // Re-enable FK checks
  await local.query('SET session_replication_role = DEFAULT;')

  console.log(`\nDone! Copied ${total} total rows to local database.`)
  console.log('FK checks re-enabled.')

  await remote.end()
  await local.end()
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
