#!/usr/bin/env node
/**
 * smoke-phase22.mjs
 *
 * Smoke tests for Phase 22 — AI, Budget, Notifications & External Integrations.
 * Tests run against a live dev server and validate key API behaviors.
 *
 * Usage:
 *   node scripts/smoke-phase22.mjs                        # run all tests
 *   node scripts/smoke-phase22.mjs --test=budget-list     # run single test
 *
 * Environment variables:
 *   BASE_URL         — defaults to http://localhost:3004
 *   AUTH_TOKEN       — staff JWT for auth-required tests
 *   TEST_PROJECT_ID  — event project cuid for project-scoped tests
 *
 * Most tests are SKIP stubs — they document the test contract
 * and will be filled in during manual testing or future CI integration.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3004'
const AUTH_TOKEN = process.env.AUTH_TOKEN || ''
const TEST_PROJECT_ID = process.env.TEST_PROJECT_ID || ''

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

function projectRequired() {
  if (!TEST_PROJECT_ID) skip('TEST_PROJECT_ID not set — skipping project-scoped test')
}

// ─── Budget Tests ─────────────────────────────────────────────────────────────

/**
 * budget-list: GET /api/events/projects/{id}/budget
 * Returns budget categories and line items in spreadsheet format.
 */
async function testBudgetList() {
  skip('not implemented — requires AUTH_TOKEN and TEST_PROJECT_ID with budget data')
}

/**
 * budget-create-line-item: POST /api/events/projects/{id}/budget
 * Creates a new budget line item under a category.
 */
async function testBudgetCreateLineItem() {
  skip('not implemented — requires AUTH_TOKEN and TEST_PROJECT_ID')
}

/**
 * budget-update-line-item: PATCH /api/events/projects/{id}/budget/{lineId}
 * Updates an existing budget line item (amount, description, vendor).
 */
async function testBudgetUpdateLineItem() {
  skip('not implemented — requires AUTH_TOKEN, TEST_PROJECT_ID, and a lineId')
}

/**
 * budget-delete-line-item: DELETE /api/events/projects/{id}/budget/{lineId}
 * Removes a budget line item (hard delete for accounting integrity).
 */
async function testBudgetDeleteLineItem() {
  skip('not implemented — requires AUTH_TOKEN, TEST_PROJECT_ID, and a lineId')
}

/**
 * budget-revenue-list: GET /api/events/projects/{id}/budget/revenue
 * Returns revenue entries (registration fees, sponsorships, etc.).
 */
async function testBudgetRevenueList() {
  skip('not implemented — requires AUTH_TOKEN and TEST_PROJECT_ID')
}

/**
 * budget-revenue-create: POST /api/events/projects/{id}/budget/revenue
 * Creates a revenue entry with source, amount, and description.
 */
async function testBudgetRevenueCreate() {
  skip('not implemented — requires AUTH_TOKEN and TEST_PROJECT_ID')
}

/**
 * budget-report: GET /api/events/projects/{id}/budget/report
 * Returns a budget summary with per-participant cost calculation.
 * Requires at least one line item and expected attendance set.
 */
async function testBudgetReport() {
  skip('not implemented — requires AUTH_TOKEN, TEST_PROJECT_ID with line items and attendance set')
}

// ─── Notification Tests ───────────────────────────────────────────────────────

/**
 * notification-rules-list: GET /api/events/projects/{id}/notifications
 * Returns all notification rules for an event project with timeline data.
 */
async function testNotificationRulesList() {
  skip('not implemented — requires AUTH_TOKEN and TEST_PROJECT_ID')
}

/**
 * notification-rule-create: POST /api/events/projects/{id}/notifications
 * Creates a DATE_BASED notification rule with offsetDays and message body.
 */
async function testNotificationRuleCreate() {
  skip('not implemented — requires AUTH_TOKEN and TEST_PROJECT_ID')
}

/**
 * notification-rule-approve: POST /api/events/projects/{id}/notifications/{ruleId}/approve
 * Transitions a PENDING_APPROVAL rule to APPROVED for cron dispatch.
 */
async function testNotificationRuleApprove() {
  skip('not implemented — requires AUTH_TOKEN, TEST_PROJECT_ID, and a PENDING_APPROVAL ruleId')
}

// ─── AI Tests ─────────────────────────────────────────────────────────────────

