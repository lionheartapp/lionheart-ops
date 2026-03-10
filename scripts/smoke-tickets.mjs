import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Use DIRECT_URL to bypass PgBouncer prepared statement restrictions
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
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

async function ensurePermission(resource, action, scope, createdPermissionIds) {
  let permission = await prisma.permission.findUnique({
    where: {
      resource_action_scope: {
        resource,
        action,
        scope,
      },
    },
  })

  if (!permission) {
    permission = await prisma.permission.create({
      data: {
        resource,
        action,
        scope,
        description: `Temporary smoke permission ${resource}:${action}:${scope}`,
      },
    })
    createdPermissionIds.push(permission.id)
  }

  return permission
}

async function ensureSmokeUser(organizationId) {
  const ts = Date.now().toString().slice(-8)
  const email = `smoke+tix${ts}@example.com`
  const password = 'Smoke123!'
  const passwordHash = await bcrypt.hash(password, 10)

  const createdPermissionIds = []

  // Ensure all ticket permissions exist
  const createPerm = await ensurePermission('tickets', 'create', 'global', createdPermissionIds)
  const readAllPerm = await ensurePermission('tickets', 'read', 'all', createdPermissionIds)
  const updateAllPerm = await ensurePermission('tickets', 'update', 'all', createdPermissionIds)
  const deletePerm = await ensurePermission('tickets', 'delete', 'global', createdPermissionIds)
  const assignPerm = await ensurePermission('tickets', 'assign', 'global', createdPermissionIds)

  const role = await prisma.role.create({
    data: {
      organizationId,
      name: `Smoke Ticket Role ${ts}`,
      slug: `smoke-tix-${ts}`,
      description: 'Temporary role for ticket API smoke tests',
      isSystem: false,
      permissions: {
        create: [
          { permissionId: createPerm.id },
          { permissionId: readAllPerm.id },
          { permissionId: updateAllPerm.id },
          { permissionId: deletePerm.id },
          { permissionId: assignPerm.id },
        ],
      },
    },
  })

  const user = await prisma.user.create({
    data: {
      organizationId,
      email,
      firstName: 'Smoke',
      lastName: 'Ticket',
      name: 'Smoke Ticket',
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

async function runTicketsSmoke(email, password, organizationId) {
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
  const results = {}
  let ticketId = null

  // ===== TIX-01: Edit via PUT =====

  // Test 1: POST /api/tickets — create a test ticket
  console.log('  Test 1: Create ticket...')
  const createTicket = await req('/api/tickets', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: `Smoke Test Ticket ${ts}`,
      description: 'Original description for smoke test',
      category: 'MAINTENANCE',
      priority: 'NORMAL',
      source: 'MANUAL',
      locationText: 'Room 101',
    }),
  })
  results.createTicket = createTicket.res.status
  if (createTicket.res.status !== 201 || !createTicket.json?.ok) {
    throw new Error(`Test 1 FAIL: Create ticket failed: ${createTicket.res.status} ${JSON.stringify(createTicket.json)}`)
  }
  ticketId = createTicket.json.data?.id
  if (!ticketId) throw new Error('Test 1 FAIL: Create ticket returned no id')
  console.log(`    PASS (201) id=${ticketId}`)

  // Test 2: GET /api/tickets/[id] — fetch by ID
  console.log('  Test 2: Get ticket by ID...')
  const getTicket = await req(`/api/tickets/${ticketId}`, { headers: authHeaders })
  results.getTicket = getTicket.res.status
  if (!getTicket.res.ok || !getTicket.json?.ok) {
    throw new Error(`Test 2 FAIL: Get ticket failed: ${getTicket.res.status} ${JSON.stringify(getTicket.json)}`)
  }
  if (getTicket.json.data?.id !== ticketId) {
    throw new Error(`Test 2 FAIL: Get ticket returned wrong id: ${getTicket.json.data?.id}`)
  }
  console.log(`    PASS (200)`)

  // Test 3: PUT /api/tickets/[id] — update title
  console.log('  Test 3: Update ticket (PUT)...')
  const updateTicket = await req(`/api/tickets/${ticketId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ title: 'Updated Title', priority: 'HIGH' }),
  })
  results.updateTicket = updateTicket.res.status
  if (!updateTicket.res.ok || !updateTicket.json?.ok) {
    throw new Error(`Test 3 FAIL: Update ticket failed: ${updateTicket.res.status} ${JSON.stringify(updateTicket.json)}`)
  }
  if (updateTicket.json.data?.title !== 'Updated Title') {
    throw new Error(`Test 3 FAIL: Update ticket returned wrong title: ${updateTicket.json.data?.title}`)
  }
  if (updateTicket.json.data?.priority !== 'HIGH') {
    throw new Error(`Test 3 FAIL: Update ticket returned wrong priority: ${updateTicket.json.data?.priority}`)
  }
  console.log(`    PASS (200) title="${updateTicket.json.data?.title}"`)

  // Test 4: GET /api/tickets/[id] — verify update persisted
  console.log('  Test 4: Verify update persisted...')
  const verifyUpdate = await req(`/api/tickets/${ticketId}`, { headers: authHeaders })
  results.verifyUpdate = verifyUpdate.res.status
  if (!verifyUpdate.res.ok || !verifyUpdate.json?.ok) {
    throw new Error(`Test 4 FAIL: Verify update failed: ${verifyUpdate.res.status} ${JSON.stringify(verifyUpdate.json)}`)
  }
  if (verifyUpdate.json.data?.title !== 'Updated Title') {
    throw new Error(`Test 4 FAIL: Update did not persist. Got title: ${verifyUpdate.json.data?.title}`)
  }
  console.log(`    PASS (200) title="${verifyUpdate.json.data?.title}"`)

  // ===== TIX-02: Comments =====

  // Test 5: POST /api/tickets/[id]/comments
  console.log('  Test 5: Create comment...')
  const createComment = await req(`/api/tickets/${ticketId}/comments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ body: 'Test comment from smoke test' }),
  })
  results.createComment = createComment.res.status
  if (createComment.res.status !== 201 || !createComment.json?.ok) {
    throw new Error(`Test 5 FAIL: Create comment failed: ${createComment.res.status} ${JSON.stringify(createComment.json)}`)
  }
  const commentId = createComment.json.data?.id
  if (!commentId) throw new Error('Test 5 FAIL: Create comment returned no id')
  console.log(`    PASS (201) commentId=${commentId}`)

  // Test 6: GET /api/tickets/[id]/comments
  console.log('  Test 6: List comments...')
  const listComments = await req(`/api/tickets/${ticketId}/comments`, { headers: authHeaders })
  results.listComments = listComments.res.status
  if (!listComments.res.ok || !listComments.json?.ok) {
    throw new Error(`Test 6 FAIL: List comments failed: ${listComments.res.status} ${JSON.stringify(listComments.json)}`)
  }
  const comments = listComments.json.data || []
  if (comments.length < 1) {
    throw new Error(`Test 6 FAIL: Expected at least 1 comment, got ${comments.length}`)
  }
  if (comments[0]?.body !== 'Test comment from smoke test') {
    throw new Error(`Test 6 FAIL: Comment body mismatch: ${comments[0]?.body}`)
  }
  console.log(`    PASS (200) count=${comments.length}`)

  // ===== TIX-02: Attachments =====

  // Test 7: POST /api/tickets/[id]/attachments
  console.log('  Test 7: Upload attachment...')
  const fileContent = Buffer.from('Hello, this is a test file').toString('base64')
  const createAttachment = await req(`/api/tickets/${ticketId}/attachments`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      fileName: 'test.pdf',
      fileBase64: fileContent,
      contentType: 'application/pdf',
    }),
  })
  results.createAttachment = createAttachment.res.status
  if (createAttachment.res.status !== 201 || !createAttachment.json?.ok) {
    throw new Error(`Test 7 FAIL: Create attachment failed: ${createAttachment.res.status} ${JSON.stringify(createAttachment.json)}`)
  }
  const attachmentId = createAttachment.json.data?.id
  if (!attachmentId) throw new Error('Test 7 FAIL: Create attachment returned no id')
  console.log(`    PASS (201) attachmentId=${attachmentId}`)

  // Test 8: GET /api/tickets/[id]/attachments
  console.log('  Test 8: List attachments...')
  const listAttachments = await req(`/api/tickets/${ticketId}/attachments`, { headers: authHeaders })
  results.listAttachments = listAttachments.res.status
  if (!listAttachments.res.ok || !listAttachments.json?.ok) {
    throw new Error(`Test 8 FAIL: List attachments failed: ${listAttachments.res.status} ${JSON.stringify(listAttachments.json)}`)
  }
  const attachments = listAttachments.json.data || []
  if (attachments.length < 1) {
    throw new Error(`Test 8 FAIL: Expected at least 1 attachment, got ${attachments.length}`)
  }
  console.log(`    PASS (200) count=${attachments.length}`)

  // ===== TIX-03: Search =====

  // Test 9: GET /api/tickets?search=Updated — should find updated ticket
  console.log('  Test 9: Search tickets (match)...')
  const searchMatch = await req(`/api/tickets?search=Updated+Title`, { headers: authHeaders })
  results.searchMatch = searchMatch.res.status
  if (!searchMatch.res.ok || !searchMatch.json?.ok) {
    throw new Error(`Test 9 FAIL: Search tickets failed: ${searchMatch.res.status} ${JSON.stringify(searchMatch.json)}`)
  }
  const searchResults = Array.isArray(searchMatch.json.data)
    ? searchMatch.json.data
    : searchMatch.json.data?.tickets || []
  const foundInSearch = searchResults.some((t) => t.id === ticketId)
  if (!foundInSearch) {
    throw new Error(`Test 9 FAIL: Ticket with "Updated Title" not found in search results (got ${searchResults.length} results)`)
  }
  console.log(`    PASS (200) found=${foundInSearch} count=${searchResults.length}`)

  // Test 10: GET /api/tickets?search=nonexistent_xyz_12345 — should return empty
  console.log('  Test 10: Search tickets (no match)...')
  const searchNoMatch = await req('/api/tickets?search=nonexistent_xyz_12345', { headers: authHeaders })
  results.searchNoMatch = searchNoMatch.res.status
  if (!searchNoMatch.res.ok || !searchNoMatch.json?.ok) {
    throw new Error(`Test 10 FAIL: Search no-match failed: ${searchNoMatch.res.status} ${JSON.stringify(searchNoMatch.json)}`)
  }
  const noMatchResults = Array.isArray(searchNoMatch.json.data)
    ? searchNoMatch.json.data
    : searchNoMatch.json.data?.tickets || []
  const noMatchFound = noMatchResults.some((t) => t.id === ticketId)
  if (noMatchFound) {
    throw new Error('Test 10 FAIL: Ticket unexpectedly found in no-match search')
  }
  console.log(`    PASS (200) count=${noMatchResults.length}`)

  // Cleanup: DELETE /api/tickets/[id]
  console.log('  Cleanup: Delete test ticket...')
  const deleteTicket = await req(`/api/tickets/${ticketId}`, {
    method: 'DELETE',
    headers: authHeaders,
  })
  if (!deleteTicket.res.ok || !deleteTicket.json?.ok) {
    console.warn(`  Cleanup WARNING: Delete ticket failed: ${deleteTicket.res.status}`)
  } else {
    console.log(`    Deleted ticketId=${ticketId}`)
    ticketId = null
  }

  return { checks: results, ticketId }
}

async function main() {
  let smokeUser = null
  let ticketId = null

  try {
    const organizationId = await resolveOrganizationId()
    smokeUser = await ensureSmokeUser(organizationId)

    console.log(`\nRunning ticket smoke tests against ${baseUrl}`)
    console.log(`Organization: ${organizationId}`)
    console.log(`Smoke user: ${smokeUser.email}\n`)

    const result = await runTicketsSmoke(smokeUser.email, smokeUser.password, organizationId)
    ticketId = result.ticketId

    console.log('\nAll 10 ticket smoke tests passed')
    console.log(
      JSON.stringify(
        {
          organizationId,
          smokeUserRole: smokeUser.roleName,
          ...result,
        },
        null,
        2
      )
    )
  } catch (err) {
    console.error('\nTicket smoke test FAILED:', err.message)
    process.exitCode = 1
  } finally {
    // Clean up smoke user and role
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
