#!/usr/bin/env node
/**
 * Walks src/app/**\/page.tsx and emits the URL path each one represents.
 *
 * Output: e2e/fixtures/page-inventory.json
 *
 * Used by:
 *   - e2e/ui/link-crawler.spec.ts          (seed list)
 *   - e2e/ui/buttons-smoke.spec.ts         (which pages to fuzz buttons on)
 *   - e2e/a11y/authenticated-pages.spec.ts (which pages to axe-scan)
 *
 * Re-run after adding/moving page routes.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const APP_DIR = path.join(ROOT, 'src', 'app')
const OUT_FILE = path.join(ROOT, 'e2e', 'fixtures', 'page-inventory.json')

/**
 * Pages we should never crawl as part of an authenticated sweep:
 *   - public marketing pages render without auth (separate suite)
 *   - destructive routes log the user out
 *   - dynamic params we can't satisfy with a fake UUID
 *   - internal/dev tools
 */
const SKIP_PATTERNS = [
  /^\/$/,                            // landing page (separate test)
  /^\/login$/,
  /^\/signin$/,
  /^\/signup$/,
  /^\/set-password/,
  /^\/reset-password/,
  /^\/verify-email/,
  /^\/admin\/login/,
  /^\/about$/,
  /^\/contact$/,
  /^\/pricing$/,
  /^\/privacy$/,
  /^\/terms$/,
  /^\/help/,
  /^\/offline/,
  /^\/dev\//,
  /^\/onboarding\//,                 // requires fresh signup state
  /^\/r\//,                          // public registration shortcut
  /^\/f\/qr/,                        // public QR landing
  /^\/events\/public/,               // public event pages
  /^\/events\/portal/,
  /^\/events\/check-in/,
  /^\/athletics\/public/,
]

async function findPageFiles(dir) {
  const out = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // Skip API routes and route groups we don't want to crawl
      if (entry.name === 'api') continue
      out.push(...(await findPageFiles(full)))
    } else if (entry.isFile() && entry.name === 'page.tsx') {
      out.push(full)
    }
  }
  return out
}

function fileToUrlPath(filePath) {
  const rel = path
    .relative(APP_DIR, filePath)
    .replace(/(^|\/)page\.tsx$/, '')
    .replace(/\\/g, '/')
  // Drop route groups: (auth), (admin) etc.
  const segments = rel
    .split('/')
    .filter((seg) => seg && !(seg.startsWith('(') && seg.endsWith(')')))
  if (segments.length === 0) return '/'
  // Convert dynamic segments to placeholders.
  const url =
    '/' +
    segments
      .map((s) => s.replace(/\[\.{3}([^\]]+)\]/g, '{$1}').replace(/\[([^\]]+)\]/g, '{$1}'))
      .join('/')
  return url
}

function shouldSkip(urlPath) {
  return SKIP_PATTERNS.some((p) => p.test(urlPath))
}

async function main() {
  const files = await findPageFiles(APP_DIR)
  const all = files.map(fileToUrlPath)
  const unique = Array.from(new Set(all)).sort()

  const crawlable = unique.filter((p) => !shouldSkip(p) && !p.includes('{'))
  const dynamic = unique.filter((p) => p.includes('{'))
  const skipped = unique.filter((p) => shouldSkip(p))

  const out = {
    generatedAt: new Date().toISOString(),
    counts: {
      total: unique.length,
      crawlable: crawlable.length,
      dynamic: dynamic.length,
      skipped: skipped.length,
    },
    crawlable,
    dynamic,
    skipped,
  }

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true })
  await fs.writeFile(OUT_FILE, JSON.stringify(out, null, 2) + '\n', 'utf8')

  console.log(`✔ Wrote ${path.relative(ROOT, OUT_FILE)}`)
  console.log(`  total:     ${unique.length}`)
  console.log(`  crawlable: ${crawlable.length}  (used as seeds)`)
  console.log(`  dynamic:   ${dynamic.length}    (need real IDs to visit)`)
  console.log(`  skipped:   ${skipped.length}    (public/auth/onboarding pages)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