/**
 * ai-create-from-description: POST /api/events/ai/create-from-description
 * AI event creation from natural language description — requires GEMINI_API_KEY.
 * Returns structured EventProject data (not yet saved).
 */
async function testAiCreateFromDescription() {
  skip('not implemented — requires AUTH_TOKEN and GEMINI_API_KEY set on server')
}

/**
 * ai-generate-schedule: POST /api/events/ai/generate-schedule
 * Generates a detailed schedule from event overview data.
 * Returns array of schedule blocks with start/end times.
 */
async function testAiGenerateSchedule() {
  skip('not implemented — requires AUTH_TOKEN, TEST_PROJECT_ID, and GEMINI_API_KEY')
}

/**
 * ai-generate-form: POST /api/events/ai/generate-form
 * Generates a registration form schema from event context.
 * Returns array of form field definitions.
 */
async function testAiGenerateForm() {
  skip('not implemented — requires AUTH_TOKEN, TEST_PROJECT_ID, and GEMINI_API_KEY')
}

/**
 * ai-generate-groups: POST /api/events/ai/generate-groups
 * Generates group assignments using dietary/medical data.
 * Returns proposed group structure and participant assignments.
 */
async function testAiGenerateGroups() {
  skip('not implemented — requires AUTH_TOKEN, TEST_PROJECT_ID with registrations, and GEMINI_API_KEY')
}

/**
 * ai-detect-conflicts: POST /api/events/ai/detect-conflicts
 * Deterministic conflict detection — checks room, staff, transportation, and audience overlaps.
 * Does not require GEMINI_API_KEY (no AI, pure DB query).
 */
async function testAiDetectConflicts() {
  skip('not implemented — requires AUTH_TOKEN and TEST_PROJECT_ID')
}

/**
 * ai-estimate-budget: POST /api/events/ai/estimate-budget
 * Estimates budget from historical event data (requires 3+ completed events with budget).
 * Falls back to AI estimation when insufficient history.
 */
async function testAiEstimateBudget() {
  skip('not implemented — requires AUTH_TOKEN, TEST_PROJECT_ID, and 3+ completed events with budget data')
}

/**
 * ai-generate-summary: POST /api/events/ai/generate-summary
 * Generates a narrative status summary for board reports.
 * Two-phase pattern: ?skipAI=true returns raw metrics immediately.
 */
async function testAiGenerateSummary() {
  skip('not implemented — requires AUTH_TOKEN, TEST_PROJECT_ID, and GEMINI_API_KEY')
}

/**
 * ai-analyze-feedback: POST /api/events/ai/analyze-feedback
 * Analyzes survey responses and produces thematic summary with sentiment.
 * Requires at least one completed survey with responses.
 */
async function testAiAnalyzeFeedback() {
  skip('not implemented — requires AUTH_TOKEN, TEST_PROJECT_ID with survey responses, and GEMINI_API_KEY')
}

// ─── Template Tests ───────────────────────────────────────────────────────────

/**
 * templates-list: GET /api/events/templates
 * Returns all event templates for the org (global + org-specific).
 */
async function testTemplatesList() {
  skip('not implemented — requires AUTH_TOKEN')
}

/**
 * templates-save: POST /api/events/templates
 * Saves a confirmed/completed EventProject as a reusable template.
 * Uses day-offset serialization for portable date handling.
 */
async function testTemplatesSave() {
  skip('not implemented — requires AUTH_TOKEN and a CONFIRMED TEST_PROJECT_ID')
}

/**
 * templates-create-from: POST /api/events/templates/{id}
 * Creates a new EventProject from an existing template.
 * Resolves day-offsets to absolute dates based on new event start date.
 */
async function testTemplatesCreateFrom() {
  skip('not implemented — requires AUTH_TOKEN and an existing template ID')
}

// ─── Integration Tests ────────────────────────────────────────────────────────

/**
 * integrations-twilio-config: GET /api/integrations/twilio/config
 * Returns Twilio integration status for the org (configured/not configured).
 * Never returns raw credentials.
 */
async function testIntegrationsTwilioConfig() {
  skip('not implemented — requires AUTH_TOKEN')
}

/**
 * integrations-pco-auth: GET /api/integrations/planning-center/auth
 * Returns OAuth authorization URL for Planning Center connection.
 * Returns 503 if PLANNING_CENTER_APP_ID not set.
 */
