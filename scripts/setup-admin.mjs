import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()
const testPassword = 'TestPassword123!'

try {
  // Find admin user
  const admin = await prisma.user.findFirst({
    where: { email: 'admin@demo.com' }
  })
  
  if (!admin) {
    console.error('Admin user not found')
    process.exit(1)
  }

  // Hash and set password
  const passwordHash = await bcrypt.hash(testPassword, 10)
  
  await prisma.user.update({
    where: { id: admin.id },
    data: { passwordHash }
  })
  
  console.log('✓ Admin password set to:', testPassword)
  console.log('Email: admin@demo.com')
} catch (e) {
  console.error('Error:', e.message)
  process.exit(1)
} finally {
  await prisma.$disconnect()
}
