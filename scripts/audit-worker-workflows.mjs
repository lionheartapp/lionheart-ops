#!/usr/bin/env node

/**
 * Worker workflow audit.
 *
 * Exercises the IT and maintenance job paths using real worker roles:
 * - IT Coordinator creates, claims, works, holds, resumes, and resolves a ticket.
 * - Head of Maintenance creates, claims, logs labor/costs/photos, moves to QA,
 *   and approves the work order as done.
 */

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import { chromium } from 'playwright'
import { PrismaClient } from '@prisma/client'

dotenv.config({ path: '.env.local', override: true, quiet: true })
dotenv.config({ quiet: true })

const prisma = new PrismaClient()

const BASE_URL = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:3006'
const ORG_ID = process.env.AUDIT_ORG_ID || 'cmnxogi8s0006mm9mrutfjs1v'
const PASSWORD = process.env.AUDIT_PASSWORD || 'E2E-Test-P@ssw0rd-2026!'
const IT_EMAIL = process.env.AUDIT_IT_EMAIL || 'e2e-it-worker@lionheart-test.com'
const MAINT_EMAIL = process.env.AUDIT_MAINT_EMAIL || 'e2e-maint-worker@lionheart-test.com'
const WORKFLOW_MODE = process.env.AUDIT_WORKFLOW_MODE || 'desktop'

const outDir = path.join(process.cwd(), 'docs', 'audit-artifacts')
const screenshotDir = path.join(outDir, 'screenshots')
fs.mkdirSync(screenshotDir, { recursive: true })

const results = []

const IT_COORDINATOR_PERMISSIONS = [
  'it:ticket:submit',
  'it:ticket:read:all',
  'it:ticket:update:status',
  'it:ticket:assign',
  'it:ticket:comment:internal',
  'it:ticket:comment:submitter',
  'settings:read',
  'users:read',
  'calendars:read',
  'calendar-events:read',
  'academic:read',
  'messaging:access',
]

const MAINTENANCE_HEAD_PERMISSIONS = [
  'maintenance:submit',
  'maintenance:read:all',
  'maintenance:update:all',
  'maintenance:update:own',
  'maintenance:assign',
  'maintenance:claim',
  'maintenance:approve:qa',
  'maintenance:cancel',
  'maintenance:assets:manage',
  'maintenance:pm:manage',
  'maintenance:analytics:view',
  'maintenance:technicians:manage',
  'assets:read',
  'assets:create',
  'assets:update',
  'assets:delete',
  'knowledge-base:read',
  'settings:read',
  'users:read',
  'calendars:read',
  'calendar-events:read',
  'academic:read',
  'messaging:access',
]

function nowIso() {
  return new Date().toISOString()
}

function summarize(data) {
  if (!data || typeof data !== 'object') return data
  const item = data.data ?? data
  return {
    id: item.id,
    ticketNumber: item.ticketNumber,
    title: item.title,
    status: item.status,
    assignedToId: item.assignedToId,
  }
}

function permissionParts(value) {
  const [resource, action, scope = 'global'] = value.split(':')
  return { resource, action, scope }
}

async function ensureRole(slug, name, description, permissions) {
  const role = await prisma.role.upsert({
    where: { organizationId_slug: { organizationId: ORG_ID, slug } },
    create: {
      organizationId: ORG_ID,
      slug,
      name,
      description,
      isSystem: true,
    },
    update: {
      name,
      description,
      isSystem: true,
    },
    select: { id: true },
  })

  for (const permission of permissions) {
    const parts = permissionParts(permission)
    const permissionRow = await prisma.permission.upsert({
      where: { resource_action_scope: parts },
      create: {
        ...parts,
        description: `${name}: ${permission}`,
      },
      update: {},
      select: { id: true },
    })
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permissionRow.id } },
      create: { roleId: role.id, permissionId: permissionRow.id },
      update: {},
    })
  }

  return role
}

