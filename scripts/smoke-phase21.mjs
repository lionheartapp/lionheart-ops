#!/usr/bin/env node
/**
 * smoke-phase21.mjs
 *
 * Smoke tests for Phase 21 — Documents, Groups, Communication & Day-Of Tools.
 * Tests run against a live dev server and validate key API behaviors.
 *
 * Usage:
 *   node scripts/smoke-phase21.mjs                        # run all tests
 *   node scripts/smoke-phase21.mjs --test=check-in        # run single test
 *
 * Environment variables:
 *   BASE_URL         — defaults to http://localhost:3004
 *   AUTH_TOKEN       — staff JWT for auth-required tests
 *   TEST_PROJECT_ID  — event project cuid for project-scoped tests
 *   TEST_REG_ID      — registration cuid for participant self-service tests
 *
 * Most tests are currently SKIP stubs — they document the test contract
 * and will be filled in during manual testing or future CI integration.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3004'
const AUTH_TOKEN = process.env.AUTH_TOKEN || ''
const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID || ''
const TEST_REG_ID = process.env.TEST_REG_ID || ''

// ─── Color helpers ────────────────────────────────────────────────────────────

const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const YELLOW = '\x1b[33m'
const RESET = '\x1b[0m'

// ─── Test Runner ──────────────────────────────────────────────────────────────

let passed = 0
let failed = 0
let skipped = 0

/**
 * @param {string} name
 * @param {() => Promise<void>} fn
 */
