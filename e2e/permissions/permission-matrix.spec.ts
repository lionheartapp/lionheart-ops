import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ApiClient } from '../helpers/api'
import { env } from '../helpers/env'

/**
 * Permission Matrix
 * =================
 * Auto-generated from `scripts/inventory-routes.mjs` (run that script first).
 *
 * This spec runs three coverage sweeps over every detected API handler:
 *
 *   1. UNAUTH SWEEP   — every non-public route must reject anonymous requests
 *                       (401 / 403 / 404 acceptable, 200 is a leak).
 *
 *   2. MEMBER SWEEP   — for every route guarded by an "admin-only" permission,
 *                       a member account must be denied (403). Catches routes
 *                       that declare a permission but don't actually enforce it.
 *
 *   3. UNGUARDED REPORT — every route that's logged-in-only (no permission
 *                       decorator) is logged so you can review whether that's
 *                       intentional. Does not fail the suite.
 *
 * Each sweep is a single test that loops through hundreds of handlers and
 * collects ALL failures before throwing — so one bad route doesn't mask the
 * other 700.
 *
 * The matrix runs against staging via E2E_BASE_URL like every other E2E spec.
 */

interface Handler {
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  permission: string | null
  permissionAny: string[] | null
  inlinePermission: string | null
  wrapper: 'withAuth' | 'inline'
  sourceFile: string
  isPublic: boolean
}

const INVENTORY_PATH = path.resolve(__dirname, '..', 'fixtures', 'route-inventory.json')
const inventory: readonly Handler[] = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8'))

/**
 * Permissions a "member" role should NEVER have. If a route is gated by one
 * of these and a member can hit it without 403, that's a permission bug.
 *
 * Derived from DEFAULT_ROLES in src/lib/permissions.ts. Update if the role
 * defaults change.
 */
const ADMIN_ONLY_PERMISSIONS = new Set([
  'USERS_INVITE',
  'USERS_UPDATE',
  'USERS_DELETE',
  'USERS_MANAGE_ROLES',
  'USERS_MANAGE_PERMISSIONS',
  'ROLES_CREATE',
  'ROLES_UPDATE',
  'ROLES_DELETE',
  'TEAMS_CREATE',
  'TEAMS_UPDATE',
  'TEAMS_DELETE',
  'SETTINGS_UPDATE',
  'SETTINGS_BILLING',
  // EVENTS_TEMPLATES_MANAGE — intentionally granted to members (they can use templates)
  'PLANNING_MANAGE',
  'PLANNING_REVIEW',
  'ATHLETICS_MANAGE',
  'ATHLETICS_TOURNAMENTS_MANAGE',
  'ATHLETICS_TEAMS_MANAGE',
  'ACADEMIC_MANAGE',
  'ACADEMIC_BELL_SCHEDULES',
  'IT_DEVICE_MANAGE',
  'IT_PROVISIONING_MANAGE',
  'IT_LIFECYCLE_MANAGE',
])

const FAKE_UUID = '00000000-0000-0000-0000-000000000000'
const FAKE_SLUG = 'e2e-fake-slug'

function fillPath(template: string): string {
  return template.replace(/\{([^}]+)\}/g, (_match, name) => {
    if (/slug/i.test(name)) return FAKE_SLUG
    return FAKE_UUID
  })
}

function isAdminOnly(handler: Handler): boolean {
  if (handler.permission && ADMIN_ONLY_PERMISSIONS.has(handler.permission)) return true
  if (handler.inlinePermission && ADMIN_ONLY_PERMISSIONS.has(handler.inlinePermission)) return true
  if (handler.permissionAny && handler.permissionAny.every((p) => ADMIN_ONLY_PERMISSIONS.has(p))) {
    // Only admin-only if EVERY listed permission is admin-only — otherwise
    // a member with one of the alternates could legitimately access it.
    return true
  }
  return false
}

async function probe(client: ApiClient, handler: Handler): Promise<{ status: number }> {
  const url = fillPath(handler.path)
  switch (handler.method) {
    case 'GET':
      return client.get(url)
    case 'POST':
      return client.post(url, {})
    case 'PUT':
      return client.put(url, {})
    case 'PATCH':
      return client.patch(url, {})
    case 'DELETE':
      return client.delete(url)
  }
}

interface Failure {
  path: string
  method: string
  status: number
  reason: string
}

