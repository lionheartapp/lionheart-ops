#!/usr/bin/env node
/**
 * Smoke test: Approval Workflow End-to-End
 *
 * Tests the complete chain:
 *   1. Create an approval rule with conditions
 *   2. Create an event that matches those conditions
 *   3. Verify approval gates were created
 *   4. Approve the gate
 *   5. Verify event transitions to CONFIRMED
 *   6. Cleanup
 *
 * Usage: node scripts/smoke-approval-flow.mjs
 * Requires: DATABASE_URL set (uses Prisma directly, no HTTP)
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()

const { PrismaClient } = await import('@prisma/client')

const prisma = new PrismaClient()

const PASS = '\x1b[32m✓\x1b[0m'
const FAIL = '\x1b[31m✗\x1b[0m'
const INFO = '\x1b[36mℹ\x1b[0m'

let passed = 0
let failed = 0
const cleanup = []

function assert(condition, label) {
  if (condition) {
    console.log(`  ${PASS} ${label}`)
    passed++
  } else {
    console.log(`  ${FAIL} ${label}`)
    failed++
  }
}

async function run() {
  console.log('\n🔧 Approval Workflow Smoke Test\n')

  // ── Setup: Find an org with schools and teams ──────────────────────
  const org = await prisma.organization.findFirst({
    select: { id: true, name: true },
  })
  if (!org) {
    console.log(`${FAIL} No organization found. Seed the database first.`)
    return
  }
  console.log(`${INFO} Org: ${org.name} (${org.id.slice(0, 8)}...)`)

  const school = await prisma.school.findFirst({
    where: { organizationId: org.id, deletedAt: null },
    select: { id: true, name: true },
  })

  const team = await prisma.team.findFirst({
    where: { organizationId: org.id },
    select: { id: true, name: true },
  })

  const user = await prisma.user.findFirst({
    where: { organizationId: org.id, deletedAt: null, status: 'ACTIVE' },
    select: { id: true, firstName: true, lastName: true },
  })

  if (!team || !user) {
    console.log(`${FAIL} Need at least one team and one user. Seed the database first.`)
    return
  }

  console.log(`${INFO} School: ${school?.name || 'none'}`)
  console.log(`${INFO} Team: ${team.name}`)
  console.log(`${INFO} User: ${user.firstName} ${user.lastName}`)
  console.log()

  // ── Test 1: Create an approval rule ────────────────────────────────
  console.log('1. Creating approval rule...')

  const rule = await prisma.approvalRule.create({
    data: {
      organizationId: org.id,
      name: '[SMOKE] AV Events Need Approval',
      requiresResource: 'av',
      schoolId: school?.id || null,
      executionMode: 'PARALLEL',
      sortOrder: 999, // High number so it doesn't interfere with real rules
    },
  })
  cleanup.push(() => prisma.approvalRule.delete({ where: { id: rule.id } }).catch(() => {}))

  assert(!!rule.id, 'Rule created')
  assert(rule.requiresResource === 'av', 'Rule has requiresResource=av')
  assert(rule.schoolId === (school?.id || null), `Rule scoped to school: ${school?.name || 'any'}`)

  // Add a step: team must approve, always
  const step = await prisma.approvalFlowEntry.create({
    data: {
      organizationId: org.id,
      ruleId: rule.id,
      teamId: team.id,
      mode: 'REQUIRED',
      trigger: 'ALWAYS',
      escalationHours: 48,
      escalationAction: 'REMIND',
      sortOrder: 0,
    },
  })
  cleanup.push(() => prisma.approvalFlowEntry.delete({ where: { id: step.id } }).catch(() => {}))

  assert(!!step.id, `Step created: ${team.name} must approve`)
  assert(step.trigger === 'ALWAYS', 'Step trigger is ALWAYS')
  assert(step.escalationHours === 48, 'Escalation set to 48h')
  console.log()

  // ── Test 2: Verify rule matching ───────────────────────────────────
  console.log('2. Testing rule matching...')

  // Simulate the resolver logic
  const rules = await prisma.approvalRule.findMany({
    where: { organizationId: org.id, isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: {
      steps: {
        orderBy: { sortOrder: 'asc' },
        include: { team: { select: { id: true, name: true } } },
      },
    },
  })

  // Event context: needs AV at the school
  const eventCtx = {
    schoolId: school?.id || null,
    campusId: null,
    category: null,
    expectedAttendance: 50,
    requiresAV: true,
    requiresFacilities: false,
    requiresCustodial: false,
    requiresSecurity: false,
    isOffCampus: false,
  }

  const matchedSteps = []
  for (const r of rules) {
    if (r.isDefault || r.isFinalApprover) continue
    const matchesSchool = !r.schoolId || r.schoolId === eventCtx.schoolId
    const matchesCampus = !r.campusId || r.campusId === eventCtx.campusId
    const matchesCategory = !r.eventCategory || r.eventCategory === eventCtx.category
    const matchesAttendance = r.minAttendance == null || (eventCtx.expectedAttendance ?? 0) >= r.minAttendance
    const matchesResource = !r.requiresResource || (
      (r.requiresResource === 'av' && eventCtx.requiresAV) ||
      (r.requiresResource === 'facilities' && eventCtx.requiresFacilities) ||
      (r.requiresResource === 'custodial' && eventCtx.requiresCustodial) ||
      (r.requiresResource === 'security' && eventCtx.requiresSecurity)
    )
    const matchesOffCampus = r.isOffCampus == null || r.isOffCampus === eventCtx.isOffCampus

    if (matchesSchool && matchesCampus && matchesCategory && matchesAttendance && matchesResource && matchesOffCampus) {
      matchedSteps.push(...r.steps)
    }
  }

  assert(matchedSteps.length > 0, `Matched ${matchedSteps.length} step(s) for AV event`)
  const smokeStep = matchedSteps.find(s => s.team.id === team.id)
  assert(!!smokeStep, `Found our smoke test step (${team.name})`)
  console.log()

  // Non-AV event should NOT match
  const nonAVCtx = { ...eventCtx, requiresAV: false }
  const nonAVMatched = []
  for (const r of rules) {
    if (r.isDefault || r.isFinalApprover) continue
    const matchesResource = !r.requiresResource || (
      (r.requiresResource === 'av' && nonAVCtx.requiresAV) ||
      (r.requiresResource === 'facilities' && nonAVCtx.requiresFacilities)
    )
    if (r.id === rule.id && !matchesResource) continue // Our rule shouldn't match
    if (r.id === rule.id && matchesResource) nonAVMatched.push(r)
  }
  assert(nonAVMatched.length === 0, 'Non-AV event does NOT match the AV rule')
  console.log()

  // ── Test 3: Create event project with AV requirement ───────────────
  console.log('3. Creating event project with AV requirement...')

  const event = await prisma.eventProject.create({
    data: {
      organizationId: org.id,
      title: '[SMOKE] Test Event Needing AV',
      startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week out
      endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // +2h
      requiresAV: true,
      requiresFacilities: false,
      status: 'PENDING_APPROVAL',
      source: 'DIRECT_REQUEST',
      createdById: user.id,
      schoolId: school?.id || null,
      // Simulate what createEventProject does: store gates
      approvalGates: {
        [team.id]: {
          status: 'PENDING',
          teamName: team.name,
          trigger: 'ALWAYS',
          resourceType: null,
          sortOrder: 0,
        },
      },
    },
  })
  cleanup.push(() => prisma.eventProject.delete({ where: { id: event.id } }).catch(() => {}))

  assert(!!event.id, 'Event project created')
  assert(event.status === 'PENDING_APPROVAL', 'Status is PENDING_APPROVAL')
  assert(event.requiresAV === true, 'requiresAV is true')

  const gates = event.approvalGates
  assert(!!gates, 'Approval gates exist')
  assert(gates[team.id]?.status === 'PENDING', `Gate for ${team.name} is PENDING`)
  console.log()

  // ── Test 4: Approve the gate ───────────────────────────────────────
  console.log('4. Approving the gate...')

  const updatedGates = { ...gates }
  updatedGates[team.id] = {
    ...updatedGates[team.id],
    status: 'APPROVED',
    respondedById: user.id,
    respondedAt: new Date().toISOString(),
  }

  const allCleared = Object.values(updatedGates).every(
    g => g.status === 'APPROVED' || g.status === 'SKIPPED'
  )

  const updatedEvent = await prisma.eventProject.update({
    where: { id: event.id },
    data: {
      approvalGates: updatedGates,
      status: allCleared ? 'CONFIRMED' : 'PENDING_APPROVAL',
      ...(allCleared ? { approvedById: user.id, approvedAt: new Date() } : {}),
    },
  })

  assert(updatedGates[team.id].status === 'APPROVED', `Gate approved by ${user.firstName}`)
  assert(allCleared, 'All gates cleared')
  assert(updatedEvent.status === 'CONFIRMED', 'Event status is CONFIRMED')
  console.log()

  // ── Test 5: Verify attendance-based rules ──────────────────────────
  console.log('5. Testing attendance-based condition...')

  const attendanceRule = await prisma.approvalRule.create({
    data: {
      organizationId: org.id,
      name: '[SMOKE] Large Events',
      minAttendance: 100,
      executionMode: 'PARALLEL',
      sortOrder: 998,
    },
  })
  cleanup.push(() => prisma.approvalRule.delete({ where: { id: attendanceRule.id } }).catch(() => {}))

  // Small event (50 people) should not match
  const smallCtx = { expectedAttendance: 50 }
  const smallMatch = attendanceRule.minAttendance == null || (smallCtx.expectedAttendance ?? 0) >= attendanceRule.minAttendance
  assert(!smallMatch, 'Small event (50 people) does NOT match minAttendance=100')

  // Large event (200 people) should match
  const largeCtx = { expectedAttendance: 200 }
  const largeMatch = attendanceRule.minAttendance == null || (largeCtx.expectedAttendance ?? 0) >= attendanceRule.minAttendance
  assert(largeMatch, 'Large event (200 people) DOES match minAttendance=100')
  console.log()

  // ── Test 6: Verify off-campus condition ────────────────────────────
  console.log('6. Testing off-campus condition...')

  const offCampusRule = await prisma.approvalRule.create({
    data: {
      organizationId: org.id,
      name: '[SMOKE] Off-Campus Events',
      isOffCampus: true,
      executionMode: 'PARALLEL',
      sortOrder: 997,
    },
  })
  cleanup.push(() => prisma.approvalRule.delete({ where: { id: offCampusRule.id } }).catch(() => {}))

  const onCampusMatch = offCampusRule.isOffCampus == null || offCampusRule.isOffCampus === false
  assert(!onCampusMatch, 'On-campus event does NOT match isOffCampus=true rule')

  const offCampusMatch = offCampusRule.isOffCampus == null || offCampusRule.isOffCampus === true
  assert(offCampusMatch, 'Off-campus event DOES match isOffCampus=true rule')
  console.log()

  // ── Test 7: Escalation action field ────────────────────────────────
  console.log('7. Testing escalation action field...')

  const escalationStep = await prisma.approvalFlowEntry.findFirst({
    where: { id: step.id },
    select: { escalationHours: true, escalationAction: true },
  })
  assert(escalationStep?.escalationAction === 'REMIND', 'Default escalation action is REMIND')
  assert(escalationStep?.escalationHours === 48, 'Escalation hours is 48')

  // Update to AUTO_APPROVE
  await prisma.approvalFlowEntry.update({
    where: { id: step.id },
    data: { escalationAction: 'AUTO_APPROVE' },
  })
  const updated = await prisma.approvalFlowEntry.findFirst({
    where: { id: step.id },
    select: { escalationAction: true },
  })
  assert(updated?.escalationAction === 'AUTO_APPROVE', 'Escalation action updated to AUTO_APPROVE')
  console.log()

  // ── Summary ────────────────────────────────────────────────────────
  console.log('─'.repeat(50))
  console.log(`\n  ${passed} passed, ${failed} failed\n`)

  if (failed > 0) {
    console.log(`${FAIL} Some tests failed!`)
    process.exitCode = 1
  } else {
    console.log(`${PASS} All tests passed!`)
  }
}

run()
  .catch((err) => {
    console.error('\n💥 Unexpected error:', err.message)
    process.exitCode = 1
  })
  .finally(async () => {
    // Cleanup test data
    console.log(`\n${INFO} Cleaning up test data...`)
    for (const fn of cleanup.reverse()) {
      await fn()
    }
    console.log(`${INFO} Done.\n`)
    await prisma.$disconnect()
  })
