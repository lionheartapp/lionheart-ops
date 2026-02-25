#!/usr/bin/env node
/**
 * HTTP-only smoke test: checks app and API routes respond without needing DB.
 * Run when the app is up (npm run dev) but DB may be unavailable.
 * Full smoke tests (smoke:all, smoke-current-state) require a running seeded DB.
 */
const BASE = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3004'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function run() {
  console.log('HTTP-only smoke (no DB)\n')
  console.log(`Base URL: ${BASE}\n`)

  // Root
  const rootRes = await fetch(BASE)
  assert(rootRes.ok, `Root failed: ${rootRes.status}`)
  console.log('- GET / ... 200 OK')

  // Login without body -> 400
  const loginBadRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  assert(loginBadRes.status === 400, `Login (no creds) expected 400, got ${loginBadRes.status}`)
  const loginBadData = await loginBadRes.json()
  assert(loginBadData.success === false && loginBadData.ok === false, 'Login (no creds) should return fail shape')
  console.log('- POST /api/auth/login (no creds) ... 400 + fail shape')

  // Login with invalid org -> 401 or 400
  const login401Res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'a@b.com', password: 'x', organizationId: 'non-existent-org-id' }),
  })
  assert([400, 401].includes(login401Res.status), `Login (bad org) expected 400/401, got ${login401Res.status}`)
  const login401Data = await login401Res.json()
  assert(login401Data.success === false && login401Data.ok === false, 'Login (bad org) should return fail shape')
  console.log('- POST /api/auth/login (bad org) ... 401/400 + fail shape')

  // Branding without slug -> 400
  const brandingRes = await fetch(`${BASE}/api/branding`)
  assert(brandingRes.status === 400, `GET /api/branding (no slug) expected 400, got ${brandingRes.status}`)
  console.log('- GET /api/branding (no slug) ... 400')

  // Slug check
  const slugRes = await fetch(`${BASE}/api/organizations/slug-check?slug=demo`)
  assert(slugRes.ok, `Slug check failed: ${slugRes.status}`)
  const slugData = await slugRes.json()
  assert(slugData.success === true && slugData.ok === true && typeof slugData.data?.available === 'boolean', 'Slug check shape')
  console.log('- GET /api/organizations/slug-check?slug=demo ... 200 + ok shape')

  // Auth permissions without token -> 401
  const permRes = await fetch(`${BASE}/api/auth/permissions`)
  assert(permRes.status === 401, `GET /api/auth/permissions (no token) expected 401, got ${permRes.status}`)
  console.log('- GET /api/auth/permissions (no token) ... 401')

  // Set-password validate no token -> 400
  const validateRes = await fetch(`${BASE}/api/auth/set-password/validate`)
  assert(validateRes.status === 400, `Validate (no token) expected 400, got ${validateRes.status}`)
  console.log('- GET /api/auth/set-password/validate (no token) ... 400')

  console.log('\n✅ HTTP-only smoke passed (app and API routes respond correctly).')
  console.log('   For full smoke (DB + seed), ensure PostgreSQL is running and run: npm run smoke:all')
}

run().catch((err) => {
  console.error('\n❌ HTTP smoke failed:', err.message)
  process.exit(1)
})
