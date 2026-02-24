import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
try {
  const users = await prisma.user.findMany({
    select: { 
      id: true, 
      email: true, 
      name: true,
      role: true,
      organizationId: true
    },
    take: 5
  })
  console.log('Users:', JSON.stringify(users, null, 2))
} catch (e) {
  console.error('Error:', e.message)
}
await prisma.$disconnect()
