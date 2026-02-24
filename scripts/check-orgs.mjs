import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
try {
  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true }
  })
  console.log('Organizations:', JSON.stringify(orgs, null, 2))
  if (orgs.length === 0) {
    console.log('No organizations found - you need to sign up first!')
  }
} catch (e) {
  console.error('Error:', e.message)
}
await prisma.$disconnect()
