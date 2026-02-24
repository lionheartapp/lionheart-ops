#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function listOrgs() {
  const orgs = await prisma.organization.findMany({
    select: { slug: true, name: true }
  })
  
  console.log('Organizations in database:')
  orgs.forEach(org => {
    console.log(`  - ${org.slug} (${org.name})`)
    console.log(`    URL: http://${org.slug}.localhost:3004`)
  })
  
  await prisma.$disconnect()
}

listOrgs()