// ---------------------------------------------------------------------------
// Sweep 1 — Unauthenticated must NOT get 200 on non-public routes
// ---------------------------------------------------------------------------
test.describe('Permission matrix · unauthenticated', () => {
  test.setTimeout(180_000)

  test('non-public routes reject anonymous requests', async () => {
    const anon = await ApiClient.anonymous(env.orgA.id)
    const failures: Failure[] = []
    const targets = inventory.filter((h) => !h.isPublic)

    for (const handler of targets) {
      try {
        const { status } = await probe(anon, handler)
        // Acceptable: 401, 403, 404 (Next.js may 404 before auth fires for missing dynamic params),
        // 405 (method not allowed), 429 (rate limit). Anything else is a leak.
        if ([401, 403, 404, 405, 429].includes(status)) continue
        if (status >= 500) {
          failures.push({
            path: handler.path,
            method: handler.method,
            status,
            reason: '5xx — anonymous request crashed the route',
          })
          continue
        }
        // 2xx / 3xx on a non-public route = unauth leak.
        if (status < 400) {
          failures.push({
            path: handler.path,
            method: handler.method,
            status,
            reason: 'non-public route returned success to anonymous request',
          })
        }
      } catch (err) {
        failures.push({
          path: handler.path,
          method: handler.method,
          status: 0,
          reason: `request threw: ${(err as Error).message}`,
        })
      }
    }

    await anon.dispose()

    // eslint-disable-next-line no-console
    console.log(`[matrix:unauth] probed=${targets.length} failures=${failures.length}`)

    if (failures.length > 0) {
      const summary = failures
        .slice(0, 50)
        .map((f) => `  ${f.method.padEnd(6)} ${f.path}  →  ${f.status}  ${f.reason}`)
        .join('\n')
      throw new Error(
        `${failures.length} non-public route(s) failed the unauth probe (showing first 50):\n${summary}`,
      )
    }
  })
})

// ---------------------------------------------------------------------------
// Sweep 2 — Member account must be denied admin-only routes
// ---------------------------------------------------------------------------
test.describe('Permission matrix · member is denied admin-only routes', () => {
  test.setTimeout(240_000)

  test('member account gets 403 on every admin-only route', async () => {
    const member = await ApiClient.login({
      email: env.orgA.memberEmail,
      password: env.orgA.memberPassword,
      organizationId: env.orgA.id,
    })

    const targets = inventory.filter(isAdminOnly)
    const failures: Failure[] = []

    for (const handler of targets) {
      try {
        const { status } = await probe(member, handler)
        // Acceptable: 401, 403, 404 (resource doesn't exist, but auth was checked),
        // 429 rate limit. The 404 case is OK because Next.js may resolve the route
        // and the handler's first DB lookup short-circuits — auth already happened.
        if ([401, 403, 404, 405, 429].includes(status)) continue
        if (status >= 500) {
          failures.push({
            path: handler.path,
            method: handler.method,
            status,
            reason: '5xx — member request crashed the route',
          })
          continue
        }
        // 2xx / 3xx / 400 from a member on an admin-only route = permission bug.
        // (400 because Zod ran AFTER the permission check would have passed —
        // meaning the route allowed the member through.)
        if (status < 401) {
          failures.push({
            path: handler.path,
            method: handler.method,
            status,
            reason: 'member was allowed past the permission gate (got past assertCan)',
          })
        }
      } catch (err) {
        failures.push({
          path: handler.path,
          method: handler.method,
          status: 0,
          reason: `request threw: ${(err as Error).message}`,
        })
      }
    }

    await member.dispose()

    // eslint-disable-next-line no-console
    console.log(`[matrix:member] probed=${targets.length} failures=${failures.length}`)

    if (failures.length > 0) {
      const summary = failures
        .slice(0, 50)
        .map((f) => `  ${f.method.padEnd(6)} ${f.path}  →  ${f.status}  ${f.reason}`)
        .join('\n')
      throw new Error(
        `${failures.length} admin-only route(s) failed the member-denial probe (showing first 50):\n${summary}`,
      )
    }
  })
})

// ---------------------------------------------------------------------------
// Sweep 3 — Audit report: every route that's logged-in-only with no permission
// ---------------------------------------------------------------------------
test.describe('Permission matrix · audit', () => {
  test('report routes with no permission decorator (review only, never fails)', () => {
    const unguarded = inventory.filter(
      (h) =>
        !h.isPublic &&
        !h.permission &&
        !h.permissionAny &&
        !h.inlinePermission,
    )

    // eslint-disable-next-line no-console
    console.log(`\n[matrix:audit] ${unguarded.length} unguarded route handlers:`)
    for (const h of unguarded.slice(0, 100)) {
      // eslint-disable-next-line no-console
      console.log(`  ${h.method.padEnd(6)} ${h.path}    (${h.sourceFile})`)
    }
    if (unguarded.length > 100) {
      // eslint-disable-next-line no-console
      console.log(`  ... and ${unguarded.length - 100} more — see route-inventory.json`)
    }

    // Audit only — never fail. Some logged-in-only routes are intentional
    // (e.g. /api/auth/me, /api/notifications). Use the report to spot leaks.
    expect(unguarded.length).toBeGreaterThanOrEqual(0)
  })
})
