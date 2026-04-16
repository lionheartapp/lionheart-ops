#!/usr/bin/env node
/**
 * scripts/smoke-api-all.mjs
 *
 * Auto-discovering smoke test runner that exercises every API endpoint
 * under `src/app/api/**`. For each discovered route file it reads the exported
 * HTTP methods (GET/POST/PUT/PATCH/DELETE) and sends a request with a best-effort
 * payload. The runner treats 5xx responses and thrown errors as "broken" — 4xx
 * responses are accepted as intentional validation/permission behavior.
 *
 * Usage
 *   SMOKE_BASE_URL=https://app.lionheartapp.com node scripts/smoke-api-all.mjs
 *   SMOKE_BASE_URL=http://127.0.0.1:3004 node scripts/smoke-api-all.mjs
 *
 * Env
 *   SMOKE_BASE_URL      Target host (default: https://app.lionheartapp.com)
 *   SMOKE_ONLY          Optional substring filter on the route path
 *   SMOKE_SKIP          Optional comma-separated substrings to skip
 *   SMOKE_CONCURRENCY   Parallelism (default: 4)
 *   SMOKE_VERBOSE       "1" to print per-endpoint status as it runs
 *   SMOKE_REPORT        Path for JSON report (default: outputs/smoke-report.json)
 *   SMOKE_REUSE_ORG     Existing bearer token to reuse instead of signing up
 *
 * Exits 0 if zero 5xx responses, 1 otherwise.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const API_DIR = path.join(ROOT, 'src', 'app', 'api')

const BASE_URL = (process.env.SMOKE_BASE_URL || 'https://app.lionheartapp.com').replace(/\/$/, '')
const ONLY = process.env.SMOKE_ONLY || ''
const SKIP = (process.env.SMOKE_SKIP || '').split(',').map(s => s.trim()).filter(Boolean)
const CONCURRENCY = Math.max(1, parseInt(process.env.SMOKE_CONCURRENCY || '4', 10))
const VERBOSE = process.env.SMOKE_VERBOSE === '1'
const REPORT_PATH = process.env.SMOKE_REPORT || path.join(ROOT, 'smoke-report.json')
const REUSE_TOKEN = process.env.SMOKE_REUSE_ORG || ''
const REUSE_ORG_ID = process.env.SMOKE_REUSE_ORG_ID || ''
const REUSE_CSRF = process.env.SMOKE_REUSE_CSRF || ''
const REQUEST_TIMEOUT_MS = Math.max(1000, parseInt(process.env.SMOKE_TIMEOUT_MS || '15000', 10))
const STATE_PATH = process.env.SMOKE_STATE || path.join(ROOT, '.smoke-state.json')
const RUN_DEADLINE_MS = parseInt(process.env.SMOKE_MAX_RUNTIME_MS || '0', 10)
const START_TIME = Date.now()

// ---------------------------------------------------------------------------
// Route discovery
// ---------------------------------------------------------------------------

/**
 * Walk API_DIR and return a list of { filePath, urlPath, params } for every
 * route.ts file found.
 */
function discoverRoutes() {
  /** @type {{filePath:string, urlPath:string, params:string[]}[]} */
  const routes = []

  /** @param {string} dir */
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/^route\.(ts|tsx|js|mjs)$/.test(entry.name)) {
        const rel = path.relative(API_DIR, path.dirname(full))
        const segs = rel.split(path.sep).filter(Boolean)
        // route groups (foo) → invisible
        const visible = segs.filter(s => !/^\(.+\)$/.test(s))
        const params = []
        const urlSegs = visible.map(s => {
          const catchAll = s.match(/^\[\.\.\.(.+)\]$/)
          if (catchAll) { params.push(catchAll[1]); return `__${catchAll[1]}__` }
          const optCatchAll = s.match(/^\[\[\.\.\.(.+)\]\]$/)
          if (optCatchAll) { params.push(optCatchAll[1]); return `__${optCatchAll[1]}__` }
          const dyn = s.match(/^\[(.+)\]$/)
          if (dyn) { params.push(dyn[1]); return `__${dyn[1]}__` }
          return s
        })
        routes.push({
          filePath: full,
          urlPath: '/api/' + urlSegs.join('/'),
          params,
        })
      }
    }
  }

  walk(API_DIR)
  return routes
}

