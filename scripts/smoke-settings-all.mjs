#!/usr/bin/env node

/**
 * Comprehensive smoke test for ALL settings tab APIs
 *
 * Tests:
 *   - School Info  (GET + PATCH including validation edge cases)
 *   - Members      (GET list, PATCH status/role, permission guard)
 *   - Roles        (GET, POST, PATCH, DELETE, system-role protection)
 *   - Teams        (GET, POST, PATCH, DELETE)
 *   - Campus       (buildings, areas, rooms – GET + basic CRUD)
 *   - Permissions  (GET full list)
 *
 * Usage:
 *   node scripts/smoke-settings-all.mjs
 *
 * Requires a running dev server on port 3004 and the demo org seeded.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = 'http://localhost:3004'

const TEST_ADMIN = { email: 'admin@demo.com', password: 'test123' }

let authToken = null
let orgId = null

// ─── helpers ──────────────────────────────────────────────────────────────────

async function resolveOrgId() {
  // Allow override via env var (useful when Prisma binary isn't available)
  if (process.env.TEST_ORG_ID) {
    console.log(`   org: (from env TEST_ORG_ID: ${process.env.TEST_ORG_ID})`)
    return process.env.TEST_ORG_ID
  }

  const org = await prisma.organization.findFirst({
    where: { slug: 'demo' },
    select: { id: true, slug: true, name: true },
  })
  if (!org) throw new Error('Demo organization not found — run db:seed first')
  console.log(`   org: "${org.name}" (${org.id})`)
  return org.id
}

async function login() {
  console.log('\n🔐 Resolving organization...')
  orgId = await resolveOrgId()

  console.log('🔐 Logging in as admin...')
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...TEST_ADMIN, organizationId: orgId }),
  })
  const data = await res.json()
  if (!res.ok || !data.ok || !data.data?.token) {
    throw new Error(`Login failed: ${JSON.stringify(data)}`)
  }
  authToken = data.data.token
  console.log('✅ Logged in\n')
}

function headers() {
  return {
    Authorization: `Bearer ${authToken}`,
    'X-Organization-ID': orgId,
    'Content-Type': 'application/json',
  }
}

let passed = 0
let failed = 0
const failures = []

function pass(label) {
  console.log(`  ✅ ${label}`)
  passed++
}

function fail(label, detail) {
  console.log(`  ❌ ${label}`)
  if (detail) console.log(`     ${JSON.stringify(detail).slice(0, 300)}`)
  failed++
  failures.push({ label, detail })
}

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(),
    body: body != null ? JSON.stringify(body) : undefined,
  })
  let data
  try { data = await res.json() } catch { data = null }
  return { status: res.status, ok: res.ok, data }
}

// ─── School Info ──────────────────────────────────────────────────────────────

async function testSchoolInfo() {
  console.log('🏫 School Info')

  // ── GET ──────────────────────────────────────────────────────────────
  const get = await api('GET', '/api/settings/school-info')
  if (!get.ok || !get.data?.ok) {
    fail('GET school-info', get.data)
    return
  }
  pass('GET school-info returns org data')

  const orig = get.data.data
  console.log(`     current slug="${orig.slug}" name="${orig.name}"`)

  // check that required fields are present
  const requiredFields = ['id', 'name', 'slug', 'campusSnapshot', 'primaryAdminContact']
  const missingFields = requiredFields.filter(f => !(f in orig))
  if (missingFields.length) fail(`GET school-info missing fields: ${missingFields.join(', ')}`)
  else pass('GET school-info response has expected shape')

  // ── PATCH valid minimal payload ───────────────────────────────────────
  const validPatch = {
    name: orig.name,
    slug: orig.slug,
    institutionType: orig.institutionType || null,
    gradeLevel: orig.gradeLevel || null,
    physicalAddress: orig.physicalAddress || '',
    district: orig.district || '',
    website: orig.website || '',
    phone: orig.phone || '',
    principalName: orig.principalName || '',
    principalEmail: orig.principalEmail || '',
    principalPhone: orig.principalPhone || '',
    headOfSchoolsName: orig.headOfSchoolsName || '',
    headOfSchoolsEmail: orig.headOfSchoolsEmail || '',
    headOfSchoolsPhone: orig.headOfSchoolsPhone || '',
    gradeRange: orig.gradeRange || '',
    studentCount: orig.studentCount ?? null,
    staffCount: orig.staffCount ?? null,
    logoUrl: orig.logoUrl || '',
    heroImageUrl: orig.heroImageUrl || '',
    imagePosition: orig.imagePosition || 'LEFT',
  }

  const patchValid = await api('PATCH', '/api/settings/school-info', validPatch)
  if (!patchValid.ok || !patchValid.data?.ok) {
    fail('PATCH school-info with current data (round-trip)', patchValid.data)
  } else {
    pass('PATCH school-info round-trip save succeeds')
  }

  // ── PATCH: bare website URL (no https://) should FAIL ─────────────────
  //   The frontend adds https:// before sending, but let's verify the API
  //   correctly rejects a bare domain so we know why the UI might fail if
  //   the normalization ever gets skipped.
  const patchBareUrl = await api('PATCH', '/api/settings/school-info', {
    ...validPatch,
    website: 'www.school-no-protocol.com',
  })
  if (patchBareUrl.status === 400) {
    pass('PATCH school-info rejects bare website URL (no https://) — validation working')
  } else {
    fail('PATCH school-info should reject bare URL (expected 400)', patchBareUrl.data)
  }

  // ── PATCH: properly prefixed website should succeed ────────────────────
  const patchGoodUrl = await api('PATCH', '/api/settings/school-info', {
    ...validPatch,
    website: 'https://www.example-school.com',
  })
  if (patchGoodUrl.ok && patchGoodUrl.data?.ok) {
    pass('PATCH school-info accepts https:// website URL')
    // restore original
    await api('PATCH', '/api/settings/school-info', validPatch)
  } else {
    fail('PATCH school-info should accept valid https:// URL', patchGoodUrl.data)
  }

  // ── PATCH: uppercase slug should FAIL ─────────────────────────────────
  //   The frontend lowercases before sending, but verify API enforcement.
  const patchUpperSlug = await api('PATCH', '/api/settings/school-info', {
    ...validPatch,
    slug: 'UPPER-CASE',
  })
  if (patchUpperSlug.status === 400) {
    pass('PATCH school-info rejects uppercase slug — validation working')
  } else {
    fail('PATCH school-info should reject uppercase slug (expected 400)', patchUpperSlug.data)
  }

  // ── PATCH: slug with spaces should FAIL ───────────────────────────────
  const patchSpaceSlug = await api('PATCH', '/api/settings/school-info', {
    ...validPatch,
    slug: 'slug with spaces',
  })
  if (patchSpaceSlug.status === 400) {
    pass('PATCH school-info rejects slug with spaces')
  } else {
    fail('PATCH school-info should reject slug with spaces (expected 400)', patchSpaceSlug.data)
  }

  // ── PATCH: slug too short should FAIL ─────────────────────────────────
  const patchShortSlug = await api('PATCH', '/api/settings/school-info', {
    ...validPatch,
    slug: 'ab',
  })
  if (patchShortSlug.status === 400) {
    pass('PATCH school-info rejects slug shorter than 3 chars')
  } else {
    fail('PATCH school-info should reject short slug (expected 400)', patchShortSlug.data)
  }

  // ── PATCH: missing name should FAIL ───────────────────────────────────
  const patchNoName = await api('PATCH', '/api/settings/school-info', {
    ...validPatch,
    name: '',
  })
  if (patchNoName.status === 400) {
    pass('PATCH school-info rejects missing name')
  } else {
    fail('PATCH school-info should reject empty name (expected 400)', patchNoName.data)
  }

  // ── PATCH: invalid logoUrl should FAIL ────────────────────────────────
  const patchBadLogo = await api('PATCH', '/api/settings/school-info', {
    ...validPatch,
    logoUrl: 'not-a-url',
  })
  if (patchBadLogo.status === 400) {
    pass('PATCH school-info rejects invalid logoUrl')
  } else {
    fail('PATCH school-info should reject invalid logoUrl (expected 400)', patchBadLogo.data)
  }

  // ── PATCH: empty logoUrl (treated as null) should succeed ─────────────
  const patchEmptyLogo = await api('PATCH', '/api/settings/school-info', {
    ...validPatch,
    logoUrl: '',
  })
  if (patchEmptyLogo.ok && patchEmptyLogo.data?.ok) {
    pass('PATCH school-info accepts empty logoUrl (treated as null)')
    // restore
    await api('PATCH', '/api/settings/school-info', validPatch)
  } else {
    fail('PATCH school-info should accept empty logoUrl', patchEmptyLogo.data)
  }

  // ── PATCH: valid enum values ───────────────────────────────────────────
  const patchEnums = await api('PATCH', '/api/settings/school-info', {
    ...validPatch,
    institutionType: 'PUBLIC',
    gradeLevel: 'HIGH_SCHOOL',
  })
  if (patchEnums.ok && patchEnums.data?.ok) {
    pass('PATCH school-info accepts valid institutionType + gradeLevel enums')
    await api('PATCH', '/api/settings/school-info', validPatch)
  } else {
    fail('PATCH school-info should accept valid enums', patchEnums.data)
  }

  // ── PATCH: invalid enum value should FAIL ─────────────────────────────
  const patchBadEnum = await api('PATCH', '/api/settings/school-info', {
    ...validPatch,
    institutionType: 'HOMESCHOOL',
  })
  if (patchBadEnum.status === 400) {
    pass('PATCH school-info rejects invalid institutionType enum')
  } else {
    fail('PATCH school-info should reject invalid enum (expected 400)', patchBadEnum.data)
  }
}

// ─── Members ──────────────────────────────────────────────────────────────────

async function testMembers() {
  console.log('\n👥 Members')

  // GET list
  const list = await api('GET', '/api/settings/users')
  if (!list.ok || !list.data?.ok) {
    fail('GET /api/settings/users', list.data)
    return
  }
  pass('GET members list returns data')

  const members = list.data.data
  if (!Array.isArray(members) || members.length === 0) {
    fail('Members list should be non-empty array')
    return
  }
  pass(`GET members list has ${members.length} member(s)`)

  const adminMember = members.find(m => m.email === TEST_ADMIN.email)
  if (!adminMember) {
    fail('Could not find test admin in members list')
    return
  }
  pass('Test admin appears in members list')

  // GET single member
  const single = await api('GET', `/api/settings/users/${adminMember.id}`)
  if (!single.ok || !single.data?.ok) {
    fail('GET single member', single.data)
  } else {
    pass('GET single member returns data')
  }

  // PATCH: update jobTitle
  const patchTitle = await api('PATCH', `/api/settings/users/${adminMember.id}`, {
    jobTitle: 'Smoke Test Admin',
  })
  if (!patchTitle.ok || !patchTitle.data?.ok) {
    fail('PATCH member jobTitle', patchTitle.data)
  } else {
    pass('PATCH member jobTitle succeeds')
    // restore
    await api('PATCH', `/api/settings/users/${adminMember.id}`, {
      jobTitle: adminMember.jobTitle || '',
    })
  }

  // Roles available for member edit
  const roles = await api('GET', '/api/settings/roles')
  if (!roles.ok || !roles.data?.ok) {
    fail('GET roles for member edit', roles.data)
  } else {
    pass(`GET roles for member edit — ${roles.data.data.length} role(s)`)
  }

  // Status: attempt to set current user to INACTIVE then restore
  const nonAdminMember = members.find(m => m.email !== TEST_ADMIN.email && m.status === 'ACTIVE')
  if (nonAdminMember) {
    const deact = await api('PATCH', `/api/settings/users/${nonAdminMember.id}`, {
      status: 'INACTIVE',
    })
    if (!deact.ok || !deact.data?.ok) {
      fail('PATCH member status INACTIVE', deact.data)
    } else {
      pass('PATCH member status INACTIVE succeeds')
      const restore = await api('PATCH', `/api/settings/users/${nonAdminMember.id}`, {
        status: 'ACTIVE',
      })
      if (restore.ok && restore.data?.ok) pass('PATCH member status restore to ACTIVE succeeds')
      else fail('PATCH member status restore failed', restore.data)
    }
  } else {
    console.log('  ⚠️  Skipped status toggle — no non-admin ACTIVE member found')
  }
}

// ─── Roles ────────────────────────────────────────────────────────────────────

async function testRoles() {
  console.log('\n🎭 Roles')

  // GET list
  const list = await api('GET', '/api/settings/roles')
  if (!list.ok || !list.data?.ok) {
    fail('GET roles', list.data)
    return
  }
  pass(`GET roles list — ${list.data.data.length} role(s)`)

  const roles = list.data.data
  const systemRole = roles.find(r => r.isSystem)
  const customRole = roles.find(r => !r.isSystem)

  // CREATE role
  const roleName = `Smoke-Role-${Date.now()}`
  const create = await api('POST', '/api/settings/roles', { name: roleName })
  if (!create.ok || !create.data?.ok) {
    fail('POST create role', create.data)
    return
  }
  pass(`POST create role "${roleName}"`)
  const newRoleId = create.data.data.id

  // DUPLICATE name should fail
  const dup = await api('POST', '/api/settings/roles', { name: roleName })
  if (dup.status === 409 || dup.status === 400) {
    pass('POST duplicate role name rejected')
  } else {
    fail('POST duplicate role name should be rejected (expected 409/400)', dup.data)
  }

  // GET single role
  const single = await api('GET', `/api/settings/roles/${newRoleId}`)
  if (!single.ok || !single.data?.ok) {
    fail('GET single role by ID', single.data)
  } else {
    pass('GET single role by ID')
  }

  // PATCH rename
  const renamed = `${roleName}-renamed`
  const patch = await api('PATCH', `/api/settings/roles/${newRoleId}`, { name: renamed })
  if (!patch.ok || !patch.data?.ok) {
    fail('PATCH rename role', patch.data)
  } else {
    pass('PATCH rename role succeeds')
  }

  // DELETE the new role
  const del = await api('DELETE', `/api/settings/roles/${newRoleId}`)
  if (!del.ok || !del.data?.ok) {
    fail('DELETE custom role', del.data)
  } else {
    pass('DELETE custom role succeeds')
  }

  // DELETE system role should be rejected
  if (systemRole) {
    const delSystem = await api('DELETE', `/api/settings/roles/${systemRole.id}`)
    if (delSystem.status === 403 || delSystem.status === 400 || !delSystem.ok) {
      pass('DELETE system role correctly rejected')
    } else {
      fail('DELETE system role should be rejected', delSystem.data)
    }
  }

  // GET permissions list for role assignment
  const perms = await api('GET', '/api/settings/permissions')
  if (!perms.ok || !perms.data?.ok) {
    fail('GET permissions list', perms.data)
  } else {
    pass(`GET permissions list — ${perms.data.data.length} permission(s)`)
  }
}

// ─── Teams ────────────────────────────────────────────────────────────────────

async function testTeams() {
  console.log('\n👨‍👩‍👧 Teams')

  // GET list
  const list = await api('GET', '/api/settings/teams')
  if (!list.ok || !list.data?.ok) {
    fail('GET teams', list.data)
    return
  }
  pass(`GET teams list — ${list.data.data.length} team(s)`)

  // CREATE team
  const teamName = `Smoke-Team-${Date.now()}`
  const create = await api('POST', '/api/settings/teams', { name: teamName })
  if (!create.ok || !create.data?.ok) {
    fail('POST create team', create.data)
    return
  }
  pass(`POST create team "${teamName}"`)
  const newTeamId = create.data.data.id

  // DUPLICATE name should fail
  const dup = await api('POST', '/api/settings/teams', { name: teamName })
  if (dup.status === 409 || dup.status === 400) {
    pass('POST duplicate team name rejected')
  } else {
    fail('POST duplicate team name should be rejected', dup.data)
  }

  // GET single team
  const single = await api('GET', `/api/settings/teams/${newTeamId}`)
  if (!single.ok || !single.data?.ok) {
    fail('GET single team by ID', single.data)
  } else {
    pass('GET single team by ID')
  }

  // PATCH rename team
  const patch = await api('PATCH', `/api/settings/teams/${newTeamId}`, {
    name: `${teamName}-renamed`,
  })
  if (!patch.ok || !patch.data?.ok) {
    fail('PATCH rename team', patch.data)
  } else {
    pass('PATCH rename team succeeds')
  }

  // GET team members
  const members = await api('GET', `/api/settings/teams/${newTeamId}/members`)
  if (!members.ok || !members.data?.ok) {
    fail('GET team members', members.data)
  } else {
    pass(`GET team members — ${members.data.data.length} member(s)`)
  }

  // DELETE team
  const del = await api('DELETE', `/api/settings/teams/${newTeamId}`)
  if (!del.ok || !del.data?.ok) {
    fail('DELETE team', del.data)
  } else {
    pass('DELETE team succeeds')
  }
}

// ─── Campus ───────────────────────────────────────────────────────────────────

async function testCampus() {
  console.log('\n🏢 Campus')

  // GET buildings
  const bldgs = await api('GET', '/api/settings/campus/buildings')
  if (!bldgs.ok || !bldgs.data?.ok) {
    fail('GET buildings', bldgs.data)
    return
  }
  pass(`GET buildings — ${bldgs.data.data.length} building(s)`)

  // CREATE building
  const bldgName = `Smoke-Building-${Date.now()}`
  const createBldg = await api('POST', '/api/settings/campus/buildings', {
    name: bldgName,
    code: `SB${Date.now().toString().slice(-4)}`,
  })
  if (!createBldg.ok || !createBldg.data?.ok) {
    fail('POST create building', createBldg.data)
    return
  }
  pass(`POST create building "${bldgName}"`)
  const newBldgId = createBldg.data.data.id

  // PATCH building
  const patchBldg = await api('PATCH', `/api/settings/campus/buildings/${newBldgId}`, {
    name: `${bldgName}-updated`,
  })
  if (!patchBldg.ok || !patchBldg.data?.ok) {
    fail('PATCH building', patchBldg.data)
  } else {
    pass('PATCH building name succeeds')
  }

  // GET areas
  const areas = await api('GET', '/api/settings/campus/areas')
  if (!areas.ok || !areas.data?.ok) {
    fail('GET areas', areas.data)
  } else {
    pass(`GET areas — ${areas.data.data.length} area(s)`)
  }

  // CREATE area within building
  const areaName = `Smoke-Area-${Date.now()}`
  const createArea = await api('POST', '/api/settings/campus/areas', {
    name: areaName,
    buildingId: newBldgId,
  })
  let newAreaId = null
  if (!createArea.ok || !createArea.data?.ok) {
    fail('POST create area', createArea.data)
  } else {
    pass(`POST create area "${areaName}"`)
    newAreaId = createArea.data.data.id
  }

  // GET rooms
  const rooms = await api('GET', '/api/settings/campus/rooms')
  if (!rooms.ok || !rooms.data?.ok) {
    fail('GET rooms', rooms.data)
  } else {
    pass(`GET rooms — ${rooms.data.data.length} room(s)`)
  }

  // CREATE room in building
  const roomName = `Smoke-Room-${Date.now()}`
  const createRoom = await api('POST', '/api/settings/campus/rooms', {
    name: roomName,
    buildingId: newBldgId,
    ...(newAreaId ? { areaId: newAreaId } : {}),
  })
  let newRoomId = null
  if (!createRoom.ok || !createRoom.data?.ok) {
    fail('POST create room', createRoom.data)
  } else {
    pass(`POST create room "${roomName}"`)
    newRoomId = createRoom.data.data.id
  }

  // DELETE room
  if (newRoomId) {
    const delRoom = await api('DELETE', `/api/settings/campus/rooms/${newRoomId}`)
    if (!delRoom.ok || !delRoom.data?.ok) {
      fail('DELETE room', delRoom.data)
    } else {
      pass('DELETE room succeeds')
    }
  }

  // DELETE area
  if (newAreaId) {
    const delArea = await api('DELETE', `/api/settings/campus/areas/${newAreaId}`)
    if (!delArea.ok || !delArea.data?.ok) {
      fail('DELETE area', delArea.data)
    } else {
      pass('DELETE area succeeds')
    }
  }

  // DELETE building (soft-delete)
  const delBldg = await api('DELETE', `/api/settings/campus/buildings/${newBldgId}`)
  if (!delBldg.ok || !delBldg.data?.ok) {
    fail('DELETE building', delBldg.data)
  } else {
    pass('DELETE building succeeds')
  }
}

// ─── Permissions ──────────────────────────────────────────────────────────────

async function testPermissions() {
  console.log('\n🔑 Permissions')

  const list = await api('GET', '/api/settings/permissions')
  if (!list.ok || !list.data?.ok) {
    fail('GET permissions list', list.data)
    return
  }
  const perms = list.data.data
  pass(`GET permissions list — ${perms.length} permission(s)`)

  // Spot-check a few expected permissions exist
  const permStrings = perms.map(p => `${p.resource}:${p.action}${p.scope ? ':' + p.scope : ''}`)
  const expected = ['settings:read', 'settings:update', 'tickets:read:all', 'events:approve']
  const missing = expected.filter(p => !permStrings.includes(p))
  if (missing.length) {
    fail(`Permissions list missing expected entries: ${missing.join(', ')}`)
  } else {
    pass('Expected permissions (settings:read, settings:update, tickets:read:all, events:approve) present')
  }
}

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function testAuthGuards() {
  console.log('\n🚧 Auth Guards (unauthenticated requests should return 401/403)')

  const unauthHeaders = { 'Content-Type': 'application/json' }
  const protectedEndpoints = [
    ['/api/settings/school-info', 'GET'],
    ['/api/settings/users', 'GET'],
    ['/api/settings/roles', 'GET'],
    ['/api/settings/teams', 'GET'],
    ['/api/settings/campus/buildings', 'GET'],
    ['/api/settings/permissions', 'GET'],
  ]

  for (const [path, method] of protectedEndpoints) {
    const res = await fetch(`${BASE_URL}${path}`, { method, headers: unauthHeaders })
    if (res.status === 401 || res.status === 403) {
      pass(`${method} ${path} requires auth (${res.status})`)
    } else {
      fail(`${method} ${path} should require auth (got ${res.status})`)
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log(' Lionheart Settings Smoke Test')
  console.log('═══════════════════════════════════════════════════════')

  try {
    await login()
    await testSchoolInfo()
    await testMembers()
    await testRoles()
    await testTeams()
    await testCampus()
    await testPermissions()
    await testAuthGuards()
  } catch (err) {
    console.error('\n💥 Fatal error:', err.message)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }

  console.log('\n═══════════════════════════════════════════════════════')
  console.log(` Results: ${passed} passed, ${failed} failed`)
  if (failures.length) {
    console.log('\n Failed tests:')
    failures.forEach(f => console.log(`   • ${f.label}`))
  }
  console.log('═══════════════════════════════════════════════════════\n')

  if (failed > 0) process.exitCode = 1
}

main()
