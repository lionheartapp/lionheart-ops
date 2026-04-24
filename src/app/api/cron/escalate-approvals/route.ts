/**
 * GET /api/cron/escalate-approvals — escalation cron for stalled approval gates
 *
 * Secured by CRON_SECRET in the Authorization header. Runs across all
 * organizations (no org context needed).
 *
 * For each EventProject with status PENDING_APPROVAL, checks every gate
 * that is still PENDING. If the gate has been pending longer than the
 * configured escalationHours (default 72h), sends a reminder notification
 * to the assigned team members.
 *
 * This job does NOT auto-approve — it only nudges.
 */

import { NextRequest, NextResponse } from 'next/server'
import { rawPrisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { ok, fail } from '@/lib/api-response'
import { logger } from '@/lib/logger'
import * as notificationService from '@/lib/services/notificationService'
import {
  type ApprovalGates,
  type GateType,
  GATE_META,
  getTeamIdForGate,
  getEscalationHoursForGate,
} from '@/lib/services/eventProject-gates'

const log = logger.child({ cron: 'escalate-approvals' })

interface EscalationResult {
  eventProjectId: string
  title: string
  gateKey: string
  teamId: string | null
  membersNotified: number
}

export async function GET(req: NextRequest) {
  // Auth: cron secret
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET?.trim()

  if (!cronSecret) {
    log.error('CRON_SECRET not configured')
    return NextResponse.json(
      fail('CONFIGURATION_ERROR', 'Cron not configured'),
      { status: 500 },
    )
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      fail('UNAUTHORIZED', 'Invalid cron secret'),
      { status: 401 },
    )
  }

  const now = new Date()

  try {
    // Find all event projects currently awaiting approval
    const pendingProjects = await rawPrisma.eventProject.findMany({
      where: {
        status: 'PENDING_APPROVAL',
        deletedAt: null,
        approvalGates: { not: Prisma.JsonNull },
      },
      select: {
        id: true,
        title: true,
        approvalGates: true,
        updatedAt: true,
        createdAt: true,
        organizationId: true,
      },
    })

    log.info({ count: pendingProjects.length }, 'Checking pending projects for stalled gates')

    const escalations: EscalationResult[] = []

    for (const project of pendingProjects) {
      const gates = project.approvalGates as ApprovalGates | null
      if (!gates) continue

      // Use updatedAt as the baseline — it reflects when the project last
      // transitioned to PENDING_APPROVAL (or was resubmitted after rejection).
      const pendingSince = project.updatedAt ?? project.createdAt
      const hoursElapsed = (now.getTime() - new Date(pendingSince).getTime()) / (1000 * 60 * 60)

      for (const [gateKey, gate] of Object.entries(gates)) {
        if (!gate || gate.status !== 'PENDING') continue

        const escalationHours = await getEscalationHoursForGate(gateKey as GateType)

        if (hoursElapsed < escalationHours) continue

        // This gate is stalled — send reminder to team
        const teamId = await getTeamIdForGate(gateKey as GateType)
        if (!teamId) {
          log.warn({ gateKey, eventProjectId: project.id }, 'No team assigned for stalled gate')
          continue
        }

        const members = await rawPrisma.userTeam.findMany({
          where: { teamId },
          select: { userId: true },
        })

        const meta = GATE_META[gateKey as GateType]
        const gateLabel = meta?.label ?? gateKey
        const hoursStalled = Math.round(hoursElapsed)

        for (const member of members) {
          await notificationService.createNotification({
            userId: member.userId,
            type: 'event_invite',
            title: `Reminder: "${project.title}" needs ${gateLabel} approval`,
            body: `This event has been waiting for ${gateLabel} approval for ${hoursStalled} hours. Please review it at your earliest convenience.`,
            linkUrl: meta?.defaultUrl ?? '/events/approvals',
          })
        }

        escalations.push({
          eventProjectId: project.id,
          title: project.title,
          gateKey,
          teamId,
          membersNotified: members.length,
        })

        log.info(
          { eventProjectId: project.id, gateKey, hoursStalled, membersNotified: members.length },
          'Escalation reminder sent',
        )
      }
    }

    log.info({ totalEscalations: escalations.length }, 'Escalation cron completed')

    return NextResponse.json(
      ok({ escalations, totalChecked: pendingProjects.length }),
    )
  } catch (error) {
    log.error({ err: String(error) }, 'Escalation cron failed')
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Escalation cron failed'),
      { status: 500 },
    )
  }
}
