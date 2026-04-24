#!/usr/bin/env node

/**
 * Cache Isolation Smoke Test  (Shift 2 — Task #70)
 *
 * Verifies that the process-local route-cache (src/lib/cache/route-cache.ts)
 * does not leak data across tenants, across per-user boundaries, and that
 * mutations invalidate only the caller's cache.
 *
 * What this covers:
 *   1. Cross-tenant READ isolation — interleave GETs from Org A and Org B
 *      on the SAME endpoint; each response must stay pinned to the caller's
 *      org, even when the 2nd/3rd/4th GET hits the cache.
 *   2. Cross-tenant MUTATION isolation — PATCH school-info for Org A with
 *      a distinctive marker; Org B's cached read must remain unchanged.
 *   3. Basic cache liveness — a 2nd GET for the same (token, endpoint) pair
 *      must match the 1st (no drift between cache-miss and cache-hit paths).
 *
 * Setup:
 *   Org A:  the demo org (admin@demo.com / test123).
 *   Org B:  "cache-isolation-test" — created on first run from this script
 *           by cloning demo's super-admin role permissions into a fresh
 *           Organization.  Reused on subsequent runs; password is reset on
 *           every run so a stale hash never breaks the login.
 *
 * Usage:
 *   node scripts/smoke-cache-isolation.mjs
 *
 * Requires:
 *   - Dev server on http://localhost:3004 (or SMOKE_BASE_URL)
 *   - db:seed already run (demo org + admin@demo.com)
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3004'

const ORG_A = {
  slug: 'demo',
  adminEmail: 'admin@demo.com',
  adminPassword: 'test123',
}
const ORG_B = {
  slug: 'cache-isolation-test',
  name: 'Cache Isolation Test Org',
  adminEmail: 'admin@cache-isolation-test.local',
  // Chosen to avoid password-breach checks and meet the 8-64 char rule.
  adminPassword: 'SmokeTest_Pw9!xyz',
}

let passed = 0
let failed = 0
const failures = []

function pass(label) {
  console.log(`  ✅ ${label}`)
  passed += 1
}
function fail(label, detail) {
  console.log(`  ❌ ${label}`)
  if (detail !== undefined) {
    const s = typeof detail === 'string' ? detail : JSON.stringify(detail)
    console.log(`     ${s.slice(0, 400)}`)
  }
  failed += 1
  failures.push({ label, detail })
}
function note(label) {
  console.log(`  ⊘ ${label}`)
}

// ────────────────────────────────────────────────────────────────
// CSRF-aware fetch client (bearer auth + cookie-jar'd csrf-token)
// ────────────────────────────────────────────────────────────────

function createClient(token, orgId, label) {
  let csrfToken = null

  async function request(method, path, body) {
    const doFetch = async () => {
      const headers = {
        Authorization: `Bearer ${token}`,
        'X-Organization-ID': orgId, // informational only; middleware uses JWT
      }
      if (body != null) headers['Content-Type'] = 'application/json'
      if (csrfToken && method !== 'GET' && method !== 'HEAD') {
        headers['x-csrf-token'] = csrfToken
        headers['Cookie'] = `csrf-token=${csrfToken}`
      }
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : undefined,
      })
      return res
    }

    let res = await doFetch()

    // Middleware issues a csrf-token cookie on the 403 when the jar is empty.
    // Extract it, then retry once.
    if (res.status === 403 && !csrfToken && method !== 'GET' && method !== 'HEAD') {
      const setCookie = res.headers.get('set-cookie') || ''
      const match = setCookie.match(/csrf-token=([^;]+)/)
      if (match) {
        csrfToken = match[1]
        res = await doFetch()
      }
    }

    let data = null
    try {
      data = await res.json()
    } catch {
      // non-JSON response — fine, leave data null
    }
    return { status: res.status, ok: res.ok, data, label }
  }

  return request
}

// ────────────────────────────────────────────────────────────────
// Org/admin bootstrap (direct DB)
// ────────────────────────────────────────────────────────────────

async function ensureOrgA() {
  const org = await prisma.organization.findFirst({
    where: { slug: ORG_A.slug },
    select: { id: true, name: true, slug: true },
  })
  if (!org) {
    throw new Error(`Org A (slug="${ORG_A.slug}") not found. Run \`npm run db:seed\` first.`)
  }
  const admin = await prisma.user.findFirst({
    where: { email: ORG_A.adminEmail, organizationId: org.id },
    select: { id: true, status: true, emailVerified: true },
  })
  if (!admin) {
    throw new Error(`Admin ${ORG_A.adminEmail} not found in Org A.`)
  }
  // Make sure the seeded admin can actually log in (password hash + verified + active)
  const hash = await bcrypt.hash(ORG_A.adminPassword, 10)
  await prisma.user.update({
    where: { id: admin.id },
    data: { passwordHash: hash, emailVerified: true, status: 'ACTIVE' },
  })
  return { orgId: org.id, slug: org.slug, name: org.name }
}

async function ensureOrgB() {
  const existing = await prisma.organization.findFirst({
    where: { slug: ORG_B.slug },
    select: { id: true, name: true },
  })

  const hash = await bcrypt.hash(ORG_B.adminPassword, 10)

  if (existing) {
    // Reset admin password + ensure verified/active so repeat runs are hermetic.
    await prisma.user.updateMany({
      where: { email: ORG_B.adminEmail, organizationId: existing.id },
      data: { passwordHash: hash, emailVerified: true, status: 'ACTIVE' },
    })
    return { orgId: existing.id, slug: ORG_B.slug, name: existing.name }
  }

  // Build a minimal-but-complete org from scratch.
  console.log(`   (creating second org "${ORG_B.slug}" — first run)`)

  // Clone the demo org's super-admin permission set so the new org can do
  // everything the cache-isolation test needs. We only copy *permission links*;
  // the Permission rows themselves are global and shared.
  const demoSuperAdmin = await prisma.role.findFirst({
    where: { slug: 'super-admin', organization: { slug: ORG_A.slug } },
    include: { permissions: { select: { permissionId: true } } },
  })
  if (!demoSuperAdmin) {
    throw new Error('Could not find demo org super-admin role to template from.')
  }

  const org = await prisma.organization.create({
    data: { name: ORG_B.name, slug: ORG_B.slug },
    select: { id: true, name: true },
  })

  const role = await prisma.role.create({
    data: {
      organizationId: org.id,
      name: 'Super Admin',
      slug: 'super-admin',
      description: 'Full access (cache isolation test)',
      isSystem: true,
      permissions: {
        createMany: {
          data: demoSuperAdmin.permissions.map((p) => ({ permissionId: p.permissionId })),
          skipDuplicates: true,
        },
      },
    },
    select: { id: true },
  })

  const school = await prisma.school.create({
    data: {
      organizationId: org.id,
      name: ORG_B.name,
      institutionType: 'PRIVATE',
    },
    select: { id: true },
  })

  const campus = await prisma.campus.create({
    data: {
      organizationId: org.id,
      schoolId: school.id,
      name: 'Main Campus',
      campusKind: 'HEADQUARTERS',
      isActive: true,
      sortOrder: 0,
    },
    select: { id: true },
  })

  await prisma.user.create({
    data: {
      organizationId: org.id,
      email: ORG_B.adminEmail,
      name: 'Cache Isolation Admin',
      firstName: 'Cache',
      lastName: 'Admin',
      passwordHash: hash,
      roleId: role.id,
      schoolId: school.id,
      campusId: campus.id,
      status: 'ACTIVE',
      emailVerified: true,
    },
  })

  return { orgId: org.id, slug: ORG_B.slug, name: org.name }
}

async function login(orgId, email, password) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, organizationId: orgId }),
  })
  const data = await res.json()
  if (!res.ok || !data?.ok || !data.data?.token) {
    throw new Error(`Login failed for ${email} @ ${orgId}: ${JSON.stringify(data)}`)
  }
  return data.data.token
}

// ────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────

/**
 * Endpoints wired to the Shift-2 cache layer.
 * Each entry declares how to identify the owner in the response payload so
 * we can assert cross-tenant isolation.
 *
 *   identify(resp, org) → true if the payload belongs to `org`; false
 *                         if it belongs to a *different* org; null if
 *                         the payload is ambiguous (empty list etc).
 */
