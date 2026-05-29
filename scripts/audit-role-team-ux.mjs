#!/usr/bin/env node

/**
 * Role and team UX audit.
 *
 * Checks whether each major user type gets the right home mode, desktop
 * navigation, mobile tab, and basic route access. Writes JSON + HTML evidence.
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

const BASE_URL = process.env.AUDIT_BASE_URL || process.env.E2E_BASE_URL || 'http://127.0.0.1:3011'
const PASSWORD = process.env.AUDIT_PASSWORD || process.env.E2E_ADMIN_PASSWORD || 'E2E-Test-P@ssw0rd-2026!'
const ORG_ID = process.env.AUDIT_ORG_ID || process.env.E2E_ORG_A_ID || ''
const ORG_SLUG = process.env.AUDIT_ORG_SLUG || process.env.E2E_ORG_A_SLUG || ''

const outDir = path.join(process.cwd(), 'docs', 'audit-artifacts')
fs.mkdirSync(outDir, { recursive: true })

const rolePerms = {
  'role-audit-it-worker': [
    'it:ticket:submit',
    'it:ticket:read:all',
    'it:ticket:update:status',
    'it:ticket:assign',
    'it:ticket:comment:internal',
    'it:ticket:comment:submitter',
    'it:device:read',
    'it:deployment:process',
    'it:provisioning:view',
    'it:cipa:audit:view',
    'it:incident:read',
    'inventory:read',
    'settings:read',
    'users:read',
    'calendars:read',
    'calendar-events:read',
    'messaging:access',
  ],
  'role-audit-maintenance-worker': [
    'maintenance:submit',
    'maintenance:read:all',
    'maintenance:update:all',
    'maintenance:update:own',
    'maintenance:assign',
    'maintenance:claim',
    'maintenance:approve:qa',
    'assets:read',
    'knowledge-base:read',
    'inventory:read',
    'settings:read',
    'users:read',
    'calendars:read',
    'calendar-events:read',
    'messaging:access',
  ],
  'role-audit-av-worker': [
    'events:read',
    'events:project:read',
    'events:project:update:all',
    'events:project:approve',
    'inventory:read',
    'settings:read',
    'calendars:read',
    'calendar-events:read',
    'messaging:access',
  ],
  'role-audit-viewer': [
    'tickets:read:own',
    'events:read',
    'calendar-events:read',
    'calendars:read',
    'settings:read',
  ],
}

const auditUsers = [
  {
    key: 'superAdmin',
    label: 'Super Admin',
    email: process.env.E2E_ADMIN_EMAIL || 'e2e-admin@lionheart-test.com',
    roleSlug: 'super-admin',
    createIfMissing: true,
    teamSlug: null,
    expectedMode: 'admin',
    expectedTeams: [],
    desktopMustSee: ['Dashboard', 'Calendar', 'Forms', 'Approvals', 'Maintenance', 'IT Help Desk', 'A/V Production', 'Leo'],
    desktopMustNotSee: [],
    mobileMustSee: ['Dashboard', 'Calendar', 'Messages', 'Approvals', 'More'],
    mobileMustNotSee: ['IT Tickets', 'Work Orders', 'Tickets'],
  },
  {
    key: 'admin',
    label: 'Admin',
    email: 'e2e-role-admin@lionheart-test.com',
    roleSlug: 'admin',
    createIfMissing: true,
    teamSlug: null,
    expectedMode: 'admin',
    expectedTeams: [],
    desktopMustSee: ['Dashboard', 'Calendar', 'Forms', 'Approvals', 'Leo'],
    desktopMustNotSee: ['IT Help Desk', 'Maintenance', 'A/V Production'],
    mobileMustSee: ['Dashboard', 'Calendar', 'Messages', 'Approvals', 'More'],
    mobileMustNotSee: ['IT Tickets', 'Work Orders', 'Tickets'],
  },
  {
    key: 'itWorker',
    label: 'IT Worker',
    email: 'e2e-role-it@lionheart-test.com',
    roleSlug: 'role-audit-it-worker',
    roleName: 'Role Audit IT Worker',
    teamSlug: 'it-support',
    teamName: 'IT Support',
    expectedMode: 'it',
    expectedTeams: ['it-support'],
    desktopMustSee: ['Dashboard', 'Calendar', 'IT Help Desk', 'Help Desk', 'Devices', 'Lifecycle', 'Security', 'Inventory', 'Leo'],
    desktopMustNotSee: ['Forms', 'Maintenance', 'A/V Production'],
    mobileMustSee: ['Dashboard', 'Calendar', 'Messages', 'IT Tickets', 'More'],
    mobileMustNotSee: ['Approvals', 'Work Orders'],
  },
  {
    key: 'maintenanceWorker',
    label: 'Maintenance Worker',
    email: 'e2e-role-maintenance@lionheart-test.com',
    roleSlug: 'role-audit-maintenance-worker',
    roleName: 'Role Audit Maintenance Worker',
    teamSlug: 'maintenance',
    teamName: 'Facility Maintenance',
    expectedMode: 'maintenance',
    expectedTeams: ['maintenance'],
    desktopMustSee: ['Dashboard', 'Calendar', 'Maintenance', 'Maintenance Hub', 'Work Orders', 'Assets', 'Knowledge Base', 'Inventory', 'Leo'],
    desktopMustNotSee: ['Forms', 'IT Help Desk', 'A/V Production'],
    mobileMustSee: ['Dashboard', 'Calendar', 'Messages', 'Work Orders', 'More'],
    mobileMustNotSee: ['Approvals', 'IT Tickets'],
  },
  {
    key: 'avWorker',
    label: 'A/V Worker',
    email: 'e2e-role-av@lionheart-test.com',
    roleSlug: 'role-audit-av-worker',
    roleName: 'Role Audit A/V Worker',
    teamSlug: 'av-production',
    teamName: 'A/V Production',
    expectedMode: 'av',
    expectedTeams: ['av-production'],
    desktopMustSee: ['Dashboard', 'Calendar', 'Approvals', 'A/V Production', 'Event Approvals', 'Leo'],
    desktopMustNotSee: ['Forms', 'IT Help Desk', 'Maintenance'],
    mobileMustSee: ['Dashboard', 'Calendar', 'Messages', 'Tickets', 'More'],
    mobileMustNotSee: ['IT Tickets', 'Work Orders'],
  },
  {
    key: 'member',
    label: 'Teacher / Staff Member',
    email: process.env.E2E_MEMBER_EMAIL || 'e2e-member@lionheart-test.com',
    roleSlug: 'member',
    createIfMissing: true,
    teamSlug: null,
    expectedMode: 'default',
    expectedTeams: [],
    desktopMustSee: ['Dashboard', 'Calendar', 'Leo'],
    desktopMustNotSee: ['Forms', 'Approvals', 'IT Help Desk', 'Maintenance', 'A/V Production'],
    mobileMustSee: ['Dashboard', 'Calendar', 'Messages', 'Tickets', 'More'],
    mobileMustNotSee: ['Approvals', 'IT Tickets', 'Work Orders'],
  },
  {
    key: 'viewer',
    label: 'Viewer',
    email: 'e2e-role-viewer@lionheart-test.com',
    roleSlug: 'viewer',
    fallbackRoleSlug: 'role-audit-viewer',
    roleName: 'Role Audit Viewer',
    teamSlug: null,
    expectedMode: 'default',
    expectedTeams: [],
    desktopMustSee: ['Dashboard', 'Calendar', 'Leo'],
    desktopMustNotSee: ['Forms', 'Approvals', 'IT Help Desk', 'Maintenance', 'A/V Production'],
    mobileMustSee: ['Dashboard', 'Calendar', 'Messages', 'Tickets', 'More'],
    mobileMustNotSee: ['Approvals', 'IT Tickets', 'Work Orders'],
  },
]

const roleScenarios = {
  superAdmin: [
    { path: '/settings?tab=users', shouldShow: true, expected: [/Members/i, /Invite|Add member|Users/i] },
    { path: '/settings?tab=roles', shouldShow: true, expected: [/Roles/i, /Create role|New role|Permissions/i] },
    { path: '/approvals', shouldShow: true, expected: [/Approvals|Pending|Approved/i] },
    { path: '/it', shouldShow: true, expected: [/Help Desk|IT Help Desk|New Ticket|Create Ticket/i] },
    { path: '/maintenance', shouldShow: true, expected: [/Maintenance|Work Orders|New Work Order|Submit Request/i] },
    { path: '/av/event-approvals', shouldShow: true, expected: [/All clear!|Approve|Reject|Event Approvals/i] },
  ],
  admin: [
    { path: '/settings?tab=users', shouldShow: true, expected: [/Members/i, /Invite|Add member|Users/i] },
    { path: '/settings?tab=roles', shouldShow: true, expected: [/Roles/i, /Create role|New role|Permissions/i] },
    { path: '/approvals', shouldShow: true, expected: [/Approvals|Pending|Approved/i] },
    { path: '/it/devices', shouldShow: false, expected: [/Devices|Asset Tag|Inventory/i] },
    { path: '/maintenance/assets', shouldShow: false, expected: [/Assets|Equipment|Location/i] },
  ],
  itWorker: [
    { path: '/it', shouldShow: true, expected: [/Help Desk|IT Help Desk|New Ticket|Create Ticket/i] },
    { path: '/it/devices', shouldShow: true, expected: [/Devices|Asset Tag|Inventory/i] },
    { path: '/it/lifecycle', shouldShow: true, expected: [/Lifecycle|Provision|Deployment/i] },
    { path: '/it/security', shouldShow: true, expected: [/Security|Incident|CIPA|Filter/i] },
    { path: '/settings?tab=roles', shouldShow: false, expected: [/Create role|New role|Permissions/i] },
    { path: '/maintenance/assets', shouldShow: false, expected: [/Assets|Equipment|Location/i] },
  ],
  maintenanceWorker: [
    { path: '/maintenance', shouldShow: true, expected: [/Maintenance|Work Orders|New Work Order|Submit Request/i] },
    { path: '/maintenance/assets', shouldShow: true, expected: [/Assets|Equipment|Location/i] },
    { path: '/maintenance/knowledge-base', shouldShow: true, expected: [/Knowledge Base|Articles|Search/i] },
    { path: '/maintenance/pm-calendar', shouldShow: true, expected: [/Preventive|PM|Calendar|Schedule/i] },
    { path: '/settings?tab=roles', shouldShow: false, expected: [/Create role|New role|Permissions/i] },
    { path: '/it/devices', shouldShow: false, expected: [/Devices|Asset Tag|Inventory/i] },
  ],
  avWorker: [
    { path: '/av/event-approvals', shouldShow: true, expected: [/All clear!|Approve|Reject|Event Approvals/i] },
    { path: '/approvals', shouldShow: true, expected: [/Approvals|Pending|Approved/i] },
    { path: '/events', shouldShow: true, expected: [/Events|Create Event|Calendar/i] },
    { path: '/it/devices', shouldShow: false, expected: [/Devices|Asset Tag|Inventory/i] },
    { path: '/maintenance/assets', shouldShow: false, expected: [/Assets|Equipment|Location/i] },
  ],
  member: [
    { path: '/tickets', shouldShow: true, expected: [/Tickets|Submit|Request/i] },
    { path: '/calendar', shouldShow: true, expected: [/Calendar|Today|Month/i] },
    { path: '/forms', shouldShow: false, expected: [/Forms|Create Form|Template|Builder/i] },
    { path: '/settings?tab=roles', shouldShow: false, expected: [/Create role|New role|Permissions/i] },
    { path: '/approvals', shouldShow: false, expected: [/Approve|Reject|Pending approvals/i] },
    { path: '/it/devices', shouldShow: false, expected: [/Devices|Asset Tag|Inventory/i] },
    { path: '/maintenance/assets', shouldShow: false, expected: [/Assets|Equipment|Location/i] },
  ],
  viewer: [
    { path: '/dashboard', shouldShow: true, expected: [/Dashboard|Today|Upcoming/i] },
    { path: '/calendar', shouldShow: true, expected: [/Calendar|Today|Month/i] },
    { path: '/forms', shouldShow: false, expected: [/Forms|Create Form|Template|Builder/i] },
    { path: '/settings?tab=roles', shouldShow: false, expected: [/Create role|New role|Permissions/i] },
    { path: '/approvals', shouldShow: false, expected: [/Approve|Reject|Pending approvals/i] },
    { path: '/it/devices', shouldShow: false, expected: [/Devices|Asset Tag|Inventory/i] },
    { path: '/maintenance/assets', shouldShow: false, expected: [/Assets|Equipment|Location/i] },
  ],
}

function permissionParts(value) {
  const [resource, action, scope = 'global'] = value.split(':')
  return { resource, action, scope }
}

function slugToName(slug) {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function htmlEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

async function getOrg() {
  if (ORG_ID) {
    const org = await prisma.organization.findUnique({ where: { id: ORG_ID }, select: { id: true, name: true, slug: true } })
    if (org) return org
  }
  if (ORG_SLUG) {
    const org = await prisma.organization.findFirst({ where: { slug: ORG_SLUG }, select: { id: true, name: true, slug: true } })
    if (org) return org
  }
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true, slug: true } })
  if (!org) throw new Error('No organization found for role UX audit.')
  return org
}

async function ensureRole(orgId, slug, name, permissions = []) {
  const role = await prisma.role.upsert({
    where: { organizationId_slug: { organizationId: orgId, slug } },
    create: {
      organizationId: orgId,
      slug,
      name: name || slugToName(slug),
      description: `Temporary role for role/team UX audit.`,
      isSystem: true,
    },
    update: {
      name: name || slugToName(slug),
      description: `Temporary role for role/team UX audit.`,
    },
    select: { id: true, slug: true, name: true },
  })

  for (const permission of permissions) {
    const parts = permissionParts(permission)
    const permissionRow = await prisma.permission.upsert({
      where: { resource_action_scope: parts },
      create: { ...parts, description: `Role UX audit: ${permission}` },
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

async function findOrCreateRole(orgId, profile) {
  const slugs = [profile.roleSlug, profile.fallbackRoleSlug].filter(Boolean)
  for (const slug of slugs) {
    const existing = await prisma.role.findFirst({
      where: { organizationId: orgId, OR: [{ slug }, { name: { equals: slug, mode: 'insensitive' } }] },
      select: { id: true, slug: true, name: true },
    })
    if (existing) {
      const permissions = rolePerms[existing.slug] || rolePerms[profile.fallbackRoleSlug || ''] || []
      if (permissions.length > 0) {
        return ensureRole(orgId, existing.slug, existing.name, permissions)
      }
      return existing
    }
  }

  return ensureRole(
    orgId,
    profile.fallbackRoleSlug || profile.roleSlug,
    profile.roleName || slugToName(profile.fallbackRoleSlug || profile.roleSlug),
    rolePerms[profile.fallbackRoleSlug || profile.roleSlug] || [],
  )
}

async function ensureTeam(orgId, slug, name) {
  if (!slug) return null
  return prisma.team.upsert({
    where: { organizationId_slug: { organizationId: orgId, slug } },
    create: {
      organizationId: orgId,
      slug,
      name: name || slugToName(slug),
      description: `Temporary team for role/team UX audit.`,
    },
    update: { name: name || slugToName(slug) },
    select: { id: true, slug: true, name: true },
  })
}

async function ensureUser(orgId, profile, passwordHash) {
  const role = await findOrCreateRole(orgId, profile)
  const team = await ensureTeam(orgId, profile.teamSlug, profile.teamName)
  const user = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: orgId, email: profile.email } },
    create: {
      organizationId: orgId,
      email: profile.email,
      firstName: 'E2E',
      lastName: profile.label,
      passwordHash,
      roleId: role.id,
      status: 'ACTIVE',
      emailVerified: true,
      jobTitle: profile.label,
    },
    update: {
      passwordHash,
      roleId: role.id,
      status: 'ACTIVE',
      emailVerified: true,
      deletedAt: null,
      jobTitle: profile.label,
    },
    select: { id: true, email: true },
  })

  if (team) {
    await prisma.userTeam.upsert({
      where: { userId_teamId: { userId: user.id, teamId: team.id } },
      create: { userId: user.id, teamId: team.id },
      update: {},
    })
  }

  return { user, role, team }
}

async function loginContext(browser, profile, viewport) {
  const context = await browser.newContext({ viewport })
  const res = await context.request.post(`${BASE_URL}/api/auth/login`, {
    data: { email: profile.email, password: PASSWORD, organizationId: profile.organizationId },
    headers: { 'content-type': 'application/json', 'x-e2e-run': 'role-team-ux-audit' },
  })
  const body = await res.text()
  if (res.status() !== 200) {
    await context.close()
    throw new Error(`${profile.label} login failed: ${res.status()} ${body}`)
  }
  return context
}

async function getApiState(browser, profile) {
  const context = await loginContext(browser, profile, { width: 1280, height: 900 })
  const [meRes, permRes] = await Promise.all([
    context.request.get(`${BASE_URL}/api/auth/me`),
    context.request.get(`${BASE_URL}/api/auth/permissions`),
  ])
  const me = await meRes.json().catch(() => null)
  const perms = await permRes.json().catch(() => null)
  await context.close()
  return { meStatus: meRes.status(), permStatus: permRes.status(), me, perms }
}

async function labelVisible(page, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = page.getByText(new RegExp(`^${escaped}$`, 'i')).first()
  return match.isVisible({ timeout: 750 }).catch(() => false)
}

async function expandIfVisible(page, labelPattern) {
  const button = page.getByRole('button', { name: labelPattern }).first()
  if (await button.isVisible({ timeout: 750 }).catch(() => false)) {
    const expanded = await button.getAttribute('aria-expanded').catch(() => null)
    if (expanded !== 'true') await button.click()
  }
}

async function checkDesktop(browser, profile) {
  const context = await loginContext(browser, profile, { width: 1366, height: 900 })
  const page = await context.newPage()
  const consoleErrors = []
  const failedRequests = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('requestfailed', (req) => failedRequests.push(req.url()))
  page.on('response', (res) => {
    if (res.status() === 403) {
      consoleErrors.push(`403 ${res.url().replace(BASE_URL, '')}`)
    }
  })

  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
  await expandIfVisible(page, /IT Help Desk/i)
  await expandIfVisible(page, /maintenance/i)
  await expandIfVisible(page, /A\/V Production/i)

  const visible = {}
  for (const label of [...profile.desktopMustSee, ...profile.desktopMustNotSee]) {
    visible[label] = await labelVisible(page, label)
  }

  const appError = await page.getByText(/application error|something went wrong|failed to load/i).first().isVisible().catch(() => false)
  await context.close()
  return { visible, consoleErrors, failedRequests, appError }
}

async function checkMobile(browser, profile) {
  const context = await loginContext(browser, profile, { width: 390, height: 844, isMobile: true })
  const page = await context.newPage()
  const consoleErrors = []
  const failedRequests = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('requestfailed', (req) => failedRequests.push(req.url()))
  page.on('response', (res) => {
    if (res.status() === 403) {
      consoleErrors.push(`403 ${res.url().replace(BASE_URL, '')}`)
    }
  })

  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})

  const visible = {}
  for (const label of [...profile.mobileMustSee, ...profile.mobileMustNotSee]) {
    const button = page.locator('.mobile-tab-bar').getByRole('button', { name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).first()
    visible[label] = await button.isVisible({ timeout: 750 }).catch(() => false)
  }

  const appError = await page.getByText(/application error|something went wrong|failed to load/i).first().isVisible().catch(() => false)
  await context.close()
  return { visible, consoleErrors, failedRequests, appError }
}

function hasPermission(apiState, field) {
  return Boolean(apiState?.perms?.data?.[field])
}

function hasTeam(apiState, slug) {
  return Boolean(apiState?.perms?.data?.userTeams?.some((team) => team.slug === slug))
}

function expectedRouteVisibility(route, apiState) {
  if (route.path === '/forms') {
    return hasPermission(apiState, 'canManageForms')
  }

  if (route.path === '/it/devices') {
    return [
      'canReadDevices',
      'canReadStudents',
      'canManageLoaners',
      'canCheckoutLoaner',
      'canCheckinLoaner',
    ].some((field) => hasPermission(apiState, field))
  }

  if (route.path === '/maintenance/assets') {
    return hasPermission(apiState, 'canManageMaintenance') ||
      hasPermission(apiState, 'canClaimMaintenance') ||
      hasTeam(apiState, 'maintenance')
  }

  return route.shouldShow
}

async function checkRoutes(browser, profile, apiState) {
  const routes = roleScenarios[profile.key] || []

  const context = await loginContext(browser, profile, { width: 1280, height: 900 })
  const page = await context.newPage()
  const routeResults = []

  for (const route of routes) {
    const shouldShow = expectedRouteVisibility(route, apiState)
    const res = await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'domcontentloaded' }).catch(() => null)
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {})
    const status = res?.status() ?? 0
    const content = page.locator('main').first()
    const searchRoot = await content.count().catch(() => 0) > 0 ? content : page.locator('body')
    const visibleMatches = []
    for (const pattern of route.expected) {
      const visible = await searchRoot.getByText(pattern).first().isVisible({ timeout: 750 }).catch(() => false)
      if (visible) visibleMatches.push(pattern.toString())
    }
    const hasExpectedUi = visibleMatches.length > 0
    const hasDenied = await searchRoot.getByText(/forbidden|not authorized|access denied|insufficient permissions|access limited/i).first().isVisible({ timeout: 750 }).catch(() => false)
    const hasAppError = await searchRoot.getByText(/application error|something went wrong|internal server error/i).first().isVisible({ timeout: 750 }).catch(() => false)
    routeResults.push({
      path: route.path,
      status,
      shouldShow,
      hasExpectedUi,
      visibleMatches,
      hasDenied,
      hasAppError,
      pass: shouldShow
        ? status < 500 && !hasDenied && !hasAppError && hasExpectedUi
        : status < 500 && !hasAppError && (!hasExpectedUi || hasDenied),
    })
  }

  await context.close()
  return routeResults
}

function addCheck(checks, name, pass, details = '') {
  checks.push({ name, pass: Boolean(pass), details })
}

function buildHtml(report) {
  const rows = report.roles.map((role) => {
    const status = role.pass ? 'Pass' : 'Needs work'
    const issues = role.checks.filter((c) => !c.pass).map((c) => c.name).join('; ') || 'None'
    return `<tr><td>${htmlEscape(role.label)}</td><td class="${role.pass ? 'pass' : 'fail'}">${status}</td><td>${htmlEscape(role.api.dashboardMode || '')}</td><td>${htmlEscape((role.api.teamSlugs || []).join(', ') || 'none')}</td><td>${htmlEscape(issues)}</td></tr>`
  }).join('\n')

  const detail = report.roles.map((role) => {
    const checks = role.checks.map((c) => `<li class="${c.pass ? 'pass' : 'fail'}">${c.pass ? 'PASS' : 'NEEDS WORK'}: ${htmlEscape(c.name)}${c.details ? ` — ${htmlEscape(c.details)}` : ''}</li>`).join('\n')
    return `<section><h2>${htmlEscape(role.label)}</h2><ul>${checks}</ul></section>`
  }).join('\n')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Lionheart Role and Team UX Audit</title>
  <style>
    body { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f8fafc; color: #0f172a; line-height: 1.5; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 20px 56px; }
    h1 { font-size: 32px; margin: 0 0 8px; }
    h2 { font-size: 20px; margin: 28px 0 10px; }
    p { margin: 0 0 16px; color: #475569; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; font-size: 14px; }
    th { background: #f1f5f9; color: #334155; }
    section { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 18px; margin-top: 18px; }
    ul { margin: 0; padding-left: 22px; }
    .pass { color: #166534; }
    .fail { color: #b91c1c; font-weight: 700; }
    .summary { display: inline-block; padding: 6px 10px; border-radius: 999px; background: ${report.pass ? '#dcfce7' : '#fee2e2'}; color: ${report.pass ? '#166534' : '#991b1b'}; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <h1>Lionheart Role and Team UX Audit</h1>
    <p>Run at ${htmlEscape(report.generatedAt)} against ${htmlEscape(report.baseUrl)}.</p>
    <p><span class="summary">${report.pass ? 'All checked roles passed.' : `${report.failCount} checks need work.`}</span></p>
    <table>
      <thead><tr><th>User type</th><th>Status</th><th>Home mode</th><th>Team</th><th>Issues</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${detail}
  </main>
</body>
</html>`
}

async function main() {
  const org = await getOrg()
  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  for (const profile of auditUsers) {
    profile.organizationId = org.id
    await ensureUser(org.id, profile, passwordHash)
  }

  const browser = await chromium.launch({ headless: true })
  const roles = []

  try {
    for (const profile of auditUsers) {
      console.log(`Checking ${profile.label}...`)
      const apiState = await getApiState(browser, profile)
      const dashboardMode = apiState.me?.data?.user?.dashboardMode
      const teamSlugs = apiState.me?.data?.user?.teamSlugs || []
      const permissionsTeams = apiState.perms?.data?.userTeams?.map((t) => t.slug) || []
      const desktop = await checkDesktop(browser, profile)
      const mobile = await checkMobile(browser, profile)
      const routes = await checkRoutes(browser, profile, apiState)

      const checks = []
      addCheck(checks, 'Login and current-user API works', apiState.meStatus === 200 && apiState.permStatus === 200, `me=${apiState.meStatus}, permissions=${apiState.permStatus}`)
      addCheck(checks, `Home mode is ${profile.expectedMode}`, dashboardMode === profile.expectedMode, `actual=${dashboardMode || 'missing'}`)
      for (const teamSlug of profile.expectedTeams) {
        addCheck(checks, `Team includes ${teamSlug}`, teamSlugs.includes(teamSlug) && permissionsTeams.includes(teamSlug), `auth=${teamSlugs.join(',') || 'none'}, permissions=${permissionsTeams.join(',') || 'none'}`)
      }
      for (const label of profile.desktopMustSee) addCheck(checks, `Desktop shows ${label}`, desktop.visible[label], '')
      for (const label of profile.desktopMustNotSee) addCheck(checks, `Desktop hides ${label}`, !desktop.visible[label], '')
      for (const label of profile.mobileMustSee) addCheck(checks, `Mobile shows ${label}`, mobile.visible[label], '')
      for (const label of profile.mobileMustNotSee) addCheck(checks, `Mobile hides ${label}`, !mobile.visible[label], '')
      addCheck(checks, 'Desktop has no browser app error', !desktop.appError && desktop.consoleErrors.length === 0, desktop.consoleErrors.slice(0, 2).join(' | '))
      addCheck(checks, 'Mobile has no browser app error', !mobile.appError && mobile.consoleErrors.length === 0, mobile.consoleErrors.slice(0, 2).join(' | '))
      for (const route of routes) {
        addCheck(checks, `${route.shouldShow ? 'Can use' : 'Does not expose'} ${route.path}`, route.pass, `status=${route.status}, expectedUi=${route.hasExpectedUi}, denied=${route.hasDenied}, appError=${route.hasAppError}, matches=${route.visibleMatches.join(', ') || 'none'}`)
      }

      roles.push({
        key: profile.key,
        label: profile.label,
        pass: checks.every((c) => c.pass),
        api: { dashboardMode, teamSlugs, permissionsTeams },
        desktop,
        mobile,
        routes,
        checks,
      })
    }
  } finally {
    await browser.close()
    await prisma.$disconnect()
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    organization: org,
    roles,
  }
  report.failCount = roles.reduce((count, role) => count + role.checks.filter((c) => !c.pass).length, 0)
  report.pass = report.failCount === 0

  const jsonPath = path.join(outDir, 'role-team-ux-audit.json')
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2))

  const htmlPath = path.join(process.cwd(), 'docs', 'role-team-ux-audit-2026-05-26.html')
  fs.writeFileSync(htmlPath, buildHtml(report))

  console.log(`\nRole/team UX audit: ${report.pass ? 'PASS' : 'NEEDS WORK'}`)
  console.log(`JSON: ${jsonPath}`)
  console.log(`HTML: ${htmlPath}`)

  if (!report.pass) process.exitCode = 1
}

main().catch(async (error) => {
  await prisma.$disconnect().catch(() => {})
  console.error(error)
  process.exit(1)
})
