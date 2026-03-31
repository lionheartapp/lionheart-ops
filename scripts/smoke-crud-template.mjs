#!/usr/bin/env node

/**
 * Reusable CRUD Smoke Test Template
 *
 * Generates and runs a standard Create → List → Get → Update → Delete test flow
 * for any API entity. Eliminates copy-pasting between smoke test scripts.
 *
 * Usage in a test script:
 *
 *   import { runCrudSmokeTest } from './smoke-crud-template.mjs'
 *
 *   await runCrudSmokeTest({
 *     name: 'Building',
 *     baseUrl: 'http://localhost:3004/api/settings/campus/buildings',
 *     authCookie: 'auth-token=xxx',
 *     createPayload: { name: 'Test Building', campusId: '...' },
 *     updatePayload: { name: 'Updated Building' },
 *     // Optional:
 *     listValidator: (data) => Array.isArray(data),
 *     detailValidator: (data) => data.name === 'Test Building',
 *   })
 */

const PASS = '\x1b[32m✓\x1b[0m'
const FAIL = '\x1b[31m✗\x1b[0m'
const SKIP = '\x1b[33m○\x1b[0m'

let passed = 0
let failed = 0
let skipped = 0

function assert(label, condition) {
  if (condition) {
    console.log(`  ${PASS} ${label}`)
    passed++
  } else {
    console.log(`  ${FAIL} ${label}`)
    failed++
  }
  return condition
}

function skip(label, reason) {
  console.log(`  ${SKIP} ${label} — ${reason}`)
  skipped++
}

async function apiCall(method, url, cookie, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
  }
  if (body) opts.body = JSON.stringify(body)

  const res = await fetch(url, opts)
  const json = await res.json()
  return { status: res.status, json }
}

/**
 * Run a complete CRUD smoke test.
 */
export async function runCrudSmokeTest({
  name,
  baseUrl,
  authCookie,
  createPayload,
  updatePayload,
  listValidator,
  detailValidator,
  idField = 'id',
  skipDelete = false,
}) {
  console.log(`\n=== ${name} CRUD Smoke Test ===\n`)

  let createdId = null

  // 1. CREATE
  console.log('CREATE:')
  try {
    const { status, json } = await apiCall('POST', baseUrl, authCookie, createPayload)
    assert(`POST ${baseUrl} → ${status}`, status === 201 || status === 200)
    assert('Response ok', json.ok === true)
    if (json.ok && json.data) {
      createdId = json.data[idField]
      assert(`Created ${name} has ${idField}`, !!createdId)
    }
  } catch (e) {
    console.log(`  ${FAIL} CREATE failed: ${e.message}`)
    failed++
  }

  // 2. LIST
  console.log('\nLIST:')
  try {
    const { status, json } = await apiCall('GET', baseUrl, authCookie)
    assert(`GET ${baseUrl} → ${status}`, status === 200)
    assert('Response ok', json.ok === true)
    if (listValidator && json.data) {
      assert('List validator passes', listValidator(json.data))
    } else if (json.data) {
      assert('Data is array or has items', Array.isArray(json.data) || typeof json.data === 'object')
    }
  } catch (e) {
    console.log(`  ${FAIL} LIST failed: ${e.message}`)
    failed++
  }

  // 3. GET DETAIL
  if (createdId) {
    console.log('\nGET DETAIL:')
    try {
      const detailUrl = `${baseUrl}/${createdId}`
      const { status, json } = await apiCall('GET', detailUrl, authCookie)
      assert(`GET ${detailUrl} → ${status}`, status === 200)
      assert('Response ok', json.ok === true)
      if (detailValidator && json.data) {
        assert('Detail validator passes', detailValidator(json.data))
      }
    } catch (e) {
      console.log(`  ${FAIL} GET DETAIL failed: ${e.message}`)
      failed++
    }
  } else {
    skip('GET DETAIL', 'No created ID')
  }

  // 4. UPDATE
  if (createdId && updatePayload) {
    console.log('\nUPDATE:')
    try {
      const updateUrl = `${baseUrl}/${createdId}`
      const { status, json } = await apiCall('PATCH', updateUrl, authCookie, updatePayload)
      if (status === 405) {
        // Try PUT instead
        const { status: putStatus, json: putJson } = await apiCall('PUT', updateUrl, authCookie, updatePayload)
        assert(`PUT ${updateUrl} → ${putStatus}`, putStatus === 200)
        assert('Response ok', putJson.ok === true)
      } else {
        assert(`PATCH ${updateUrl} → ${status}`, status === 200)
        assert('Response ok', json.ok === true)
      }
    } catch (e) {
      console.log(`  ${FAIL} UPDATE failed: ${e.message}`)
      failed++
    }
  } else if (!updatePayload) {
    skip('UPDATE', 'No update payload provided')
  } else {
    skip('UPDATE', 'No created ID')
  }

  // 5. DELETE
  if (createdId && !skipDelete) {
    console.log('\nDELETE:')
    try {
      const deleteUrl = `${baseUrl}/${createdId}`
      const { status, json } = await apiCall('DELETE', deleteUrl, authCookie)
      assert(`DELETE ${deleteUrl} → ${status}`, status === 200)
      assert('Response ok', json.ok === true)
    } catch (e) {
      console.log(`  ${FAIL} DELETE failed: ${e.message}`)
      failed++
    }
  } else if (skipDelete) {
    skip('DELETE', 'Skipped by config')
  } else {
    skip('DELETE', 'No created ID')
  }

  // Summary
  console.log(`\n--- ${name} Results ---`)
  console.log(`  ${PASS} Passed: ${passed}`)
  if (failed > 0) console.log(`  ${FAIL} Failed: ${failed}`)
  if (skipped > 0) console.log(`  ${SKIP} Skipped: ${skipped}`)
  console.log()

  return { passed, failed, skipped }
}

/**
 * Helper: login and get auth cookie for testing.
 */
export async function loginForTest(baseUrl, email, password) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  const cookies = res.headers.getSetCookie?.() ?? []
  const authCookie = cookies.find((c) => c.startsWith('auth-token='))
  if (!authCookie) {
    throw new Error('Login failed — no auth-token cookie returned')
  }
  // Return just the cookie key=value part (strip flags)
  return authCookie.split(';')[0]
}