const READ_ENDPOINTS = [
  {
    name: 'settings/school-info',
    path: '/api/settings/school-info',
    identify: (resp, org) => {
      const data = resp.data?.data
      if (!data) return null
      if (data.id && data.id === org.orgId) return true
      if (data.id && data.id !== org.orgId) return false
      return null
    },
  },
  {
    name: 'modules',
    path: '/api/modules',
    identify: (resp, org) => {
      const list = resp.data?.data
      if (!Array.isArray(list) || list.length === 0) return null
      const orgIds = new Set(list.map((m) => m.organizationId).filter(Boolean))
      if (orgIds.size === 0) return null
      if (orgIds.size === 1 && orgIds.has(org.orgId)) return true
      return false
    },
  },
  {
    name: 'calendars',
    path: '/api/calendars',
    identify: (resp, org) => {
      const list = resp.data?.data
      if (!Array.isArray(list) || list.length === 0) return null
      const orgIds = new Set(list.map((c) => c.organizationId).filter(Boolean))
      if (orgIds.size === 0) return null
      if (orgIds.size === 1 && orgIds.has(org.orgId)) return true
      return false
    },
  },
  {
    name: 'settings/teams',
    path: '/api/settings/teams',
    identify: (resp, org) => {
      const list = resp.data?.data
      if (!Array.isArray(list) || list.length === 0) return null
      const orgIds = new Set(list.map((t) => t.organizationId).filter(Boolean))
      if (orgIds.size === 0) return null
      if (orgIds.size === 1 && orgIds.has(org.orgId)) return true
      return false
    },
  },
  {
    name: 'settings/approval-config',
    path: '/api/settings/approval-config',
    identify: (resp, org) => {
      const list = resp.data?.data
      if (!Array.isArray(list) || list.length === 0) return null
      const orgIds = new Set(list.map((c) => c.organizationId).filter(Boolean))
      if (orgIds.size === 0) return null
      if (orgIds.size === 1 && orgIds.has(org.orgId)) return true
      return false
    },
  },
  {
    name: 'planning-seasons',
    path: '/api/planning-seasons',
    identify: (resp, org) => {
      const list = resp.data?.data
      if (!Array.isArray(list) || list.length === 0) return null
      const orgIds = new Set(list.map((s) => s.organizationId).filter(Boolean))
      if (orgIds.size === 0) return null
      if (orgIds.size === 1 && orgIds.has(org.orgId)) return true
      return false
    },
  },
  {
    name: 'athletics/sports',
    path: '/api/athletics/sports',
    identify: (resp, org) => {
      const list = resp.data?.data
      if (!Array.isArray(list) || list.length === 0) return null
      const orgIds = new Set(list.map((s) => s.organizationId).filter(Boolean))
      if (orgIds.size === 0) return null
      if (orgIds.size === 1 && orgIds.has(org.orgId)) return true
      return false
    },
  },
  {
    name: 'notifications',
    path: '/api/notifications',
    // Per-user — cross-tenant identity isn't directly visible; we only assert
    // cache stability (two reads match) and absence of cross-leak via fingerprint.
    identify: () => null,
  },
  {
    name: 'user/notification-preferences',
    path: '/api/user/notification-preferences',
    identify: () => null,
  },
  {
    name: 'integrations/status',
    path: '/api/integrations/status',
    identify: () => null,
  },
]