async function runTest(name, fn) {
  try {
    await fn()
    console.log(`  ${GREEN}PASS${RESET} ${name}`)
    passed++
  } catch (/** @type {any} */ err) {
    if (err && err.skip) {
      console.log(`  ${YELLOW}SKIP${RESET} ${name} — ${err.message}`)
      skipped++
    } else {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  ${RED}FAIL${RESET} ${name} — ${msg}`)
      failed++
    }
  }
}

function skip(reason) {
  const err = new Error(reason)
  err.skip = true
  throw err
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function authHeaders() {
  if (!AUTH_TOKEN) skip('AUTH_TOKEN not set — skipping auth-required test')
  return {
    Authorization: `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

/**
 * doc-requirements-crud: POST/GET/DELETE document requirement for an event project.
 * Validates document requirements can be created, listed, and removed.
 */
async function testDocRequirementsCrud() {
  skip('not implemented — requires AUTH_TOKEN and TEST_PROJECT_ID with seed data')
}

/**
 * doc-completion-matrix: GET document completion matrix.
 * Returns required documents per participant with completion status.
 */
async function testDocCompletionMatrix() {
  skip('not implemented — requires AUTH_TOKEN and TEST_PROJECT_ID with registrations')
}

/**
 * doc-compliance-crud: POST/GET/DELETE compliance item.
 * Validates compliance checklist items can be created, listed, and removed.
 */
async function testDocComplianceCrud() {
  skip('not implemented — requires AUTH_TOKEN and TEST_PROJECT_ID')
}

/**
 * group-crud: POST/GET/DELETE group.
 * Validates groups (bus, cabin, small-group, activity) can be managed.
 */
async function testGroupCrud() {
  skip('not implemented — requires AUTH_TOKEN and TEST_PROJECT_ID')
}

/**
 * group-assignment: POST/DELETE group assignment.
 * Validates participants can be assigned to and removed from groups.
 */
async function testGroupAssignment() {
  skip('not implemented — requires AUTH_TOKEN, TEST_PROJECT_ID, group ID, and registration ID')
}

/**
 * group-auto-assign: POST auto-assign participants to groups.
 * Validates the round-robin auto-assignment algorithm distributes participants evenly.
 */
async function testGroupAutoAssign() {
  skip('not implemented — requires AUTH_TOKEN, TEST_PROJECT_ID, and existing groups + registrations')
}

/**
 * activity-crud: POST/GET/DELETE activity.
 * Validates optional activity sessions can be created, listed, and removed.
 */
async function testActivityCrud() {
  skip('not implemented — requires AUTH_TOKEN and TEST_PROJECT_ID')
}

/**
 * activity-signup: POST/DELETE activity signup.
 * Validates participants can be signed up for and removed from activities.
 */
async function testActivitySignup() {
  skip('not implemented — requires AUTH_TOKEN, TEST_PROJECT_ID, activity ID, and registration ID')
}

/**
 * dietary-medical-report: GET dietary/medical aggregation report.
 * Validates FERPA gate — requires events:medical:read permission.
 *
 * This is a SECURITY test — validates the medical data permission gate.
 */
async function testDietaryMedicalReport() {
  if (!TEST_PROJECT_ID) {
    // Test the permission gate with a fake project ID
    let res
    try {
      res = await fetch(
        `${BASE_URL}/api/events/projects/smoke-test-invalid-id/dietary-medical`,
        {
          method: 'GET',
          // Deliberately no Authorization header
        },
      )
    } catch {
      skip('Dev server not running — skipping network test')
    }
    // Without auth, must return 401 — never 200
    assert(
      res.status === 401 || res.status === 403 || res.status === 404,
      `Expected 401/403/404 for unauthenticated dietary-medical access, got ${res.status}`,
    )
    return
  }

  skip('Full dietary-medical test requires AUTH_TOKEN with events:medical:read permission')
}

/**
 * announcement-crud: POST/GET/DELETE announcement.
 * Validates event announcements can be created, listed, and soft-deleted.
 */
async function testAnnouncementCrud() {
  skip('not implemented — requires AUTH_TOKEN and TEST_PROJECT_ID')
}

/**
 * survey-crud: POST/GET/DELETE survey.
 * Validates surveys can be created, listed, and removed.
 */
async function testSurveyCrud() {
  skip('not implemented — requires AUTH_TOKEN and TEST_PROJECT_ID')
}

/**
 * check-in: POST check-in for a registration.
 * Validates staff can check in participants via QR scan.
 */
async function testCheckIn() {
  skip('not implemented — requires AUTH_TOKEN, TEST_PROJECT_ID, and a valid registration ID')
}

/**
 * check-in-counter: GET check-in counter for real-time headcount.
 * Returns total/checked-in counts for dashboard display.
 */
async function testCheckInCounter() {
  if (!TEST_PROJECT_ID) {
    // Validate the route exists and requires auth
    let res
    try {
      res = await fetch(
        `${BASE_URL}/api/events/projects/smoke-test-invalid-id/check-in`,
        {
          method: 'GET',
        },
      )
    } catch {
      skip('Dev server not running — skipping network test')
    }
    // Without auth, must return 401 — the route should exist
    assert(
      res.status === 401 || res.status === 403 || res.status === 404,
      `Expected 401/403/404 for unauthenticated check-in counter, got ${res.status}`,
    )
    return
  }

  skip('Full check-in-counter test requires AUTH_TOKEN and TEST_PROJECT_ID')
}

/**
 * incident-crud: POST/GET incident.
 * Validates safety incidents can be reported and listed.
 */
async function testIncidentCrud() {
  skip('not implemented — requires AUTH_TOKEN and TEST_PROJECT_ID')
}

/**
 * participant-self-service: GET /api/events/check-in/{regId} (public route).
 * Validates the public self-service endpoint returns participant info without auth.
 * registrationId is used as the access token (non-guessable cuid).
 *
 * This is a SECURITY test — validates the route is public but registration-ID-gated.
 */
async function testParticipantSelfService() {
  // Test with a clearly invalid registration ID
  // Should return 404 (not found) — NOT 401 (unauthorized)
  let res
  try {
    res = await fetch(
      `${BASE_URL}/api/events/check-in/smoke-test-invalid-reg-id`,
      {
        method: 'GET',
        // No auth header — this is a PUBLIC route
      },
    )
  } catch {
    skip('Dev server not running — skipping network test')
  }

  // Must NOT return 401 — this is a public endpoint
  assert(
    res.status !== 401,
    `Participant self-service returned 401 — route must be public, got ${res.status}`,
  )

  // Should return 404 for an invalid registration ID
  assert(
    res.status === 404 || res.status === 200,
    `Expected 404 (invalid reg) or 200 (valid reg), got ${res.status}`,
  )
}

/**
 * presence-heartbeat: POST/GET/DELETE presence for real-time collaboration.
 * Validates staff presence can be registered, listed, and removed.
 */
async function testPresenceHeartbeat() {
  skip('not implemented — requires AUTH_TOKEN and TEST_PROJECT_ID')
}

/**
 * parent-announcements: GET /api/registration/{regId}/announcements (public route).
 * Validates parent portal can read announcements for their registration without staff auth.
 * registrationId is used as the access token.
 *
 * This is a SECURITY test — validates the route is public but registration-ID-gated.
 */
async function testParentAnnouncements() {
  if (!TEST_REG_ID) {
    // Test with a clearly invalid registration ID
    // Should return 404 (not found) or 200 — NOT 401 (unauthorized)
    let res
    try {
      res = await fetch(
        `${BASE_URL}/api/registration/smoke-test-invalid-reg-id/announcements`,
        {
          method: 'GET',
          // No auth header — this is a PUBLIC route
        },
      )
    } catch {
      skip('Dev server not running — skipping network test')
    }

    // Must NOT return 401 — this is a public endpoint
    assert(
      res.status !== 401,
      `Parent announcements returned 401 — route must be public, got ${res.status}`,
    )
    return
  }

  let res
  try {
    res = await fetch(
      `${BASE_URL}/api/registration/${TEST_REG_ID}/announcements`,
      {
        method: 'GET',
      },
    )
  } catch {
    skip('Dev server not running — skipping network test')
  }

  assert(
    res.status !== 401,
    `Parent announcements returned 401 with valid TEST_REG_ID — route must be public`,
  )
  assert(res.ok, `Parent announcements returned ${res.status}`)
}

/**
 * parent-groups: GET /api/registration/{regId}/groups (public route).
 * Validates parent portal can read group assignments for their registration without staff auth.
 */
async function testParentGroups() {
  if (!TEST_REG_ID) {
    let res
    try {
      res = await fetch(
        `${BASE_URL}/api/registration/smoke-test-invalid-reg-id/groups`,
        {
          method: 'GET',
          // No auth header — this is a PUBLIC route
        },
      )
    } catch {
      skip('Dev server not running — skipping network test')
    }

    // Must NOT return 401 — this is a public endpoint
    assert(
      res.status !== 401,
      `Parent groups returned 401 — route must be public, got ${res.status}`,
    )
    return
  }

  let res
  try {
    res = await fetch(
      `${BASE_URL}/api/registration/${TEST_REG_ID}/groups`,
      {
        method: 'GET',
      },
    )
  } catch {
    skip('Dev server not running — skipping network test')
  }

  assert(
    res.status !== 401,
    `Parent groups returned 401 with valid TEST_REG_ID — route must be public`,
  )
  assert(res.ok, `Parent groups returned ${res.status}`)
}

// ─── Test Map ─────────────────────────────────────────────────────────────────

const TESTS = {
  'doc-requirements-crud': testDocRequirementsCrud,
  'doc-completion-matrix': testDocCompletionMatrix,
  'doc-compliance-crud': testDocComplianceCrud,
  'group-crud': testGroupCrud,
  'group-assignment': testGroupAssignment,
  'group-auto-assign': testGroupAutoAssign,
  'activity-crud': testActivityCrud,
  'activity-signup': testActivitySignup,
  'dietary-medical-report': testDietaryMedicalReport,
  'announcement-crud': testAnnouncementCrud,
  'survey-crud': testSurveyCrud,
  'check-in': testCheckIn,
  'check-in-counter': testCheckInCounter,
  'incident-crud': testIncidentCrud,
  'participant-self-service': testParticipantSelfService,
  'presence-heartbeat': testPresenceHeartbeat,
  'parent-announcements': testParentAnnouncements,
  'parent-groups': testParentGroups,
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const testArg = args.find((a) => a.startsWith('--test='))
  const targetTest = testArg ? testArg.replace('--test=', '') : null

  if (targetTest) {
    const fn = TESTS[targetTest]
    if (!fn) {
      console.error(`ERROR: Unknown test name "${targetTest}"`)
      console.error(`Available tests: ${Object.keys(TESTS).join(', ')}`)
      process.exit(1)
    }

    console.log(`smoke-phase21: running test "${targetTest}" against ${BASE_URL}`)
    console.log('')
    await runTest(targetTest, fn)
    console.log('')
    console.log(
      failed > 0
        ? `${RED}FAILED${RESET}`
        : skipped > 0
          ? `${YELLOW}DONE (with skips)${RESET}`
          : `${GREEN}PASSED${RESET}`,
    )
    process.exit(failed > 0 ? 1 : 0)
  }

  console.log(`smoke-phase21: running ${Object.keys(TESTS).length} tests against ${BASE_URL}`)
  if (!AUTH_TOKEN) {
    console.log(`  ${YELLOW}Note: AUTH_TOKEN not set — auth-required tests will be skipped${RESET}`)
    console.log(
      `  Set AUTH_TOKEN, TEST_PROJECT_ID, TEST_REG_ID to run the full suite`,
    )
  }
  console.log('')

  for (const [name, fn] of Object.entries(TESTS)) {
    await runTest(name, fn)
  }

  console.log('')
  console.log(
    `Results: ${GREEN}${passed} passed${RESET}, ${YELLOW}${skipped} skipped${RESET}, ${failed > 0 ? RED : ''}${failed} failed${RESET}`,
  )

  if (failed > 0) {
    process.exit(1)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('smoke-phase21: unexpected error', err)
  process.exit(1)
})
