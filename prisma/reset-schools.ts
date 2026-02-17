/**
 * Reset script: Delete all organizations (schools) and their related data.
 * Run with: npm run db:reset-schools (or npx ts-node with CommonJS).
 * Loads DATABASE_URL from .env or platform/.env if not set.
 */
const path = require('path')
const fs = require('fs')

function loadEnv(filePath: string) {
  if (!fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (match) {
      const key = match[1]
      const value = match[2].replace(/^["']|["']$/g, '').trim()
      if (!process.env[key]) process.env[key] = value
    }
  }
}

if (!process.env.DATABASE_URL) {
  const root = path.resolve(__dirname, '..')
  loadEnv(path.join(root, '.env'))
  if (!process.env.DATABASE_URL) loadEnv(path.join(root, 'platform', '.env'))
}

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Delete all organizations - cascades to users, buildings, rooms, tickets, events, etc.
  const result = await prisma.organization.deleteMany({})
  console.log(`Deleted ${result.count} organization(s). All related data (users, buildings, etc.) has been removed.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
