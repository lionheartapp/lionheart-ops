/**
 * POST /api/athletics/mega-import — Full athletics bulk import
 *
 * Accepts a flat array of rows, each containing sport/season/team/player data.
 * Automatically deduplicates and creates the full hierarchy.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { megaImportAthletics } from '@/lib/services/athletics-mega-import'

const MegaImportSchema = z.object({
  rows: z
    .array(
      z.object({
        sport: z.string().min(1),
        season: z.string().min(1),
        team: z.string().min(1),
        level: z.string().optional(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        jerseyNumber: z.string().optional(),
        position: z.string().optional(),
        grade: z.string().optional(),
        height: z.string().optional(),
        weight: z.string().optional(),
      })
    )
    .min(1, 'At least one row is required')
    .max(500, 'Maximum 500 rows per import'),
})

export const POST = withAuth(async ({ body }) => {
  const result = await megaImportAthletics(body.rows)
  return NextResponse.json(ok(result), { status: 201 })
}, { permission: PERMISSIONS.ATHLETICS_ROSTER_MANAGE, schema: MegaImportSchema })
