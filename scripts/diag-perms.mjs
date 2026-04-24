// Diagnostic: list demo-org users and their permissions.
// Usage: node scripts/diag-perms.mjs [--remote]
import pg from 'pg'
import fs from 'fs'

const useRemote = process.argv.includes('--remote')
const envFile = useRemote ? '.env' : '.env.local'
const envText = fs.readFileSync(envFile, 'utf8')
const env = {}
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)\s*=\s*"?(.*?)"?$/)
  if (m) env[m[1]] = m[2]
}
const conn = env.DIRECT_URL || env.DATABASE_URL
console.log(`Using ${envFile} | host=${(conn.match(/@([^/?]+)/)||[])[1]}`)

const client = new pg.Client({ connectionString: conn })
await client.connect()

const { rows: orgs } = await client.query(`SELECT id, name, slug FROM "Organization" WHERE slug = 'demo'`)
console.log('\nDemo org:', orgs)
if (!orgs.length) { await client.end(); process.exit(0) }
const orgId = orgs[0].id

const { rows: users } = await client.query(`
  SELECT u.id, u.email, u."firstName", u."lastName", u.status, u."roleId",
         r.name AS role_name, r.slug AS role_slug
  FROM "User" u
  LEFT JOIN "Role" r ON r.id = u."roleId"
  WHERE u."organizationId" = $1 AND u."deletedAt" IS NULL
  ORDER BY u."createdAt"
`, [orgId])

console.log(`\nUsers (${users.length}):`)
for (const u of users) {
  console.log(`\n  ${u.email}`)
  console.log(`    status=${u.status}  role=${u.role_name ?? 'NONE'}  slug=${u.role_slug ?? 'none'}  roleId=${u.roleId ?? 'NULL'}`)
  if (!u.roleId) { console.log('    ⚠️  NO ROLE ASSIGNED'); continue }
  const { rows: perms } = await client.query(`
    SELECT p.resource, p.action, p.scope
    FROM "RolePermission" rp
    JOIN "Permission" p ON p.id = rp."permissionId"
    WHERE rp."roleId" = $1
    ORDER BY p.resource, p.action, p.scope
  `, [u.roleId])
  const permStrs = perms.map(p => p.scope && p.scope !== 'global' ? `${p.resource}:${p.action}:${p.scope}` : `${p.resource}:${p.action}`)
  const hasWildcard = permStrs.includes('*:*')
  const hasSettingsRead = hasWildcard || permStrs.includes('settings:read')
  const hasSettingsUpdate = hasWildcard || permStrs.includes('settings:update')
  console.log(`    perms=${perms.length}  wildcard=${hasWildcard}  settings:read=${hasSettingsRead}  settings:update=${hasSettingsUpdate}`)
  if (!hasSettingsUpdate) {
    console.log(`    ⚠️  MISSING settings:update — this is why POST returns 403`)
  }
}

await client.end()
