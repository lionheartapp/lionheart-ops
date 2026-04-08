/**
 * POST /api/athletics/roster/bulk-import — Bulk import players to a team roster
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { bulkImportRosterPlayers } from '@/lib/services/athleticsService'

const BulkImportSchema = z.object({
  athleticTeamId: z.string().min(1, 'Team is required'),
  players: z
    .array(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        jerseyNumber: z.string().optional(),
        position: z.string().optional(),
        grade: z.string().optional(),
        height: z.string().optional(),
        weight: z.string().optional(),
      })
    )
    .min(1, 'At least one player is required')
    .max(200, 'Maximum 200 players per import'),
})

export const POST = withAuth(async ({ body }) => {
  const result = await bulkImportRosterPlayers(body.athleticTeamId, body.players)
  return NextResponse.json(ok(result), { status: 201 })
}, { permission: PERMISSIONS.ATHLETICS_ROSTER_MANAGE, schema: BulkImportSchema })
