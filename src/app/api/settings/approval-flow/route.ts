import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma, type OrgPrismaClient } from '@/lib/db'
import {
  getApprovalFlowEntries,
  addTeamToFlow,
  updateFlowEntry,
  removeFromFlow,
  reorderFlow,
  RESOURCE_TYPES,
} from '@/lib/services/approvalFlowService'

const db = prisma as unknown as OrgPrismaClient

/**
 * GET /api/settings/approval-flow
 * Returns approval flow entries + teams with members for the modal.
 */
export const GET = withAuth(async () => {
  const entries = await getApprovalFlowEntries()

  // Fetch teams with members so the modal can show person picker
  const teams = await db.team.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      members: {
        select: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
          },
        },
      },
    },
  })

  const shapedTeams = teams.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    members: t.members.map((m: { user: { id: string; firstName: string | null; lastName: string | null; email: string; avatar: string | null } }) => ({
      id: m.user.id,
      name: `${m.user.firstName ?? ''} ${m.user.lastName ?? ''}`.trim() || m.user.email,
      email: m.user.email,
      avatar: m.user.avatar,
    })),
  }))

  return NextResponse.json(ok({ entries, teams: shapedTeams, resourceTypes: RESOURCE_TYPES }))
}, { permission: PERMISSIONS.SETTINGS_READ })

const AddSchema = z.object({
  teamId: z.string().min(1),
  mode: z.enum(['REQUIRED', 'NOTIFICATION']),
  trigger: z.enum(['ALWAYS', 'WHEN_RESOURCE_REQUESTED']),
  resourceType: z.string().optional().nullable(),
  escalationHours: z.number().int().min(1).max(720).optional(),
  autoSkipIfNotNeeded: z.boolean().optional(),
  assignedUserId: z.string().optional().nullable(),
})

/**
 * POST /api/settings/approval-flow
 * Add a team to the approval flow.
 */
export const POST = withAuth(async ({ body }) => {
  await addTeamToFlow(body)
  const entries = await getApprovalFlowEntries()
  return NextResponse.json(ok(entries))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: AddSchema })

const UpdateSchema = z.object({
  id: z.string().min(1),
  mode: z.enum(['REQUIRED', 'NOTIFICATION']).optional(),
  trigger: z.enum(['ALWAYS', 'WHEN_RESOURCE_REQUESTED']).optional(),
  resourceType: z.string().optional().nullable(),
  escalationHours: z.number().int().min(1).max(720).optional(),
  autoSkipIfNotNeeded: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  assignedUserId: z.string().optional().nullable(),
})

/**
 * PUT /api/settings/approval-flow
 * Update an existing flow entry.
 */
export const PUT = withAuth(async ({ body }) => {
  const { id, ...data } = body
  await updateFlowEntry(id, data)
  const entries = await getApprovalFlowEntries()
  return NextResponse.json(ok(entries))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: UpdateSchema })

const DeleteSchema = z.object({
  id: z.string().min(1),
})

/**
 * DELETE /api/settings/approval-flow
 * Remove a team from the approval flow.
 */
export const DELETE = withAuth(async ({ body }) => {
  await removeFromFlow(body.id)
  const entries = await getApprovalFlowEntries()
  return NextResponse.json(ok(entries))
}, { permission: PERMISSIONS.SETTINGS_UPDATE, schema: DeleteSchema })
