/**
 * Dietary and Medical Report API.
 *
 * GET /api/events/projects/[id]/dietary-medical
 *
 * Returns aggregated dietary needs and medical info across all registered
 * participants for the event project.
 *
 * FERPA gate: Requires events:medical:read permission (admin-only).
 * This is separate from events:groups:manage to protect sensitive data.
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getDietaryMedicalReport } from '@/lib/services/eventGroupService'

// ─── GET ──────────────────────────────────────────────────────────────────────

export const GET = withAuth(async ({ params }) => {
  const report = await getDietaryMedicalReport(params.id)
  return NextResponse.json(ok(report))
}, { permission: PERMISSIONS.EVENTS_MEDICAL_READ })