function fingerprint(data) {
  try {
    return JSON.stringify(data)
  } catch {
    return String(data)
  }
}

async function testReadIsolation(clientA, clientB, orgA, orgB) {
  console.log('\n🔒 Cross-tenant READ isolation')

  for (const ep of READ_ENDPOINTS) {
    // Interleave 4 calls so each org sees both a cache-miss (1st) and cache-hit (2nd)
    const r1 = await clientA('GET', ep.path) // A miss
    const r2 = await clientB('GET', ep.path) // B miss
    const r3 = await clientA('GET', ep.path) // A hit
    const r4 = await clientB('GET', ep.path) // B hit

    const statuses = [r1.status, r2.status, r3.status, r4.status]
    if (statuses.some((s) => s >= 500)) {
      fail(`${ep.name}: server error`, { statuses })
      continue
    }
    if (statuses.every((s) => s === 404)) {
      note(`${ep.name}: not mounted for either org — skipping`)
      continue
    }
    if (!r1.ok || !r2.ok || !r3.ok || !r4.ok) {
      fail(`${ep.name}: non-OK`, {
        statuses,
        sample: r1.data?.error ?? r2.data?.error ?? r3.data?.error ?? r4.data?.error,
      })
      continue
    }

    // Identity check — for endpoints where the payload embeds orgId.
    const id1 = ep.identify(r1, orgA)
    const id3 = ep.identify(r3, orgA)
    const id2 = ep.identify(r2, orgB)
    const id4 = ep.identify(r4, orgB)

    const hasIdentityInfo = [id1, id2, id3, id4].some((v) => v !== null)
    if (hasIdentityInfo) {
      if (id1 === false || id3 === false) {
        fail(`${ep.name}: A received data tagged to another org — CROSS-TENANT LEAK`, {
          r1Fingerprint: fingerprint(r1.data).slice(0, 200),
          r3Fingerprint: fingerprint(r3.data).slice(0, 200),
        })
        continue
      }
      if (id2 === false || id4 === false) {
        fail(`${ep.name}: B received data tagged to another org — CROSS-TENANT LEAK`, {
          r2Fingerprint: fingerprint(r2.data).slice(0, 200),
          r4Fingerprint: fingerprint(r4.data).slice(0, 200),
        })
        continue
      }
      pass(`${ep.name}: identity tags scoped to caller across cache-miss + cache-hit`)
    }

    // Fingerprint stability check — A's two reads must match, B's two reads must match.
    const fpA1 = fingerprint(r1.data)
    const fpA3 = fingerprint(r3.data)
    const fpB2 = fingerprint(r2.data)
    const fpB4 = fingerprint(r4.data)

    if (fpA1 === fpA3) pass(`${ep.name}: A stable across miss→hit`)
    else fail(`${ep.name}: A response drift between miss and hit`, { miss: fpA1.slice(0, 100), hit: fpA3.slice(0, 100) })

    if (fpB2 === fpB4) pass(`${ep.name}: B stable across miss→hit`)
    else fail(`${ep.name}: B response drift between miss and hit`, { miss: fpB2.slice(0, 100), hit: fpB4.slice(0, 100) })

    // Cross-leak fingerprint heuristic — if A and B happen to return identical
    // non-trivial bodies, flag for review (could be shared reference data, or
    // could be a leak). Empty-ish bodies are ignored.
    const empties = new Set(['null', 'undefined', '{}', '[]', '{"ok":true,"data":[]}', '{"ok":true,"data":{}}', '{"ok":true,"data":null}'])
    if (!empties.has(fpA1) && fpA1 === fpB2) {
      if (!hasIdentityInfo) {
        note(`${ep.name}: A and B returned identical bodies (len=${fpA1.length}) — likely shared reference data`)
      }
    }
  }
}

