import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Use DIRECT_URL to avoid pgbouncer transaction mode limitations
// (prepared statement conflicts with Supabase connection pooler)
const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
})
const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3004'
const preferredOrgSlug = process.env.SMOKE_ORG_SLUG || 'demo'

async function req(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, options)
  let json = null
  try {
    json = await res.json()
  } catch {}
  return { res, json }
}

async function resolveOrganizationId() {
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

async function ensurePermission(resource, action, createdPermissionIds) {
  let permission = await prisma.permission.findUnique({
    where: {
      resource_action_scope: {
        resource,
        action,
        scope: 'global',
      },
    },
  })

  if (!permission) {
    permission = await prisma.permission.create({
      data: {
        resource,
        action,
        scope: 'global',
        description: `Temporary smoke permission ${resource}:${action}:global`,
      },
    })
    createdPermissionIds.push(permission.id)
  }

  return permission
}

async function ensureSmokeUser(organizationId) {
  const ts = Date.now().toString().slice(-8)
  const email = `smoke+evt${ts}@example.com`
  const password = 'Smoke123!'
  const passwordHash = await bcrypt.hash(password, 10)

  const createdPermissionIds = []

  // Ensure all event permissions exist
  const eventsReadPerm = await ensurePermission('events', 'read', createdPermissionIds)
  const eventsCreatePerm = await ensurePermission('events', 'create', createdPermissionIds)
  const eventsUpdateOwnPerm = await ensurePermission('events', 'update', createdPermissionIds)
  const eventsDeletePerm = await ensurePermission('events', 'delete', createdPermissionIds)
  const eventsApprovePerm = await ensurePermission('events', 'approve', createdPermissionIds)

  const role = await prisma.role.create({
    data: {
      organizationId,
      name: `Smoke Events Role ${ts}`,
      slug: `smoke-evt-${ts}`,
      description: 'Temporary role for draft events API smoke tests',
      isSystem: false,
      permissions: {
        create: [
          { permissionId: eventsReadPerm.id },
          { permissionId: eventsCreatePerm.id },
          { permissionId: eventsUpdateOwnPerm.id },
          { permissionId: eventsDeletePerm.id },
          { permissionId: eventsApprovePerm.id },
        ],
      },
    },
  })

  const user = await prisma.user.create({
    data: {
      organizationId,
      email,
      firstName: 'Smoke',
      lastName: 'Events',
      name: 'Smoke Events',
      passwordHash,
      status: 'ACTIVE',
      emailVerified: true,
      roleId: role.id,
      schoolScope: 'GLOBAL',
    },
  })

  return {
    userId: user.id,
    email,
    password,
    roleId: role.id,
    roleName: role.name,
    createdPermissionIds,
  }
}

function pass(label) {
  console.log(`  PASS  ${label}`)
}

function fail(label, detail) {
  console.error(`  FAIL  ${label}${detail ? ': ' + detail : ''}`)
  process.exitCode = 1
}

async function runDraftEventsSmoke(email, password, organizationId) {
  // Login to get auth token
  const login = await req('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, organizationId }),
  })

  if (!login.res.ok || !login.json?.ok) {
    throw new Error(`Login failed: ${login.res.status} ${JSON.stringify(login.json)}`)
  }

  // Support both cookie-based and token-based auth
  const token = login.json.data?.token
  const setCookie = login.res.headers.get('set-cookie')

  let authHeaders
  if (setCookie) {
    const cookieValue = setCookie.split(';')[0]
    authHeaders = {
      Cookie: cookieValue,
      'X-Organization-ID': organizationId,
      'Content-Type': 'application/json',
    }
  } else if (token) {
    authHeaders = {
      Authorization: `Bearer ${token}`,
      'X-Organization-ID': organizationId,
      'Content-Type': 'application/json',
    }
  } else {
    throw new Error(`Login succeeded but no auth credential returned: ${JSON.stringify(login.json)}`)
  }

  const ts = Date.now().toString().slice(-6)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Base dates for draft event tests
  const draftStartsAt = new Date(today)
  draftStartsAt.setDate(draftStartsAt.getDate() + 7)
  draftStartsAt.setHours(9, 0, 0, 0)
  const draftEndsAt = new Date(draftStartsAt)
  draftEndsAt.setHours(10, 0, 0, 0)

  // Base dates for conflict tests (different day to avoid overlap with draft tests)
  const conflictDay = new Date(today)
  conflictDay.setDate(conflictDay.getDate() + 14)

  const roomName = `Smoke Test Room ${ts}`

  // ========================
  // CAL-01: Draft Event CRUD
  // ========================
  console.log('\nCAL-01: Draft Event CRUD lifecycle')

  // Test 1: Create a draft event
  const createDraft = await req('/api/draft-events', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: `Smoke Draft Event ${ts}`,
      room: roomName,
      startsAt: draftStartsAt.toISOString(),
      endsAt: draftEndsAt.toISOString(),
    }),
  })
  let draftId = null
  if (createDraft.res.status === 201 && createDraft.json?.ok) {
    draftId = createDraft.json.data.id
    pass('1. POST /api/draft-events — creates draft (201)')
  } else {
    fail('1. POST /api/draft-events — creates draft (201)', `status=${createDraft.res.status} body=${JSON.stringify(createDraft.json)}`)
    // Cannot continue without a draft ID
    return
  }

  // Test 2: GET draft by ID
  const getDraft = await req(`/api/draft-events/${draftId}`, { headers: authHeaders })
  if (getDraft.res.status === 200 && getDraft.json?.ok && getDraft.json.data.title === `Smoke Draft Event ${ts}`) {
    pass('2. GET /api/draft-events/[id] — returns draft data (200)')
  } else {
    fail('2. GET /api/draft-events/[id] — returns draft data (200)', `status=${getDraft.res.status} title=${getDraft.json?.data?.title}`)
  }

  // Test 3: PUT — update draft title
  const updateDraft = await req(`/api/draft-events/${draftId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ title: `Updated Draft Event ${ts}` }),
  })
  if (updateDraft.res.status === 200 && updateDraft.json?.ok && updateDraft.json.data.title === `Updated Draft Event ${ts}`) {
    pass('3. PUT /api/draft-events/[id] — updates draft title (200)')
  } else {
    fail('3. PUT /api/draft-events/[id] — updates draft title (200)', `status=${updateDraft.res.status} title=${updateDraft.json?.data?.title}`)
  }

  // Test 4: GET again to verify update persisted
  const getUpdated = await req(`/api/draft-events/${draftId}`, { headers: authHeaders })
  if (getUpdated.res.status === 200 && getUpdated.json?.data?.title === `Updated Draft Event ${ts}`) {
    pass('4. GET /api/draft-events/[id] — update persisted (200)')
  } else {
    fail('4. GET /api/draft-events/[id] — update persisted (200)', `title=${getUpdated.json?.data?.title}`)
  }

  // Test 5: DELETE draft
  const deleteDraft = await req(`/api/draft-events/${draftId}`, {
    method: 'DELETE',
    headers: authHeaders,
  })
  if (deleteDraft.res.status === 200 && deleteDraft.json?.ok && deleteDraft.json.data.deleted === true) {
    pass('5. DELETE /api/draft-events/[id] — deletes draft (200)')
  } else {
    fail('5. DELETE /api/draft-events/[id] — deletes draft (200)', `status=${deleteDraft.res.status}`)
  }

  // Test 6: GET after delete — expect 404
  const getDeleted = await req(`/api/draft-events/${draftId}`, { headers: authHeaders })
  if (getDeleted.res.status === 404) {
    pass('6. GET /api/draft-events/[id] — returns 404 after deletion')
  } else {
    fail('6. GET /api/draft-events/[id] — returns 404 after deletion', `status=${getDeleted.res.status}`)
  }

  // ========================
  // CAL-02: Room Conflict Detection
  // ========================
  console.log('\nCAL-02: Room conflict detection')

  const conflictRoom = `Conflict Room ${ts}`
  const t10 = new Date(conflictDay)
  t10.setHours(10, 0, 0, 0)
  const t11 = new Date(conflictDay)
  t11.setHours(11, 0, 0, 0)
  const t1030 = new Date(conflictDay)
  t1030.setHours(10, 30, 0, 0)
  const t1130 = new Date(conflictDay)
  t1130.setHours(11, 30, 0, 0)
  const t12 = new Date(conflictDay)
  t12.setHours(12, 0, 0, 0)
  const t13 = new Date(conflictDay)
  t13.setHours(13, 0, 0, 0)

  // Test 7: Create first event (10:00–11:00) — should succeed
  const createEvent1 = await req('/api/events', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: `Conflict Base Event ${ts}`,
      room: conflictRoom,
      startsAt: t10.toISOString(),
      endsAt: t11.toISOString(),
    }),
  })
  let event1Id = null
  if (createEvent1.res.status === 201 && createEvent1.json?.ok) {
    event1Id = createEvent1.json.data.id
    pass('7. POST /api/events — creates event in room (201)')
  } else {
    fail('7. POST /api/events — creates event in room (201)', `status=${createEvent1.res.status} body=${JSON.stringify(createEvent1.json)}`)
  }

  // Test 8: Create overlapping event (10:30–11:30) — should get 409
  const createEvent2 = await req('/api/events', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: `Conflicting Event ${ts}`,
      room: conflictRoom,
      startsAt: t1030.toISOString(),
      endsAt: t1130.toISOString(),
    }),
  })
  if (createEvent2.res.status === 409 && createEvent2.json?.error?.code === 'ROOM_CONFLICT') {
    pass('8. POST /api/events — overlapping event returns 409 ROOM_CONFLICT')
  } else {
    fail('8. POST /api/events — overlapping event returns 409 ROOM_CONFLICT', `status=${createEvent2.res.status} code=${createEvent2.json?.error?.code}`)
  }

  // Test 9: Non-overlapping event (12:00–13:00) — should succeed
  const createEvent3 = await req('/api/events', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: `Non-Overlapping Event ${ts}`,
      room: conflictRoom,
      startsAt: t12.toISOString(),
      endsAt: t13.toISOString(),
    }),
  })
  let event3Id = null
  if (createEvent3.res.status === 201 && createEvent3.json?.ok) {
    event3Id = createEvent3.json.data.id
    pass('9. POST /api/events — non-overlapping same room succeeds (201)')
  } else {
    fail('9. POST /api/events — non-overlapping same room succeeds (201)', `status=${createEvent3.res.status} body=${JSON.stringify(createEvent3.json)}`)
  }

  // Test 10: Case-insensitive conflict (lowercase room name, overlapping 10:30–11:30) — should 409
  const createEvent4 = await req('/api/events', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: `Case Insensitive Conflict ${ts}`,
      room: conflictRoom.toLowerCase(),
      startsAt: t1030.toISOString(),
      endsAt: t1130.toISOString(),
    }),
  })
  if (createEvent4.res.status === 409 && createEvent4.json?.error?.code === 'ROOM_CONFLICT') {
    pass('10. POST /api/events — case-insensitive room conflict returns 409 ROOM_CONFLICT')
  } else {
    fail('10. POST /api/events — case-insensitive room conflict returns 409 ROOM_CONFLICT', `status=${createEvent4.res.status} code=${createEvent4.json?.error?.code}`)
  }

  // Cleanup: delete created events
  const eventIdsToDelete = [event1Id, event3Id].filter(Boolean)
  for (const eventId of eventIdsToDelete) {
    await req(`/api/events/${eventId}`, { method: 'DELETE', headers: authHeaders }).catch(() => {})
  }
}

async function main() {
  let smokeUser = null

  try {
    const organizationId = await resolveOrganizationId()
    smokeUser = await ensureSmokeUser(organizationId)

    console.log('Running draft events and room conflict smoke tests...')
    await runDraftEventsSmoke(smokeUser.email, smokeUser.password, organizationId)

    if (process.exitCode === 1) {
      console.log('\nDraft events smoke test FAILED — see failures above')
    } else {
      console.log('\nDraft events smoke test PASSED')
      console.log(
        JSON.stringify(
          {
            organizationId,
            smokeUserRole: smokeUser.roleName,
          },
          null,
          2
        )
      )
    }
  } catch (err) {
    console.error('Draft events smoke test FAILED:', err.message)
    process.exitCode = 1
  } finally {
    if (smokeUser?.userId) {
      await prisma.user.delete({ where: { id: smokeUser.userId } }).catch(() => {})
    }

    if (smokeUser?.roleId) {
      await prisma.role.delete({ where: { id: smokeUser.roleId } }).catch(() => {})
    }

    if (Array.isArray(smokeUser?.createdPermissionIds) && smokeUser.createdPermissionIds.length > 0) {
      await prisma.permission.deleteMany({
        where: {
          id: {
            in: smokeUser.createdPermissionIds,
          },
        },
      }).catch(() => {})
    }

    await prisma.$disconnect()
  }
}

main()
