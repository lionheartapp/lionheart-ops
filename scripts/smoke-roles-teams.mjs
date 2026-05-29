#!/usr/bin/env node

/**
 * Smoke test for Roles & Teams add/delete functionality
 * Tests create, duplicate detection, delete, and delete validation
 */

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

let authToken = null
let orgId = null
let csrfToken = null
let smokeUser = null

/** Extract csrf-token from set-cookie header */
function extractCsrfCookie(res) {
  const setCookie = res.headers.get('set-cookie') || ''
  const match = setCookie.match(/csrf-token=([^;]+)/)
  return match ? match[1] : null
}

async function resolveOrgId() {
  if (process.env.TEST_ORG_ID) {
    console.log(`   org: (from env TEST_ORG_ID: ${process.env.TEST_ORG_ID})`)
    return process.env.TEST_ORG_ID
  }

  const preferred = await prisma.organization.findFirst({
    where: { slug: preferredOrgSlug },
    select: { id: true },
  })

  if (preferred) return preferred.id

  const fallback = await prisma.organization.findFirst({ select: { id: true } })
  if (!fallback) {
    throw new Error('No organization found in database for smoke test')
  }

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
      name: `Smoke Super Admin ${Date.now()}`,
      slug: `smoke-super-admin-${Date.now()}`,
      description: 'Temporary super-admin role for smoke tests',
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
  const seed = Date.now()
  const password = 'SmokeAdmin123!'
  const passwordHash = await bcrypt.hash(password, 10)
  const roleId = await ensureSuperAdminRole(organizationId)
  const user = await prisma.user.create({
    data: {
      organizationId,
      email: `smoke+roles-teams-${seed}@example.com`,
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

async function login() {
  console.log('🔐 Resolving organization...')
  orgId = await resolveOrgId()
  smokeUser = await createSmokeAdmin(orgId)
  
  console.log('🔐 Logging in as admin...')
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: smokeUser.email,
      password: smokeUser.password,
      organizationId: orgId,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(`Login failed: ${response.status} ${JSON.stringify(errorData)}`)
  }

  const data = await response.json()
  if (!data.ok || !data.data?.token) {
    throw new Error(`Login failed: ${JSON.stringify(data)}`)
  }
  
  authToken = data.data.token
  console.log(`✅ Logged in (org: ${orgId})`)
}

function getHeaders() {
  return {
    'Authorization': `Bearer ${authToken}`,
    'X-Organization-ID': orgId,
    'Content-Type': 'application/json',
    ...(csrfToken ? { 'X-CSRF-Token': csrfToken, Cookie: `csrf-token=${csrfToken}` } : {}),
  }
}

async function cleanupSmokeUser() {
  if (!smokeUser?.id) return
  await prisma.user.delete({ where: { id: smokeUser.id } }).catch(() => {})
}

/** Wrapper that handles CSRF double-submit on first state-changing request */
async function csrfFetch(url, options = {}) {
  const res = await fetch(url, options)
  if (res.status === 403 && !csrfToken) {
    const token = extractCsrfCookie(res)
    if (token) {
      csrfToken = token
      options.headers = { ...options.headers, 'X-CSRF-Token': csrfToken, Cookie: `csrf-token=${csrfToken}` }
      return fetch(url, options)
    }
  }
  return res
}

async function testRolesCreate() {
  console.log('\n📋 Testing Roles Create...')
  
  const roleName = `Test Role ${Date.now()}`
  const response = await csrfFetch(`${BASE_URL}/api/settings/roles`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name: roleName }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to create role: ${JSON.stringify(error)}`)
  }

  const result = await response.json()
  const roleId = result.data.id
  const roleSlug = result.data.slug
  
  console.log(`✅ Created role: "${roleName}" (slug: ${roleSlug}, id: ${roleId})`)
  return { roleId, roleName, roleSlug }
}

async function testRolesDuplicateValidation(existingName) {
  console.log('\n🔍 Testing Roles Duplicate Detection...')
  
  const response = await csrfFetch(`${BASE_URL}/api/settings/roles`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name: existingName }),
  })

  if (response.status === 409) {
    console.log('✅ Duplicate role correctly rejected with 409 Conflict')
    return true
  } else if (response.ok) {
    throw new Error('Duplicate role was incorrectly accepted')
  } else {
    const error = await response.json()
    throw new Error(`Unexpected error: ${JSON.stringify(error)}`)
  }
}

async function testRolesDelete(roleId, roleName) {
  console.log('\n🗑️  Testing Roles Delete...')
  
  const response = await csrfFetch(`${BASE_URL}/api/settings/roles/${roleId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to delete role: ${JSON.stringify(error)}`)
  }

  console.log(`✅ Deleted role: "${roleName}"`)
}

async function testRolesDeleteSystemRole() {
  console.log('\n🛡️  Testing System Role Delete Protection...')
  
  // Get system roles
  const listResponse = await csrfFetch(`${BASE_URL}/api/settings/roles`, {
    headers: getHeaders(),
  })
  
  const listData = await listResponse.json()
  const systemRole = listData.data.find(r => r.isSystem)
  
  if (!systemRole) {
    console.log('⚠️  No system roles found to test delete protection')
    return
  }

  const response = await csrfFetch(`${BASE_URL}/api/settings/roles/${systemRole.id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })

  if (response.status === 403) {
    console.log(`✅ System role "${systemRole.name}" correctly protected from deletion`)
    return true
  } else if (response.ok) {
    throw new Error('System role was incorrectly allowed to be deleted')
  } else {
    const error = await response.json()
    throw new Error(`Unexpected error: ${JSON.stringify(error)}`)
  }
}

async function testTeamsCreate() {
  console.log('\n👥 Testing Teams Create...')
  
  const teamName = `Test Team ${Date.now()}`
  const teamDescription = 'Automated test team'
  
  const response = await csrfFetch(`${BASE_URL}/api/settings/teams`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name: teamName, description: teamDescription }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to create team: ${JSON.stringify(error)}`)
  }

  const result = await response.json()
  const teamId = result.data.id
  const teamSlug = result.data.slug
  
  console.log(`✅ Created team: "${teamName}" (slug: ${teamSlug}, id: ${teamId})`)
  return { teamId, teamName, teamSlug }
}

async function testTeamsDuplicateValidation(existingName) {
  console.log('\n🔍 Testing Teams Duplicate Detection...')
  
  const response = await csrfFetch(`${BASE_URL}/api/settings/teams`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ name: existingName }),
  })

  if (response.status === 409) {
    console.log('✅ Duplicate team correctly rejected with 409 Conflict')
    return true
  } else if (response.ok) {
    throw new Error('Duplicate team was incorrectly accepted')
  } else {
    const error = await response.json()
    throw new Error(`Unexpected error: ${JSON.stringify(error)}`)
  }
}

async function testTeamsDelete(teamId, teamName) {
  console.log('\n🗑️  Testing Teams Delete...')
  
  const response = await csrfFetch(`${BASE_URL}/api/settings/teams/${teamId}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Failed to delete team: ${JSON.stringify(error)}`)
  }

  console.log(`✅ Deleted team: "${teamName}"`)
}

async function testRolesList() {
  console.log('\n📋 Testing Roles List...')
  
  const response = await csrfFetch(`${BASE_URL}/api/settings/roles`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Failed to list roles: ${response.status}`)
  }

  const result = await response.json()
  console.log(`✅ Listed ${result.data.length} roles`)
  return result.data
}

async function testTeamsList() {
  console.log('\n👥 Testing Teams List...')
  
  const response = await csrfFetch(`${BASE_URL}/api/settings/teams`, {
    headers: getHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Failed to list teams: ${response.status}`)
  }

  const result = await response.json()
  console.log(`✅ Listed ${result.data.length} teams`)
  return result.data
}

async function runTests() {
  try {
    console.log('🚀 Starting Roles & Teams Smoke Tests\n')
    console.log('=' .repeat(50))

    await login()

    // Test Roles
    console.log('\n' + '='.repeat(50))
    console.log('ROLES TESTS')
    console.log('='.repeat(50))
    
    await testRolesList()
    const role = await testRolesCreate()
    await testRolesDuplicateValidation(role.roleName)
    await testRolesDeleteSystemRole()
    await testRolesDelete(role.roleId, role.roleName)

    // Test Teams
    console.log('\n' + '='.repeat(50))
    console.log('TEAMS TESTS')
    console.log('='.repeat(50))
    
    await testTeamsList()
    const team = await testTeamsCreate()
    await testTeamsDuplicateValidation(team.teamName)
    await testTeamsDelete(team.teamId, team.teamName)

    // Final verification
    console.log('\n' + '='.repeat(50))
    console.log('FINAL VERIFICATION')
    console.log('='.repeat(50))
    
    const finalRoles = await testRolesList()
    const finalTeams = await testTeamsList()

    console.log('\n' + '='.repeat(50))
    console.log('✅ ALL TESTS PASSED!')
    console.log('='.repeat(50))
    console.log(`\n✓ Roles: Create, duplicate detection, system protection, delete`)
    console.log(`✓ Teams: Create, duplicate detection, delete`)
    console.log(`\n📊 Final state: ${finalRoles.length} roles, ${finalTeams.length} teams`)

    await cleanupSmokeUser()
    await prisma.$disconnect()
    process.exit(0)
  } catch (error) {
    console.error('\n' + '='.repeat(50))
    console.error('❌ TEST FAILED')
    console.error('='.repeat(50))
    console.error(error.message)
    console.error(error.stack)
    await cleanupSmokeUser()
    await prisma.$disconnect()
    process.exit(1)
  }
}

runTests()
