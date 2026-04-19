/**
 * POST /api/ai/ticket-intake/submit — Create ticket or log self-resolution from AI intake
 *
 * Called after the conversational AI flow when the user either:
 * - Confirms a ticket summary → creates the IT/maintenance ticket
 * - Reports self-resolution → logs it for analytics
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma } from '@/lib/db'
import { logger } from '@/lib/logger'

const log = logger.child({ route: '/api/ai/ticket-intake/submit' })

const ticketSubmitSchema = z.object({
  action: z.enum(['submit_ticket', 'self_resolved', 'abandoned']),
  // For submit_ticket
  module: z.enum(['IT', 'MAINTENANCE']).optional(),
  category: z.string().optional(),
  title: z.string().max(500).optional(),
  description: z.string().max(5000).optional(),
  priority: z.string().optional(),
  locationText: z.string().max(500).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
  // For self_resolved
  issueDescription: z.string().max(2000).optional(),
  resolutionNote: z.string().max(2000).optional(),
  // Source context
  source: z.enum(['DASHBOARD', 'QR_CODE', 'MAGIC_LINK']).default('DASHBOARD'),
  // For unauthenticated
  orgId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = ticketSubmitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid data', parsed.error.issues), { status: 400 })
    }

    const data = parsed.data

    // Auth
    let orgId: string
    let userId: string | null = null
    try {
      orgId = getOrgIdFromRequest(req)
      const ctx = await getUserContext(req)
      userId = ctx.userId
    } catch {
      if (!data.orgId) {
        return NextResponse.json(fail('AUTH_REQUIRED', 'Authentication or orgId required'), { status: 401 })
      }
      orgId = data.orgId
    }

    if (data.action === 'submit_ticket') {
      if (!data.title || !data.description || !data.module) {
        return NextResponse.json(fail('VALIDATION_ERROR', 'Title, description, and module are required'), { status: 400 })
      }

      const ticket = await runWithOrgContext(orgId, async () => {
        if (data.module === 'IT') {
          const counter = await rawPrisma.iTTicketCounter.upsert({
            where: { organizationId: orgId },
            create: { organizationId: orgId, lastNumber: 1 },
            update: { lastNumber: { increment: 1 } },
          })

          return rawPrisma.iTTicket.create({
            data: {
              organizationId: orgId,
              ticketNumber: `IT-${String(counter.lastNumber).padStart(4, '0')}`,
              title: data.title!,
              description: data.description!,
              issueType: data.category ?? 'OTHER',
              priority: data.priority ?? 'NORMAL',
              status: 'OPEN',
              source: 'AI_INTAKE',
              locationText: data.locationText ?? null,
              customFields: data.customFields ?? undefined,
              submittedById: userId,
            },
            select: { id: true, ticketNumber: true },
          })
        } else {
          // Maintenance ticket
          const counter = await rawPrisma.maintenanceCounter.upsert({
            where: { organizationId: orgId },
            create: { organizationId: orgId, lastNumber: 1 },
            update: { lastNumber: { increment: 1 } },
          })

          return rawPrisma.maintenanceTicket.create({
            data: {
              organizationId: orgId,
              ticketNumber: `MR-${String(counter.lastNumber).padStart(4, '0')}`,
              title: data.title!,
              description: data.description!,
              category: data.category ?? 'OTHER',
              priority: data.priority ?? 'NORMAL',
              status: 'OPEN',
              source: 'AI_INTAKE',
              locationText: data.locationText ?? null,
              customFields: data.customFields ?? undefined,
              submittedById: userId,
            },
            select: { id: true, ticketNumber: true },
          })
        }
      })

      // Log the intake session
      await rawPrisma.aiTicketIntake.create({
        data: {
          organizationId: orgId,
          outcome: 'SUBMITTED',
          ticketId: ticket.id,
          ticketModule: data.module,
          category: data.category,
          issueDescription: data.description!,
          source: data.source,
          locationText: data.locationText,
          userId,
        },
      })

      return NextResponse.json(ok(ticket), { status: 201 })
    }

    if (data.action === 'self_resolved') {
      await rawPrisma.aiTicketIntake.create({
        data: {
          organizationId: orgId,
          outcome: 'SELF_RESOLVED',
          category: data.category,
          issueDescription: data.issueDescription ?? 'Issue self-resolved',
          resolutionNote: data.resolutionNote,
          source: data.source,
          locationText: data.locationText,
          userId,
        },
      })

      return NextResponse.json(ok({ selfResolved: true }))
    }

    if (data.action === 'abandoned') {
      await rawPrisma.aiTicketIntake.create({
        data: {
          organizationId: orgId,
          outcome: 'ABANDONED',
          category: data.category,
          issueDescription: data.issueDescription ?? 'Session abandoned',
          source: data.source,
          userId,
        },
      })

      return NextResponse.json(ok({ abandoned: true }))
    }

    return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid action'), { status: 400 })
  } catch (err) {
    log.error({ err: String(err) }, 'Ticket intake submit failed')
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
