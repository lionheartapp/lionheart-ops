#!/usr/bin/env node

/**
 * Smoke test for Roles & Teams add/delete functionality
 * Tests create, duplicate detection, delete, and delete validation
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = 'http://localhost:3004'

// Test user credentials (from seed data)
const TEST_ADMIN = {
  email: 'admin@demo.com',
  password: 'test123',
}

let authToken = null
let orgId = null

async function resolveOrgId() {
  const org = await prisma.organization.findFirst({
    where: { slug: 'demo' },
    select: { id: true },
  })
  
  if (!org) {
    throw new Error('Demo organization not found')
  }
  
  return org.id
}

async function login() {
  console.log('🔐 Resolving organization...')
  orgId = await resolveOrgId()
  
  console.log('🔐 Logging in as admin...')
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...TEST_ADMIN,
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
  }
}

async function testRolesCreate() {
  console.log('\n📋 Testing Roles Create...')
  
  const roleName = `Test Role ${Date.now()}`
  const response = await fetch(`${BASE_URL}/api/settings/roles`, {
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
  
  const response = await fetch(`${BASE_URL}/api/settings/roles`, {
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
  
  const response = await fetch(`${BASE_URL}/api/settings/roles/${roleId}`, {
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
  const listResponse = await fetch(`${BASE_URL}/api/settings/roles`, {
    headers: getHeaders(),
  })
  
  const listData = await listResponse.json()
  const systemRole = listData.data.find(r => r.isSystem)
  
  if (!systemRole) {
    console.log('⚠️  No system roles found to test delete protection')
    return
  }

  const response = await fetch(`${BASE_URL}/api/settings/roles/${systemRole.id}`, {
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
  
  const response = await fetch(`${BASE_URL}/api/settings/teams`, {
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
  
  const response = await fetch(`${BASE_URL}/api/settings/teams`, {
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
  
  const response = await fetch(`${BASE_URL}/api/settings/teams/${teamId}`, {
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
  
  const response = await fetch(`${BASE_URL}/api/settings/roles`, {
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
  
  const response = await fetch(`${BASE_URL}/api/settings/teams`, {
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
    
    await prisma.$disconnect()
    process.exit(0)
  } catch (error) {
    console.error('\n' + '='.repeat(50))
    console.error('❌ TEST FAILED')
    console.error('='.repeat(50))
    console.error(error.message)
    console.error(error.stack)
    await prisma.$disconnect()
    process.exit(1)
  }
}

runTests()