async function ensureWorkerUsers() {
  const org = await prisma.organization.findUnique({
    where: { id: ORG_ID },
    select: { id: true, name: true },
  })
  if (!org) throw new Error(`Organization not found: ${ORG_ID}`)

  const [itRole, maintRole] = await Promise.all([
    ensureRole(
      'it-coordinator',
      'IT Coordinator',
      'Campus IT staff who manage IT tickets and close help desk work.',
      IT_COORDINATOR_PERMISSIONS,
    ),
    ensureRole(
      'maintenance-head',
      'Head of Maintenance',
      'Maintenance lead who assigns work, logs costs, reviews QA, and closes work orders.',
      MAINTENANCE_HEAD_PERMISSIONS,
    ),
  ])

  const passwordHash = await bcrypt.hash(PASSWORD, 10)

  const itUser = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: ORG_ID, email: IT_EMAIL } },
    create: {
      organizationId: ORG_ID,
      email: IT_EMAIL,
      firstName: 'E2E',
      lastName: 'IT Worker',
      passwordHash,
      roleId: itRole.id,
      status: 'ACTIVE',
      emailVerified: true,
      jobTitle: 'IT Coordinator',
    },
    update: {
      passwordHash,
      roleId: itRole.id,
      status: 'ACTIVE',
      emailVerified: true,
      deletedAt: null,
      jobTitle: 'IT Coordinator',
    },
    select: { id: true, email: true },
  })

  const maintUser = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: ORG_ID, email: MAINT_EMAIL } },
    create: {
      organizationId: ORG_ID,
      email: MAINT_EMAIL,
      firstName: 'E2E',
      lastName: 'Maintenance Worker',
      passwordHash,
      roleId: maintRole.id,
      status: 'ACTIVE',
      emailVerified: true,
      jobTitle: 'Head of Maintenance',
    },
    update: {
      passwordHash,
      roleId: maintRole.id,
      status: 'ACTIVE',
      emailVerified: true,
      deletedAt: null,
      jobTitle: 'Head of Maintenance',
    },
    select: { id: true, email: true },
  })

  const teams = await Promise.all([
    prisma.team.upsert({
      where: { organizationId_slug: { organizationId: ORG_ID, slug: 'it-support' } },
      create: {
        organizationId: ORG_ID,
        slug: 'it-support',
        name: 'IT Support',
        description: 'Technical infrastructure, hardware, and software support',
      },
      update: {
        name: 'IT Support',
        description: 'Technical infrastructure, hardware, and software support',
      },
      select: { id: true, slug: true },
    }),
    prisma.team.upsert({
      where: { organizationId_slug: { organizationId: ORG_ID, slug: 'maintenance' } },
      create: {
        organizationId: ORG_ID,
        slug: 'maintenance',
        name: 'Facility Maintenance',
        description: 'Physical campus upkeep and repairs',
      },
      update: {
        name: 'Facility Maintenance',
        description: 'Physical campus upkeep and repairs',
      },
      select: { id: true, slug: true },
    }),
  ])

  for (const team of teams) {
    if (team.slug === 'it-support') {
      await prisma.userTeam.upsert({
        where: { userId_teamId: { userId: itUser.id, teamId: team.id } },
        create: { userId: itUser.id, teamId: team.id },
        update: {},
      })
    }
    if (team.slug === 'maintenance') {
      await prisma.userTeam.upsert({
        where: { userId_teamId: { userId: maintUser.id, teamId: team.id } },
        create: { userId: maintUser.id, teamId: team.id },
        update: {},
      })
    }
  }

  await prisma.technicianProfile.upsert({
    where: { userId: maintUser.id },
    create: {
      organizationId: ORG_ID,
      userId: maintUser.id,
      specialties: ['ELECTRICAL', 'PLUMBING', 'HVAC', 'STRUCTURAL', 'CUSTODIAL_BIOHAZARD', 'IT_AV', 'GROUNDS', 'OTHER'],
      maxActiveTickets: 20,
      loadedHourlyRate: 62,
      isActive: true,
    },
    update: {
      specialties: ['ELECTRICAL', 'PLUMBING', 'HVAC', 'STRUCTURAL', 'CUSTODIAL_BIOHAZARD', 'IT_AV', 'GROUNDS', 'OTHER'],
      maxActiveTickets: 20,
      loadedHourlyRate: 62,
      isActive: true,
    },
  })

  return { org, itUser, maintUser }
}

async function login(context, email) {
  const response = await context.request.post(`${BASE_URL}/api/auth/login`, {
    headers: { 'Content-Type': 'application/json', 'x-e2e-run': 'local' },
    data: { email, password: PASSWORD, organizationId: ORG_ID },
  })
  const json = await response.json().catch(() => null)
  if (!response.ok() || !json?.ok) {
    throw new Error(`Login failed for ${email}: ${response.status()} ${JSON.stringify(json)}`)
  }
  return json.data
}

