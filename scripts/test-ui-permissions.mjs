#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true, quiet: true })
dotenv.config({ quiet: true })

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
})
const BASE_URL = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3004'
const preferredOrgSlug = process.env.SMOKE_ORG_SLUG || 'demo'

async function resolveOrganizationId() {
  const preferred = await prisma.organization.findFirst({
    where: { slug: preferredOrgSlug },
    select: { id: true },
  })

  if (preferred) return preferred.id

  const fallback = await prisma.organization.findFirst({ select: { id: true } })
  if (!fallback) throw new Error('No organization found in database for smoke test')

  return fallback.id
}

async function ensureSuperAdminRole(organizationId) {
  const existing = await prisma.role.findFirst({
    where: { organizationId, slug: 'super-admin' },
    select: { id: true },
  })

  if (existing) return existing.id

  const wildcard = await prisma.permission.upsert({
    where: {
      resource_action_scope: {
        resource: '*',
        action: '*',
        scope: 'global',
      },
    },
    update: {},
    create: {
      resource: '*',
      action: '*',
      scope: 'global',
      description: 'Wildcard permission for smoke tests',
    },
  })

  const role = await prisma.role.create({
    data: {
      organizationId,
      name: `Smoke UI Permission Admin ${Date.now()}`,
      slug: `smoke-ui-permission-admin-${Date.now()}`,
      description: 'Temporary super-admin role for UI permission smoke tests',
      isSystem: false,
      permissions: {
        create: [{ permissionId: wildcard.id }],
      },
    },
    select: { id: true },
  })

  return role.id
}

async function createSmokeAdmin(organizationId) {
  const password = 'SmokeAdmin123!'
  const passwordHash = await bcrypt.hash(password, 10)
  const roleId = await ensureSuperAdminRole(organizationId)
  const user = await prisma.user.create({
    data: {
      organizationId,
      email: `smoke+ui-permissions-${Date.now()}@example.com`,
      firstName: 'Smoke',
      lastName: 'Admin',
      name: 'Smoke Admin',
      passwordHash,
      emailVerified: true,
      status: 'ACTIVE',
      roleId,
    },
    select: { id: true, email: true },
  })

  return { ...user, password }
}

async function testPermissions() {
  let smokeUser = null
  try {
    const organizationId = await resolveOrganizationId()
    smokeUser = await createSmokeAdmin(organizationId)

    // Login
    console.log('🔐 Logging in as admin...')
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: smokeUser.email,
        password: smokeUser.password,
        organizationId,
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
        'X-Organization-ID': organizationId,
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
        'X-Organization-ID': organizationId,
      },
    })

    if (!teamsRes.ok) {
      const error = await teamsRes.json()
      console.log('❌ Teams endpoint failed:', JSON.stringify(error))
    } else {
      const teamsData = await teamsRes.json()
      console.log(`✅ Teams endpoint works (${teamsData.data.length} teams)`)
    }

    if (smokeUser?.id) {
      await prisma.user.delete({ where: { id: smokeUser.id } }).catch(() => {})
    }
    await prisma.$disconnect()
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    if (smokeUser?.id) {
      await prisma.user.delete({ where: { id: smokeUser.id } }).catch(() => {})
    }
    await prisma.$disconnect()
    process.exit(1)
  }
}

testPermissions()