/**
 * Parse a route file and return the set of HTTP methods it exports. We look
 * for the conventional `export async function METHOD` or `export const METHOD =`
 * patterns.
 */
function parseExportedMethods(filePath) {
  const src = fs.readFileSync(filePath, 'utf8')
  const methods = new Set()
  for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']) {
    const re = new RegExp(`export\\s+(?:async\\s+function|const|let|var)\\s+${m}\\b`, 'm')
    if (re.test(src)) methods.add(m)
  }
  return methods
}

// ---------------------------------------------------------------------------
// Auth setup
// ---------------------------------------------------------------------------

/**
 * Create a fresh test org via the public signup endpoint and return the
 * bearer token + csrf token + metadata.
 */
async function signupTestOrg() {
  const stamp = Date.now().toString(36)
  const slug = `smoke-${stamp}`
  const adminEmail = `smoke-${stamp}@example.com`
  const body = {
    name: `Smoke Test Org ${stamp}`,
    institutionType: 'PUBLIC',
    gradeLevel: 'HIGH_SCHOOL',
    slug,
    physicalAddress: '123 Test Ave, Springfield, OR 97477',
    adminEmail,
    adminName: 'Smoke Tester',
    adminPassword: 'SmokeTest!2026',
  }

  const res = await fetch(`${BASE_URL}/api/organizations/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const setCookies = []
  // node 20+ supports getSetCookie; fall back to the raw header otherwise
  if (typeof res.headers.getSetCookie === 'function') {
    setCookies.push(...res.headers.getSetCookie())
  } else {
    const raw = res.headers.get('set-cookie')
    if (raw) setCookies.push(raw)
  }

  const json = await safeJson(res)

  if (!res.ok || !json?.ok) {
    throw new Error(`Signup failed: ${res.status} ${JSON.stringify(json)}`)
  }

  const csrfCookie = setCookies
    .map(c => /csrf-token=([^;]+)/.exec(c)?.[1])
    .find(Boolean)

  return {
    token: json.data.admin.token,
    csrfToken: csrfCookie || '',
    organizationId: json.data.organizationId,
    slug: json.data.slug,
    adminEmail,
    adminUserId: json.data.admin.id,
  }
}

async function safeJson(res) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Placeholder substitution — fill dynamic params with safe dummy values
// ---------------------------------------------------------------------------

// A syntactically valid random-ish UUIDv4 — most endpoints validate the
// shape before hitting the DB, and a random uuid will 404 cleanly rather
// than 500.
const DUMMY_UUID = '00000000-0000-4000-8000-000000000000'
const DUMMY_SLUG = 'smoke-test'
const DUMMY_TOKEN = 'smoke-placeholder-token'

// Specific known-name overrides — folders whose [param] is usually a slug or token.
const PARAM_HINTS = {
  slug: DUMMY_SLUG,
  token: DUMMY_TOKEN,
  code: 'smoke-code',
  provider: 'google',
  sport: 'basketball',
  year: '2026',
  month: '4',
  day: '16',
  registrationId: DUMMY_UUID,
  tenantId: DUMMY_UUID,
  userId: DUMMY_UUID,
  orgId: DUMMY_UUID,
  campusId: DUMMY_UUID,
  schoolId: DUMMY_UUID,
  teamId: DUMMY_UUID,
  roleId: DUMMY_UUID,
  eventId: DUMMY_UUID,
  ticketId: DUMMY_UUID,
  projectId: DUMMY_UUID,
  surveyId: DUMMY_UUID,
  responseId: DUMMY_UUID,
  taskId: DUMMY_UUID,
  inviteId: DUMMY_UUID,
  buildingId: DUMMY_UUID,
  areaId: DUMMY_UUID,
  roomId: DUMMY_UUID,
  bracketId: DUMMY_UUID,
  gameId: DUMMY_UUID,
  practiceId: DUMMY_UUID,
  seasonId: DUMMY_UUID,
  sportId: DUMMY_UUID,
  tournamentId: DUMMY_UUID,
  deviceId: DUMMY_UUID,
  accessoryId: DUMMY_UUID,
  assetId: DUMMY_UUID,
  itemId: DUMMY_UUID,
  'nextauth': 'session',
}

function resolveParam(name) {
  if (PARAM_HINTS[name]) return PARAM_HINTS[name]
  if (/id$/i.test(name)) return DUMMY_UUID
  if (/slug$/i.test(name)) return DUMMY_SLUG
  if (/token$/i.test(name)) return DUMMY_TOKEN
  return DUMMY_UUID
}

function fillPath(urlPath, params) {
  let out = urlPath
  for (const p of params) {
    const token = `__${p}__`
    out = out.split(token).join(resolveParam(p))
  }
  return out
}

// ---------------------------------------------------------------------------
// Per-endpoint invocation
// ---------------------------------------------------------------------------

// A catch-all minimal JSON body. Endpoints with required fields will validate
// and return 400 — that's a *successful* test run (not a 5xx crash).
const DEFAULT_POST_BODY = {}

async function hitEndpoint({ method, url, auth }) {
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${auth.token}`,
    'X-Organization-ID': auth.organizationId,
  }
  if (isMutating) {
    headers['Content-Type'] = 'application/json'
    if (auth.csrfToken) {
      headers['X-CSRF-Token'] = auth.csrfToken
      headers['Cookie'] = `csrf-token=${auth.csrfToken}; auth-token=${auth.token}`
    }
  } else {
    headers['Cookie'] = `auth-token=${auth.token}${auth.csrfToken ? `; csrf-token=${auth.csrfToken}` : ''}`
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const init = { method, headers, signal: controller.signal }
  if (isMutating) init.body = JSON.stringify(DEFAULT_POST_BODY)

  const startedAt = Date.now()
  try {
    const res = await fetch(url, init)
    const elapsed = Date.now() - startedAt
    let bodyText = ''
    try {
      bodyText = await res.text()
    } catch {}
    return {
      status: res.status,
      elapsedMs: elapsed,
      bodySnippet: bodyText.slice(0, 400),
    }
  } catch (err) {
    return {
      status: 0,
      elapsedMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

// ---------------------------------------------------------------------------
// Concurrency runner
// ---------------------------------------------------------------------------

async function runWithConcurrency(items, concurrency, worker) {
  const results = []
  let cursor = 0
  async function pump() {
    while (cursor < items.length) {
      const idx = cursor++
      results[idx] = await worker(items[idx], idx)
    }
  }
  const runners = []
  for (let i = 0; i < Math.min(concurrency, items.length); i++) runners.push(pump())
  await Promise.all(runners)
  return results
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
  } catch {
    return null
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
}

function deadlineReached() {
  if (!RUN_DEADLINE_MS) return false
  return Date.now() - START_TIME >= RUN_DEADLINE_MS
}

async function main() {
  const routes = discoverRoutes()
    .filter(r => !ONLY || r.urlPath.includes(ONLY))
    .filter(r => !SKIP.some(s => r.urlPath.includes(s)))

  console.log(`Discovered ${routes.length} route files under ${API_DIR}`)
  console.log(`Base URL: ${BASE_URL}`)

  // ── Load prior state if any ────────────────────────────────────
  let state = loadState()

  let auth
  if (state?.auth?.token && !REUSE_TOKEN) {
    auth = state.auth
    console.log(`Resuming with saved auth (org ${auth.organizationId})`)
  } else if (REUSE_TOKEN) {
    auth = { token: REUSE_TOKEN, csrfToken: REUSE_CSRF, organizationId: REUSE_ORG_ID || 'unknown' }
    console.log('Reusing provided bearer token (SMOKE_REUSE_ORG)')
  } else {
    console.log('Creating fresh test org via /api/organizations/signup...')
    auth = await signupTestOrg()
    console.log(`  → org ${auth.organizationId} (${auth.slug}) as ${auth.adminEmail}`)
  }

  // Build the invocation list: (route × method) tuples.
  /** @type {{method:string, urlPath:string, filePath:string, key:string}[]} */
  const invocations = []
  for (const route of routes) {
    const methods = parseExportedMethods(route.filePath)
    for (const method of methods) {
      if (method === 'OPTIONS' || method === 'HEAD') continue
      const urlPath = fillPath(route.urlPath, route.params)
      invocations.push({
        method,
        urlPath,
        filePath: route.filePath,
        key: `${method} ${urlPath}`,
      })
    }
  }

  // Reload or initialize results map keyed by method+url
  const results = new Map(state?.results?.map(r => [r.key, r]) ?? [])

  const pending = invocations.filter(inv => !results.has(inv.key))

  console.log(`Total invocations: ${invocations.length}.  Already completed: ${results.size}.  Pending: ${pending.length}.`)
  console.log(`Concurrency=${CONCURRENCY}  timeoutMs=${REQUEST_TIMEOUT_MS}  deadlineMs=${RUN_DEADLINE_MS || 'none'}`)
  console.log('')

  let done = results.size
  const total = invocations.length

  // Persist state every N completions
  let sinceSave = 0

  await runWithConcurrency(pending, CONCURRENCY, async (inv) => {
    if (deadlineReached()) return
    const url = `${BASE_URL}${inv.urlPath}`
    const out = await hitEndpoint({ method: inv.method, url, auth })
    done++
    const relFile = path.relative(ROOT, inv.filePath)
    const record = { ...inv, ...out, relFile }
    results.set(inv.key, record)
    const tag =
      out.status >= 500 || out.status === 0 ? '💥' :
      out.status >= 400 ? '·' :
      '✓'
    const line = `${tag} ${inv.method.padEnd(6)} ${out.status.toString().padStart(3)}  ${inv.urlPath}`
    if (VERBOSE || out.status >= 500 || out.status === 0) {
      process.stdout.write(`[${done}/${total}] ${line}\n`)
    }
    sinceSave++
    if (sinceSave >= 20) {
      saveState({ auth, results: Array.from(results.values()) })
      sinceSave = 0
    }
  })

  saveState({ auth, results: Array.from(results.values()) })

  const done2 = Array.from(results.values())
  // Helper for categorization uses done2 below
  const resultsArr = done2

  // Categorize
  const crashes = resultsArr.filter(r => r.status === 0)
  const fiveXx = resultsArr.filter(r => r.status >= 500 && r.status <= 599)
  const fourXx = resultsArr.filter(r => r.status >= 400 && r.status <= 499)
  const twoXx = resultsArr.filter(r => r.status >= 200 && r.status <= 299)
  const threeXx = resultsArr.filter(r => r.status >= 300 && r.status <= 399)

  console.log('')
  console.log('──────────────── Smoke summary ────────────────')
  console.log(`  2xx                   ${twoXx.length}`)
  console.log(`  3xx                   ${threeXx.length}`)
  console.log(`  4xx (expected)        ${fourXx.length}`)
  console.log(`  5xx (BROKEN)          ${fiveXx.length}`)
  console.log(`  crashes/network errs  ${crashes.length}`)
  console.log(`  total                 ${results.length}`)
  console.log('───────────────────────────────────────────────')

  if (fiveXx.length > 0) {
    console.log('')
    console.log('5xx failures:')
    for (const f of fiveXx) {
      const snippet = (f.bodySnippet || '').replace(/\s+/g, ' ').slice(0, 200)
      console.log(`  ${f.status} ${f.method.padEnd(6)} ${f.urlPath}`)
      if (snippet) console.log(`       → ${snippet}`)
    }
  }

  if (crashes.length > 0) {
    console.log('')
    console.log('Network-level failures:')
    for (const c of crashes) {
      console.log(`  ${c.method.padEnd(6)} ${c.urlPath}  (${c.error})`)
    }
  }

  // Write JSON report
  const report = {
    baseUrl: BASE_URL,
    generatedAt: new Date().toISOString(),
    counts: {
      total: resultsArr.length,
      twoXx: twoXx.length,
      threeXx: threeXx.length,
      fourXx: fourXx.length,
      fiveXx: fiveXx.length,
      crashes: crashes.length,
    },
    fiveXx,
    crashes,
    allResults: resultsArr,
  }
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))
  console.log('')
  console.log(`Detailed report written to: ${REPORT_PATH}`)

  // Exit non-zero only if we finished AND have failures. If the deadline was
  // reached before finishing, exit with 2 so the caller knows to resume.
  const finished = resultsArr.length === invocations.length
  if (!finished) {
    console.log(`Deadline reached with ${invocations.length - resultsArr.length} pending. Re-run to resume.`)
    process.exit(2)
  }
  process.exit(fiveXx.length + crashes.length > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Fatal:', err?.stack || err)
  process.exit(1)
})
