#!/usr/bin/env node

/**
 * Product audit runner.
 *
 * Creates a plain JSON evidence file used by the HTML audit report.
 * It checks page reachability, rough page speed, console errors, network
 * failures, and automated accessibility issues on the main app screens.
 */

import fs from 'fs'
import path from 'path'
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const BASE_URL = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:3006'
const ORG_ID = process.env.AUDIT_ORG_ID || 'cmnxogi8s0006mm9mrutfjs1v'
const EMAIL = process.env.AUDIT_EMAIL || 'e2e-admin@lionheart-test.com'
const PASSWORD = process.env.AUDIT_PASSWORD || 'E2E-Test-P@ssw0rd-2026!'

const outDir = path.join(process.cwd(), 'docs', 'audit-artifacts')
const screenshotDir = path.join(outDir, 'screenshots')
fs.mkdirSync(screenshotDir, { recursive: true })

const desktopPages = [
  ['/dashboard', 'Dashboard'],
  ['/calendar', 'Calendar'],
  ['/messaging', 'Messaging'],
  ['/tickets', 'Tickets'],
  ['/it', 'IT'],
  ['/maintenance', 'Maintenance'],
  ['/maintenance/assets', 'Maintenance assets'],
  ['/maintenance/pm-calendar', 'Maintenance preventive maintenance'],
  ['/settings', 'Settings'],
  ['/inventory', 'Inventory'],
  ['/events', 'Events'],
  ['/draft-events', 'Draft events'],
  ['/approvals', 'Approvals'],
]

const mobilePages = [
  ['/dashboard', 'Mobile dashboard'],
  ['/calendar', 'Mobile calendar'],
  ['/messaging', 'Mobile messaging'],
  ['/tickets', 'Mobile tickets'],
  ['/it', 'Mobile IT'],
  ['/maintenance', 'Mobile maintenance'],
]

async function login(context) {
  const response = await context.request.post(`${BASE_URL}/api/auth/login`, {
    headers: {
      'Content-Type': 'application/json',
      'x-e2e-run': 'local',
    },
    data: {
      email: EMAIL,
      password: PASSWORD,
      organizationId: ORG_ID,
    },
  })

  const json = await response.json().catch(() => null)
  if (!response.ok() || !json?.ok) {
    throw new Error(`Login failed: ${response.status()} ${JSON.stringify(json)}`)
  }

  return json.data
}

function hasBadText(text) {
  const lower = text.toLowerCase()
  return (
    lower.includes('application error') ||
    lower.includes('something went wrong') ||
    lower.includes('organization not found') ||
    lower.includes('max client connections') ||
    lower.includes('internal server error')
  )
}

async function auditPage(context, target, label, viewportName) {
  const page = await context.newPage()
  const consoleErrors = []
  const failedRequests = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 500))
  })

  page.on('requestfailed', (request) => {
    const requestUrl = request.url()
    const failureText = request.failure()?.errorText || 'unknown'
    const isAbortedRscNavigation =
      failureText === 'net::ERR_ABORTED' && requestUrl.includes('_rsc=')

    if (isAbortedRscNavigation) return

    failedRequests.push({
      url: requestUrl.replace(BASE_URL, ''),
      failure: failureText,
    })
  })

  const url = `${BASE_URL}${target}`
  const started = Date.now()
  let status = null
  let loadMs = null
  let title = ''
  let bodyText = ''
  let axe = { violations: [], count: 0 }
  let screenshot = null
  let error = null

  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    status = response?.status() ?? null
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    loadMs = Date.now() - started
    title = await page.title().catch(() => '')
    bodyText = (await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')).slice(0, 5000)

    const screenshotName = `${viewportName}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
    await page.screenshot({ path: path.join(screenshotDir, screenshotName), fullPage: false }).catch(() => {})
    screenshot = path.join('audit-artifacts', 'screenshots', screenshotName)

    const axeResult = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
      .catch((axeError) => ({ violations: [{ id: 'axe-error', impact: 'serious', description: axeError.message, nodes: [] }] }))

    axe = {
      count: axeResult.violations.length,
      violations: axeResult.violations.slice(0, 10).map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.length,
      })),
    }
  } catch (err) {
    loadMs = Date.now() - started
    error = err instanceof Error ? err.message : String(err)
  } finally {
    await page.close().catch(() => {})
  }

  return {
    label,
    path: target,
    viewport: viewportName,
    status,
    loadMs,
    title,
    hasBadText: hasBadText(bodyText),
    consoleErrors,
    failedRequests,
    accessibility: axe,
    screenshot,
    error,
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true })

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, baseURL: BASE_URL })
  await login(desktop)

  const desktopResults = []
  for (const [target, label] of desktopPages) {
    desktopResults.push(await auditPage(desktop, target, label, 'desktop'))
  }

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    baseURL: BASE_URL,
  })
  await login(mobile)

  const mobileResults = []
  for (const [target, label] of mobilePages) {
    mobileResults.push(await auditPage(mobile, target, label, 'mobile'))
  }

  await browser.close()

  const result = {
    createdAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    desktopResults,
    mobileResults,
  }

  const outPath = path.join(outDir, 'product-audit-data.json')
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2))
  console.log(`Wrote ${outPath}`)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
