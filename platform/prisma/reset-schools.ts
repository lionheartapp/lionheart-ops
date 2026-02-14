/**
 * Reset script: Delete all organizations (schools) and their related data.
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/reset-schools.ts
 */
import { PrismaClient } from '@prisma/client'

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
