#!/usr/bin/env node
/**
 * Walks src/app/api/**\/route.ts and extracts:
 *   - URL path  (e.g. /api/tickets/{id})
 *   - HTTP method (GET/POST/PUT/PATCH/DELETE)
 *   - Permission required (from `withAuth(handler, { permission: PERMISSIONS.X })`
 *     or inline `assertCan(... PERMISSIONS.X)`)
 *
 * Output: e2e/fixtures/route-inventory.json
 *
 * This is the source of truth for the permission matrix test. Re-run after
 * adding/removing routes or changing permission decorators.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API_DIR = path.join(ROOT, 'src', 'app', 'api')
const OUT_FILE = path.join(ROOT, 'e2e', 'fixtures', 'route-inventory.json')

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

/**
 * Recursively find every route.ts under a directory.
 */
async function findRouteFiles(dir) {
  const out = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await findRouteFiles(full)))
    } else if (entry.isFile() && entry.name === 'route.ts') {
      out.push(full)
    }
  }
  return out
}

/**
 * Convert /abs/path/src/app/api/tickets/[id]/route.ts → /api/tickets/{id}
 */
function fileToUrlPath(filePath) {
  const rel = path
    .relative(API_DIR, filePath)
    .replace(/\/route\.ts$/, '')
    .replace(/\\/g, '/')
  // [id] → {id}, [...slug] → {slug}
  const url = '/' + ['api', ...rel.split('/').filter(Boolean)].join('/')
  return url
    .replace(/\[\.{3}([^\]]+)\]/g, '{$1}')
    .replace(/\[([^\]]+)\]/g, '{$1}')
}

/**
 * Find every method-export position in the source: `export const GET = ...`
 * or `export async function POST(...)`. Returns sorted by index.
 */
function findExportPositions(source) {
  const positions = []
  for (const method of HTTP_METHODS) {
    const constRe = new RegExp(`export\\s+const\\s+${method}\\b`, 'g')
    const fnRe = new RegExp(`export\\s+async\\s+function\\s+${method}\\b`, 'g')
    let m
    while ((m = constRe.exec(source)) !== null) {
      positions.push({ method, index: m.index, kind: 'const' })
    }
    while ((m = fnRe.exec(source)) !== null) {
      positions.push({ method, index: m.index, kind: 'function' })
    }
  }
  return positions.sort((a, b) => a.index - b.index)
}

/**
 * Extract HTTP methods + their permission decorators from the file source.
 * Strategy: split source into per-method blocks at each `export const METHOD =`
 * (or `export async function METHOD(`) boundary, then scan each block for
 * permission markers.
 */
function parseRouteSource(source) {
  const positions = findExportPositions(source)
  if (positions.length === 0) return []

  const methods = []
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index
    const end = i + 1 < positions.length ? positions[i + 1].index : source.length
    const block = source.slice(start, end)

    const single = block.match(/permission:\s*PERMISSIONS\.([A-Z0-9_]+)/)
    const anyList = block.match(/permissionAny:\s*\[([^\]]+)\]/)
    const inlineAssert = block.match(/assertCan\([^,]+,\s*PERMISSIONS\.([A-Z0-9_]+)/)

    methods.push({
      method: positions[i].method,
      permission: single ? single[1] : null,
      permissionAny: anyList
        ? anyList[1]
            .split(',')
            .map((s) => s.trim().match(/PERMISSIONS\.([A-Z0-9_]+)/)?.[1])
            .filter(Boolean)
        : null,
      inlinePermission: inlineAssert ? inlineAssert[1] : null,
      wrapper: positions[i].kind === 'const' ? 'withAuth' : 'inline',
    })
  }
  return methods
}

async function main() {
  const files = await findRouteFiles(API_DIR)
  const inventory = []

  for (const file of files) {
    const source = await fs.readFile(file, 'utf8')
    const urlPath = fileToUrlPath(file)
    const methods = parseRouteSource(source)
    for (const m of methods) {
      inventory.push({
        path: urlPath,
        method: m.method,
        permission: m.permission,
        permissionAny: m.permissionAny,
        inlinePermission: m.inlinePermission,
        wrapper: m.wrapper,
        sourceFile: path.relative(ROOT, file),
        // Helpful tag — public routes are anything under /api/public, /api/branding,
        // /api/auth, /api/organizations/signup. The matrix test treats these as 200-OK
        // for unauthenticated probes.
        isPublic:
          urlPath.startsWith('/api/public/') ||
          urlPath === '/api/branding' ||
          urlPath.startsWith('/api/auth/') ||
          urlPath === '/api/organizations/signup' ||
          urlPath === '/api/organizations/slug-check' ||
          urlPath === '/api/health' ||
          urlPath.startsWith('/api/cron/') ||
          urlPath.startsWith('/api/webhooks/') ||
          (urlPath.startsWith('/api/integrations/') && urlPath.endsWith('/callback')),
      })
    }
  }

  // Stable sort so diffs are clean.
  inventory.sort((a, b) =>
    a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path)
  )

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true })
  await fs.writeFile(OUT_FILE, JSON.stringify(inventory, null, 2) + '\n', 'utf8')

  // Report.
  const totals = {
    routes: new Set(inventory.map((r) => r.path)).size,
    handlers: inventory.length,
    guarded: inventory.filter((r) => r.permission || r.permissionAny || r.inlinePermission).length,
    unguarded: inventory.filter(
      (r) =>
        !r.permission && !r.permissionAny && !r.inlinePermission && !r.isPublic
    ).length,
    public: inventory.filter((r) => r.isPublic).length,
  }
  console.log(`✔ Wrote ${path.relative(ROOT, OUT_FILE)}`)
  console.log(`  routes:    ${totals.routes}`)
  console.log(`  handlers:  ${totals.handlers}`)
  console.log(`  guarded:   ${totals.guarded}`)
  console.log(`  unguarded: ${totals.unguarded}  (logged-in but no permission decorator)`)
  console.log(`  public:    ${totals.public}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
