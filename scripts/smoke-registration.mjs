#!/usr/bin/env node
/**
 * smoke-registration.mjs
 *
 * Wave 0 smoke test stub for Phase 20 registration requirements.
 * All 13 REG requirement test cases are stubbed here so downstream plans
 * can reference targeted test commands during verification.
 *
 * Usage:
 *   node scripts/smoke-registration.mjs              # run all stubs (all SKIP)
 *   node scripts/smoke-registration.mjs --test=form-config
 *   node scripts/smoke-registration.mjs --test=captcha-reject
 *
 * Each stub logs "SKIP: not yet implemented — {test-name}" and exits 0.
 * Real implementations replace the stubs in plans 20-02 through 20-07.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3004'

// ─── Test Registry ────────────────────────────────────────────────────────────

const TESTS = {
  'form-config':         'POST/GET/PUT registration form config round-trip',
  'custom-fields':       'Custom field types saved and returned correctly',
  'payment-intent':      'Stripe PaymentIntent created with correct amount',
  'signature':           'Signature stored as Base64 PNG',
  'confirmation-email':  'Confirmation email triggered with QR code',
  'magic-link':          'Magic link issue -> consume -> portal JWT valid',
  'share-hub':           'Share hub returns shareUrl and QR SVG',
  'waitlist-promotion':  'Cancellation triggers waitlist promotion',
  'photo-upload':        'Student photo upload returns URL',
  'captcha-reject':      'Invalid Turnstile token returns 422',
  'medical-permission':  'Medical endpoint returns 403 without events:medical:read',
  'public-page':         'Public event page renders without auth',
  'wizard-steps':        'Registration wizard sections render as steps',
}

// ─── Test Runner ──────────────────────────────────────────────────────────────

/**
 * Run a single named test.
 * @param {string} name - test key from TESTS registry
 * @param {() => Promise<void>} fn - test implementation (currently unused for stubs)
 */
async function runTest(name, fn) {
  const description = TESTS[name]
  if (!description) {
    console.error(`ERROR: Unknown test name "${name}"`)
    console.error(`Available tests: ${Object.keys(TESTS).join(', ')}`)
    process.exit(1)
  }

  console.log(`  SKIP: not yet implemented — ${name} (${description})`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const testArg = args.find(a => a.startsWith('--test='))
  const targetTest = testArg ? testArg.replace('--test=', '') : null

  if (targetTest) {
    // Run a specific test by name
    console.log(`Running smoke test: ${targetTest}`)
    await runTest(targetTest, async () => {})
    console.log('Done.')
    process.exit(0)
  }

  // Run all stubs
  console.log(`smoke-registration: running all ${Object.keys(TESTS).length} stubs against ${BASE_URL}`)
  console.log('')

  for (const [name] of Object.entries(TESTS)) {
    await runTest(name, async () => {})
  }

  console.log('')
  console.log(`All ${Object.keys(TESTS).length} registration smoke tests: SKIP (stubs — implementations in plans 20-02 through 20-07)`)
  process.exit(0)
}

main().catch(err => {
  console.error('smoke-registration: unexpected error', err)
  process.exit(1)
})
