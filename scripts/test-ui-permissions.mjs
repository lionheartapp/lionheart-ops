#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = 'http://localhost:3004'

async function testPermissions() {
  try {
    // Get org ID
    const org = await prisma.organization.findFirst({
      where: { slug: 'demo' },
      select: { id: true },
    })
    
    if (!org) {
      throw new Error('Demo organization not found')
    }

    // Login
    console.log('🔐 Logging in as admin...')
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@demo.com',
        password: 'test123',
        organizationId: org.id,
      }),
    })

    if (!loginRes.ok) {
      const error = await loginRes.json()
      throw new Error(`Login failed: ${JSON.stringify(error)}`)
    }

    const loginData = await loginRes.json()
    const token = loginData.data.token
    console.log('✅ Logged in\n')

    // Check permissions endpoint
    console.log('🔍 Checking /api/auth/permissions...')
    const permRes = await fetch(`${BASE_URL}/api/auth/permissions`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!permRes.ok) {
      const error = await permRes.json()
      throw new Error(`Permissions check failed: ${JSON.stringify(error)}`)
    }

    const permData = await permRes.json()
    console.log('Response:', JSON.stringify(permData, null, 2))

    if (permData.ok && permData.data.canManageWorkspace) {
      console.log('\n✅ canManageWorkspace: true')
    } else {
      console.log('\n❌ canManageWorkspace: false or missing!')
    }

    // Test roles endpoint
    console.log('\n🔍 Testing /api/settings/roles...')
    const rolesRes = await fetch(`${BASE_URL}/api/settings/roles`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Organization-ID': org.id,
      },
    })

    if (!rolesRes.ok) {
      const error = await rolesRes.json()
      console.log('❌ Roles endpoint failed:', JSON.stringify(error))
    } else {
      const rolesData = await rolesRes.json()
      console.log(`✅ Roles endpoint works (${rolesData.data.length} roles)`)
    }

    // Test teams endpoint
    console.log('\n🔍 Testing /api/settings/teams...')
    const teamsRes = await fetch(`${BASE_URL}/api/settings/teams`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Organization-ID': org.id,
      },
    })

    if (!teamsRes.ok) {
      const error = await teamsRes.json()
      console.log('❌ Teams endpoint failed:', JSON.stringify(error))
    } else {
      const teamsData = await teamsRes.json()
      console.log(`✅ Teams endpoint works (${teamsData.data.length} teams)`)
    }

    await prisma.$disconnect()
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    await prisma.$disconnect()
    process.exit(1)
  }
}

testPermissions()
