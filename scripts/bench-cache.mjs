#!/usr/bin/env node

/**
 * Cache Benchmark  (Shift 2 — Task #66)
 *
 * Measures the impact of the process-local route cache by timing sequential
 * requests against the same endpoint. The first request hits the DB (cold).
 * Subsequent requests hit the in-memory cache (warm). The delta is the speedup
 * the cache delivers for each endpoint.
 *
 * For each endpoint we report:
 *   - cold ms      : 1st request (cache miss, representative of pre-cache behavior)
 *   - warm median  : median of requests 2..N (cache-hit steady state)
 *   - warm p95     : 95th percentile of warm requests (tail latency)
 *   - speedup      : cold / warm median — rough "X times faster"
 *
 * Why sequential / single-user: the cache is process-local. A concurrent load
 * test here would mostly measure Next.js request handling, not the cache.
 * Sequential timing isolates the DB-query vs. cache-lookup delta cleanly.
 *
 * Usage:
 *   node scripts/bench-cache.mjs
 *   node scripts/bench-cache.mjs --iterations 100
 *   node scripts/bench-cache.mjs --json > bench.json
 *
 * Requires:
 *   - Dev server on http://localhost:3004 (or BENCH_BASE_URL)
 *   - db:seed run (demo org + admin@demo.com / test123)
 */

import { PrismaClient } from '@prisma/client'
import { performance } from 'node:perf_hooks'

const prisma = new PrismaClient()
const BASE_URL = process.env.BENCH_BASE_URL || 'http://localhost:3004'

// CLI args
const args = process.argv.slice(2)
const iterArg = args.find((a) => a.startsWith('--iterations'))
const ITERATIONS = iterArg ? Number(iterArg.split('=')[1] || args[args.indexOf(iterArg) + 1]) : 50
const JSON_MODE = args.includes('--json')

const LOGIN = {
  email: process.env.BENCH_EMAIL || 'admin@demo.com',
  password: process.env.BENCH_PASSWORD || 'test123',
}
const BENCH_ORG_ID = process.env.BENCH_ORG_ID || ''
const BENCH_ORG_SLUG = process.env.BENCH_ORG_SLUG || 'demo'

const ENDPOINTS = [
  { name: 'settings/school-info',              path: '/api/settings/school-info' },
  { name: 'onboarding/school-info',            path: '/api/onboarding/school-info' },
  { name: 'modules',                           path: '/api/modules' },
  { name: 'calendars',                         path: '/api/calendars' },
  { name: 'settings/teams',                    path: '/api/settings/teams' },
  { name: 'settings/approval-config',          path: '/api/settings/approval-config' },
  { name: 'settings/security',                 path: '/api/settings/security' },
  { name: 'settings/compliance',               path: '/api/settings/compliance' },
  { name: 'planning-seasons',                  path: '/api/planning-seasons' },
  { name: 'athletics/sports',                  path: '/api/athletics/sports' },
  { name: 'athletics/seasons',                 path: '/api/athletics/seasons' },
  { name: 'events/templates',                  path: '/api/events/templates' },
  { name: 'notifications',                     path: '/api/notifications' },
  { name: 'user/notification-preferences',     path: '/api/user/notification-preferences' },
  { name: 'integrations/status',               path: '/api/integrations/status' },
  { name: 'branding',                          path: '/api/branding' },
]

function median(nums) {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
function percentile(nums, p) {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, idx)]
}
function fmt(ms) {
  return `${ms.toFixed(1)}ms`
}

async function resolveOrg() {
  // If BENCH_ORG_ID is set, skip Prisma lookup (for remote runs)
  if (BENCH_ORG_ID) {
    return { id: BENCH_ORG_ID, name: BENCH_ORG_SLUG }
  }
  // Otherwise look up by slug via the login endpoint's org lookup
  // (requires local DB access)
  const org = await prisma.organization.findFirst({
    where: { slug: BENCH_ORG_SLUG },
    select: { id: true, name: true },
  })
  if (!org) throw new Error(`Org "${BENCH_ORG_SLUG}" not found — run npm run db:seed or set BENCH_ORG_ID`)
  return org
}

async function login(orgId) {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...LOGIN, organizationId: orgId }),
  })
  const data = await res.json()
  if (!res.ok || !data?.data?.token) {
    throw new Error(`Login failed: ${JSON.stringify(data)}`)
  }
  return data.data.token
}

async function timedGet(path, token, orgId) {
  const t0 = performance.now()
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Organization-ID': orgId,
    },
  })
  // Drain the body so server-side timing is comparable between runs.
  await res.text()
  const elapsed = performance.now() - t0
  return { status: res.status, ms: elapsed }
}