async function testIntegrationsPcoAuth() {
  skip('not implemented — requires AUTH_TOKEN')
}

/**
 * integrations-google-calendar-auth: GET /api/integrations/google-calendar/auth
 * Returns Google OAuth authorization URL for per-user calendar connection.
 * Returns 503 if GOOGLE_CLIENT_ID not set.
 */
async function testIntegrationsGoogleCalendarAuth() {
  skip('not implemented — requires AUTH_TOKEN')
}

// ─── Test Map ─────────────────────────────────────────────────────────────────

const TESTS = {
  // Budget (7 tests)
  'budget-list': testBudgetList,
  'budget-create-line-item': testBudgetCreateLineItem,
  'budget-update-line-item': testBudgetUpdateLineItem,
  'budget-delete-line-item': testBudgetDeleteLineItem,
  'budget-revenue-list': testBudgetRevenueList,
  'budget-revenue-create': testBudgetRevenueCreate,
  'budget-report': testBudgetReport,

  // Notifications (3 tests)
  'notification-rules-list': testNotificationRulesList,
  'notification-rule-create': testNotificationRuleCreate,
  'notification-rule-approve': testNotificationRuleApprove,

  // AI (8 tests)
  'ai-create-from-description': testAiCreateFromDescription,
  'ai-generate-schedule': testAiGenerateSchedule,
  'ai-generate-form': testAiGenerateForm,
  'ai-generate-groups': testAiGenerateGroups,
  'ai-detect-conflicts': testAiDetectConflicts,
  'ai-estimate-budget': testAiEstimateBudget,
  'ai-generate-summary': testAiGenerateSummary,
  'ai-analyze-feedback': testAiAnalyzeFeedback,

  // Templates (3 tests)
  'templates-list': testTemplatesList,
  'templates-save': testTemplatesSave,
  'templates-create-from': testTemplatesCreateFrom,

  // Integrations (3 tests)
  'integrations-twilio-config': testIntegrationsTwilioConfig,
  'integrations-pco-auth': testIntegrationsPcoAuth,
  'integrations-google-calendar-auth': testIntegrationsGoogleCalendarAuth,
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

    console.log(`smoke-phase22: running test "${targetTest}" against ${BASE_URL}`)
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

  console.log(`smoke-phase22: running ${Object.keys(TESTS).length} tests against ${BASE_URL}`)
  if (!AUTH_TOKEN) {
    console.log(`  ${YELLOW}Note: AUTH_TOKEN not set — auth-required tests will be skipped${RESET}`)
    console.log(
      `  Set AUTH_TOKEN and TEST_PROJECT_ID to run the full suite`,
    )
  }
  console.log('')

  console.log(`  ${YELLOW}Budget (7 tests)${RESET}`)
  for (const name of ['budget-list', 'budget-create-line-item', 'budget-update-line-item', 'budget-delete-line-item', 'budget-revenue-list', 'budget-revenue-create', 'budget-report']) {
    await runTest(name, TESTS[name])
  }

  console.log('')
  console.log(`  ${YELLOW}Notifications (3 tests)${RESET}`)
  for (const name of ['notification-rules-list', 'notification-rule-create', 'notification-rule-approve']) {
    await runTest(name, TESTS[name])
  }

  console.log('')
  console.log(`  ${YELLOW}AI Features (8 tests)${RESET}`)
  for (const name of ['ai-create-from-description', 'ai-generate-schedule', 'ai-generate-form', 'ai-generate-groups', 'ai-detect-conflicts', 'ai-estimate-budget', 'ai-generate-summary', 'ai-analyze-feedback']) {
    await runTest(name, TESTS[name])
  }

  console.log('')
  console.log(`  ${YELLOW}Templates (3 tests)${RESET}`)
  for (const name of ['templates-list', 'templates-save', 'templates-create-from']) {
    await runTest(name, TESTS[name])
  }

  console.log('')
  console.log(`  ${YELLOW}Integrations (3 tests)${RESET}`)
  for (const name of ['integrations-twilio-config', 'integrations-pco-auth', 'integrations-google-calendar-auth']) {
    await runTest(name, TESTS[name])
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
  console.error('smoke-phase22: unexpected error', err)
  process.exit(1)
})