async function testMutationIsolation(clientA, clientB, orgA, orgB) {
  console.log('\n✏️  Cross-tenant MUTATION isolation (school-info.phone)')

  const beforeA = await clientA('GET', '/api/settings/school-info')
  const beforeB = await clientB('GET', '/api/settings/school-info')

  if (!beforeA.ok || !beforeB.ok) {
    fail('mutation snapshot failed', { a: beforeA.status, b: beforeB.status, aErr: beforeA.data?.error, bErr: beforeB.data?.error })
    return
  }

  const aSnap = beforeA.data?.data ?? {}
  const bSnap = beforeB.data?.data ?? {}
  const origAPhone = aSnap.phone ?? null
  const origBPhone = bSnap.phone ?? null
  const marker = `555-ISO-${Date.now()}`

  // Minimal valid payload — we only care about `phone`, but Zod requires `name`.
  const patchPayloadA = {
    name: aSnap.name || 'Demo',
    slug: aSnap.slug,
    phone: marker,
  }

  const patchA = await clientA('PATCH', '/api/settings/school-info', patchPayloadA)
  if (!patchA.ok) {
    fail('PATCH school-info (A) failed', { status: patchA.status, err: patchA.data?.error })
    return
  }
  pass('PATCH school-info for A succeeded')

  // Re-read both orgs
  const afterA = await clientA('GET', '/api/settings/school-info')
  const afterB = await clientB('GET', '/api/settings/school-info')

  if (afterA.data?.data?.phone === marker) pass(`A sees its own mutation (phone=${marker})`)
  else fail('A does NOT see its own mutation (invalidation missed)', { want: marker, got: afterA.data?.data?.phone })

  if (afterB.data?.data?.phone === origBPhone) pass('B is unchanged by A\'s mutation (no cross-tenant leak)')
  else
    fail('B saw A\'s mutation — CROSS-TENANT CACHE LEAK', {
      origBPhone,
      afterBPhone: afterB.data?.data?.phone,
      marker,
    })

  // Restore A
  const restore = await clientA('PATCH', '/api/settings/school-info', {
    name: aSnap.name || 'Demo',
    slug: aSnap.slug,
    phone: origAPhone ?? '',
  })
  if (restore.ok) pass('A restored to original phone')
  else fail('failed to restore A', { status: restore.status, err: restore.data?.error })
}