async function benchmarkEndpoint(ep, token, orgId) {
  const timings = []
  let cold = null
  let skipped = false
  let errorStatus = null

  for (let i = 0; i < ITERATIONS; i++) {
    const { status, ms } = await timedGet(ep.path, token, orgId)
    if (status === 404 || status === 403 || status >= 500) {
      // Endpoint not applicable (e.g., missing in this org) — skip quietly.
      skipped = true
      errorStatus = status
      break
    }
    if (i === 0) cold = ms
    else timings.push(ms)
  }

  if (skipped) {
    return { name: ep.name, skipped: true, status: errorStatus }
  }

  const warmMed = median(timings)
  const warmP95 = percentile(timings, 95)
  const warmMin = Math.min(...timings)
  const speedup = warmMed > 0 ? cold / warmMed : 0

  return {
    name: ep.name,
    cold,
    warmMin,
    warmMed,
    warmP95,
    speedup,
    samples: timings.length + 1,
  }
}

function renderTable(results) {
  const header = ['Endpoint', 'Cold', 'Warm min', 'Warm med', 'Warm p95', 'Speedup']
  const rows = []
  for (const r of results) {
    if (r.skipped) {
      rows.push([r.name, `(skip ${r.status})`, '—', '—', '—', '—'])
      continue
    }
    rows.push([
      r.name,
      fmt(r.cold),
      fmt(r.warmMin),
      fmt(r.warmMed),
      fmt(r.warmP95),
      r.speedup ? `${r.speedup.toFixed(1)}×` : '—',
    ])
  }

  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i]).length))
  )
  const pad = (s, w) => String(s).padEnd(w, ' ')
  const line = (cells) => cells.map((c, i) => pad(c, widths[i])).join('   ')

  console.log('\n' + line(header))
  console.log(widths.map((w) => '─'.repeat(w)).join('   '))
  for (const r of rows) console.log(line(r))
}

function summarize(results) {
  const hits = results.filter((r) => !r.skipped)
  if (hits.length === 0) return
  const avgCold = hits.reduce((s, r) => s + r.cold, 0) / hits.length
  const avgWarm = hits.reduce((s, r) => s + r.warmMed, 0) / hits.length
  const avgSpeedup = hits.reduce((s, r) => s + r.speedup, 0) / hits.length
  const totalCold = hits.reduce((s, r) => s + r.cold, 0)
  const totalWarm = hits.reduce((s, r) => s + r.warmMed, 0)

  console.log(`\n${'─'.repeat(54)}`)
  console.log(`  Endpoints measured : ${hits.length} / ${results.length}`)
  console.log(`  Iterations per     : ${ITERATIONS}`)
  console.log(`  Avg cold latency   : ${fmt(avgCold)}`)
  console.log(`  Avg warm latency   : ${fmt(avgWarm)}`)
  console.log(`  Avg speedup        : ${avgSpeedup.toFixed(1)}×`)
  console.log(`  Total cold         : ${fmt(totalCold)}  (one sweep from cold)`)
  console.log(`  Total warm         : ${fmt(totalWarm)}  (subsequent sweeps)`)
  console.log(`  Wall-time saved    : ${fmt(totalCold - totalWarm)} per full sweep`)
}

async function main() {
  if (!JSON_MODE) {
    console.log('📈 Cache Benchmark')
    console.log(`   Base URL   : ${BASE_URL}`)
    console.log(`   Iterations : ${ITERATIONS} per endpoint (1 cold + ${ITERATIONS - 1} warm)\n`)
  }

  const org = await resolveOrg()
  const token = await login(org.id)
  if (!JSON_MODE) console.log(`   Logged in as ${LOGIN.email} on "${org.name}"\n`)

  const results = []
  for (const ep of ENDPOINTS) {
    if (!JSON_MODE) process.stdout.write(`   • ${ep.name} … `)
    const r = await benchmarkEndpoint(ep, token, org.id)
    results.push(r)
    if (!JSON_MODE) {
      if (r.skipped) console.log(`skipped (status ${r.status})`)
      else console.log(`cold ${fmt(r.cold)}, warm ${fmt(r.warmMed)}, ${r.speedup.toFixed(1)}×`)
    }
  }

  if (JSON_MODE) {
    console.log(JSON.stringify({ base: BASE_URL, iterations: ITERATIONS, results }, null, 2))
    return
  }

  renderTable(results)
  summarize(results)
}

main()
  .catch((err) => {
    console.error('\n💥 Error:', err.stack || err.message || err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
