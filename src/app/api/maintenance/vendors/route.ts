/**
 * GET /api/maintenance/vendors
 *
 * Returns distinct vendor strings from org's cost entries.
 * Optional ?q= param for prefix filtering (case-insensitive ILIKE).
 *
 * Used by CostEntryForm vendor autocomplete.
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getVendorList } from '@/lib/services/laborCostService'

export const GET = withAuth(async ({ orgId, searchParams }) => {
  const q = searchParams.get('q') ?? undefined
  const vendors = await getVendorList(orgId, q)
  return NextResponse.json(ok(vendors))
}, { permission: PERMISSIONS.MAINTENANCE_CLAIM })