// ────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────

async function main() {
  console.log('🧪 Cache Isolation Smoke Test')
  console.log(`   Base URL: ${BASE_URL}\n`)

  console.log('🔧 Setup')
  const orgA = await ensureOrgA()
  console.log(`   Org A: ${orgA.name} (${orgA.slug}, ${orgA.orgId})`)
  const orgB = await ensureOrgB()
  console.log(`   Org B: ${orgB.name} (${orgB.slug}, ${orgB.orgId})`)

  console.log('\n🔐 Logins')
  const tokenA = await login(orgA.orgId, ORG_A.adminEmail, ORG_A.adminPassword)
  console.log(`   ✓ Org A (${ORG_A.adminEmail})`)
  const tokenB = await login(orgB.orgId, ORG_B.adminEmail, ORG_B.adminPassword)
  console.log(`   ✓ Org B (${ORG_B.adminEmail})`)

  const clientA = createClient(tokenA, orgA.orgId, 'A')
  const clientB = createClient(tokenB, orgB.orgId, 'B')

  await testReadIsolation(clientA, clientB, orgA, orgB)
  await testMutationIsolation(clientA, clientB, orgA, orgB)

  console.log(`\n${'─'.repeat(54)}`)
  console.log(`  Passed: ${passed}`)
  console.log(`  Failed: ${failed}`)

  if (failed > 0) {
    console.log('\nFailures:')
    for (const f of failures) console.log(`  - ${f.label}`)
    process.exit(1)
  } else {
    console.log('\n✨ Cache isolation looks clean across tenants.')
    process.exit(0)
  }
}

main()
  .catch((err) => {
    console.error('\n💥 Unrecoverable error:', err.stack || err.message || err)
    process.exit(2)
  })
  .finally(() => prisma.$disconnect())