async function csrf(context) {
  const cookie = (await context.cookies(BASE_URL)).find((c) => c.name === 'csrf-token')
  if (!cookie?.value) throw new Error('Missing csrf-token cookie after login.')
  return cookie.value
}

async function api(context, method, target, data, label, expectedStatus = [200]) {
  const started = Date.now()
  const headers = { 'Content-Type': 'application/json' }
  if (!['GET', 'HEAD'].includes(method)) {
    headers['X-CSRF-Token'] = await csrf(context)
  }

  const response = await context.request.fetch(`${BASE_URL}${target}`, {
    method,
    headers,
    data,
  })
  const body = await response.json().catch(() => null)
  const durationMs = Date.now() - started
  const passed = expectedStatus.includes(response.status()) && body?.ok !== false

  results.push({
    label,
    method,
    path: target,
    status: response.status(),
    durationMs,
    passed,
    summary: summarize(body),
    error: passed ? null : body?.error ?? body,
  })

  if (!passed) {
    throw new Error(`${label} failed: ${response.status()} ${JSON.stringify(body)}`)
  }

  return body.data
}

async function checkPage(context, target, label, screenshotName) {
  const page = await context.newPage()
  const consoleErrors = []
  const failedRequests = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 500))
  })
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText || 'unknown'
    if (failure === 'net::ERR_ABORTED' && request.url().includes('_rsc=')) return
    failedRequests.push({ url: request.url().replace(BASE_URL, ''), failure })
  })

  const started = Date.now()
  let bodyText = ''
  let status = null
  let error = null
  try {
    const response = await page.goto(`${BASE_URL}${target}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    status = response?.status() ?? null
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {})
    bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')
    await page.screenshot({ path: path.join(screenshotDir, screenshotName), fullPage: false }).catch(() => {})
  } catch (err) {
    error = err instanceof Error ? err.message : String(err)
  } finally {
    await page.close().catch(() => {})
  }

  const durationMs = Date.now() - started
  const lower = bodyText.toLowerCase()
  const badText = lower.includes('application error') || lower.includes('something went wrong') || lower.includes('internal server error')
  const passed = status === 200 && !badText && consoleErrors.length === 0 && failedRequests.length === 0 && !error

  results.push({
    label,
    method: 'BROWSER',
    path: target,
    status,
    durationMs,
    passed,
    screenshot: path.join('audit-artifacts', 'screenshots', screenshotName),
    consoleErrors,
    failedRequests,
    error,
  })

  if (!passed) throw new Error(`${label} page check failed.`)
}

function contextOptions(mode) {
  if (mode === 'mobile') {
    return {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      baseURL: BASE_URL,
    }
  }

  return { viewport: { width: 1440, height: 900 }, baseURL: BASE_URL }
}

async function runItWorkflow(browser, itUser, mode = 'desktop') {
  const isMobile = mode === 'mobile'
  const context = await browser.newContext(contextOptions(mode))
  await login(context, IT_EMAIL)

  const stamp = Date.now()
  const ticket = await api(context, 'POST', '/api/it/tickets', {
    title: `${isMobile ? 'Mobile ' : ''}Audit IT Workflow ${stamp}`,
    description: `${isMobile ? 'Mobile audit' : 'Audit'} ticket: staff laptop cannot reach the campus Wi-Fi.`,
    issueType: 'NETWORK',
    priority: 'HIGH',
    photos: [],
  }, `${isMobile ? 'Mobile ' : ''}IT worker creates a ticket`, [201])

  const openedTicket = await api(context, 'GET', `/api/it/tickets/${ticket.id}`, undefined, `${isMobile ? 'Mobile ' : ''}IT worker opens the ticket`)
  await api(context, 'PATCH', `/api/it/tickets/${ticket.id}/assign`, { assignedToId: itUser.id }, `${isMobile ? 'Mobile ' : ''}IT worker claims the ticket`)
  if (openedTicket.status === 'PENDING_APPROVAL') {
    await api(context, 'PATCH', `/api/it/tickets/${ticket.id}/status`, {
      status: 'TODO',
      comment: `${isMobile ? 'Mobile audit' : 'Audit'}: approved request for IT queue.`,
    }, `${isMobile ? 'Mobile ' : ''}IT worker approves ticket into the queue`)
  }
  await api(context, 'PATCH', `/api/it/tickets/${ticket.id}/status`, {
    status: 'IN_PROGRESS',
    comment: `${isMobile ? 'Mobile audit' : 'Audit'}: started network troubleshooting.`,
  }, `${isMobile ? 'Mobile ' : ''}IT worker starts work`)

  if (isMobile) {
    await checkPage(context, '/it', 'Mobile IT worker sees active ticket queue', 'mobile-worker-it-active-queue.png')
  }

  await api(context, 'PATCH', `/api/it/tickets/${ticket.id}/status`, {
    status: 'ON_HOLD',
    holdReason: 'USER_AVAILABILITY',
    holdNote: `${isMobile ? 'Mobile audit' : 'Audit'}: waiting for staff member to return with the laptop.`,
    comment: `${isMobile ? 'Mobile audit' : 'Audit'}: paused until device is available.`,
  }, `${isMobile ? 'Mobile ' : ''}IT worker puts ticket on hold`)
  await api(context, 'PATCH', `/api/it/tickets/${ticket.id}/status`, {
    status: 'IN_PROGRESS',
    comment: `${isMobile ? 'Mobile audit' : 'Audit'}: device is available again.`,
  }, `${isMobile ? 'Mobile ' : ''}IT worker resumes work`)
  const resolved = await api(context, 'PATCH', `/api/it/tickets/${ticket.id}/status`, {
    status: 'DONE',
    resolutionNote: `${isMobile ? 'Mobile audit' : 'Audit'}: renewed Wi-Fi profile and verified access.`,
    comment: `${isMobile ? 'Mobile audit' : 'Audit'}: ticket resolved.`,
  }, `${isMobile ? 'Mobile ' : ''}IT worker resolves the ticket`)

  await api(context, 'GET', `/api/it/tickets/${ticket.id}`, undefined, `${isMobile ? 'Mobile ' : ''}IT worker reopens resolved ticket`)
  await checkPage(
    context,
    '/it',
    isMobile ? 'Mobile IT worker page opens cleanly' : 'IT worker page opens cleanly',
    isMobile ? 'mobile-worker-it-page.png' : 'worker-it-page.png',
  )

  await context.close()
  return resolved
}

async function runMaintenanceWorkflow(browser, maintUser, mode = 'desktop') {
  const isMobile = mode === 'mobile'
  const context = await browser.newContext(contextOptions(mode))
  await login(context, MAINT_EMAIL)

  const stamp = Date.now()
  const ticket = await api(context, 'POST', '/api/maintenance/tickets', {
    title: `${isMobile ? 'Mobile ' : ''}Audit Maintenance Workflow ${stamp}`,
    description: `${isMobile ? 'Mobile audit' : 'Audit'} work order: restroom sink is leaking under the basin.`,
    category: 'PLUMBING',
    priority: 'HIGH',
    photos: [],
    availabilityNote: `${isMobile ? 'Mobile audit' : 'Audit'}: room is available after 2 PM.`,
  }, `${isMobile ? 'Mobile ' : ''}Maintenance worker creates a work order`, [201])

  await api(context, 'GET', `/api/maintenance/tickets/${ticket.id}`, undefined, `${isMobile ? 'Mobile ' : ''}Maintenance worker opens the work order`)
  await api(context, 'POST', `/api/maintenance/tickets/${ticket.id}/claim`, undefined, `${isMobile ? 'Mobile ' : ''}Maintenance worker claims the work order`)
  await api(context, 'PATCH', `/api/maintenance/tickets/${ticket.id}/status`, {
    status: 'IN_PROGRESS',
    comment: `${isMobile ? 'Mobile audit' : 'Audit'}: started repair.`,
  }, `${isMobile ? 'Mobile ' : ''}Maintenance worker starts work`)

  if (isMobile) {
    await checkPage(
      context,
      `/maintenance/tickets/${ticket.id}`,
      'Mobile maintenance worker opens active work order detail',
      'mobile-worker-maintenance-active-detail.png',
    )
  }

  await api(context, 'POST', `/api/maintenance/tickets/${ticket.id}/labor`, {
    technicianId: maintUser.id,
    startTime: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    durationMinutes: 45,
    notes: `${isMobile ? 'Mobile audit' : 'Audit'}: diagnosed leak and replaced supply line.`,
  }, `${isMobile ? 'Mobile ' : ''}Maintenance worker logs labor`, [201])
  await api(context, 'POST', `/api/maintenance/tickets/${ticket.id}/costs`, {
    vendor: 'Audit Supply',
    description: 'Replacement braided supply line',
    amount: 18.75,
  }, `${isMobile ? 'Mobile ' : ''}Maintenance worker logs material cost`, [201])
  await api(context, 'PATCH', `/api/maintenance/tickets/${ticket.id}`, {
    estimatedRepairCostUSD: 18.75,
    photos: ['https://example.com/audit-maintenance-photo.jpg'],
  }, `${isMobile ? 'Mobile ' : ''}Maintenance worker adds cost estimate and photo`)
  await api(context, 'PATCH', `/api/maintenance/tickets/${ticket.id}/status`, {
    status: 'QA',
    completionNote: `${isMobile ? 'Mobile audit' : 'Audit'}: replaced leaking supply line and checked for drips.`,
    completionPhotos: ['https://example.com/audit-maintenance-complete.jpg'],
    comment: `${isMobile ? 'Mobile audit' : 'Audit'}: submitted for QA.`,
  }, `${isMobile ? 'Mobile ' : ''}Maintenance worker submits work for QA`)
  const done = await api(context, 'PATCH', `/api/maintenance/tickets/${ticket.id}/status`, {
    status: 'DONE',
    comment: `${isMobile ? 'Mobile audit' : 'Audit'}: QA approved and work order closed.`,
  }, `${isMobile ? 'Mobile ' : ''}Maintenance worker closes the work order`)

  await api(context, 'GET', `/api/maintenance/tickets/${ticket.id}`, undefined, `${isMobile ? 'Mobile ' : ''}Maintenance worker reopens closed work order`)
  await api(context, 'GET', `/api/maintenance/tickets/${ticket.id}/labor`, undefined, `${isMobile ? 'Mobile ' : ''}Maintenance worker sees labor log`)
  await api(context, 'GET', `/api/maintenance/tickets/${ticket.id}/costs?summary=true`, undefined, `${isMobile ? 'Mobile ' : ''}Maintenance worker sees cost summary`)
  await checkPage(
    context,
    '/maintenance',
    isMobile ? 'Mobile maintenance worker page opens cleanly' : 'Maintenance worker page opens cleanly',
    isMobile ? 'mobile-worker-maintenance-page.png' : 'worker-maintenance-page.png',
  )

  await context.close()
  return done
}

async function main() {
  const setup = await ensureWorkerUsers()
  const browser = await chromium.launch({ headless: true })

  let itTicket = null
  let maintenanceTicket = null
  try {
    itTicket = await runItWorkflow(browser, setup.itUser, WORKFLOW_MODE)
    maintenanceTicket = await runMaintenanceWorkflow(browser, setup.maintUser, WORKFLOW_MODE)
  } finally {
    await browser.close().catch(() => {})
    await prisma.$disconnect().catch(() => {})
  }

  const report = {
    createdAt: nowIso(),
    mode: WORKFLOW_MODE,
    baseUrl: BASE_URL,
    organization: setup.org,
    users: {
      it: setup.itUser,
      maintenance: setup.maintUser,
    },
    finalTickets: {
      it: summarize(itTicket),
      maintenance: summarize(maintenanceTicket),
    },
    totals: {
      steps: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      slowest: [...results].sort((a, b) => b.durationMs - a.durationMs).slice(0, 8),
    },
    results,
  }

  const outPath = path.join(outDir, WORKFLOW_MODE === 'mobile' ? 'mobile-worker-workflows.json' : 'worker-workflows.json')
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`Wrote ${outPath}`)
  console.log(`Steps: ${report.totals.passed}/${report.totals.steps} passed`)
}

main().catch(async (error) => {
  const outPath = path.join(outDir, WORKFLOW_MODE === 'mobile' ? 'mobile-worker-workflows.json' : 'worker-workflows.json')
  fs.writeFileSync(outPath, JSON.stringify({
    createdAt: nowIso(),
    baseUrl: BASE_URL,
    error: error instanceof Error ? error.message : String(error),
    totals: {
      steps: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
    },
    results,
  }, null, 2))
  await prisma.$disconnect().catch(() => {})
  console.error(error)
  process.exit(1)
})
