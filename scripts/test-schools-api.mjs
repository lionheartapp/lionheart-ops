import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  // Get the demo organization
  const org = await prisma.organization.findFirst({
    where: { slug: 'demo' }
  })
  
  if (!org) {
    console.error('Organization not found')
    process.exit(1)
  }

  console.log('Organization ID:', org.id)
  console.log('Organization Name:', org.name)
  
  // Now test the schools endpoint by making a fetch call
  const response = await fetch('http://localhost:3004/api/settings/schools', {
    headers: {
      'x-org-id': org.id,
      'authorization': 'Bearer test-token'
    }
  })
  
  const data = await response.json()
  console.log('Status:', response.status)
  console.log('Response:', JSON.stringify(data, null, 2))
  
} catch (e) {
  console.error('Error:', e.message)
} finally {
  await prisma.$disconnect()
}
