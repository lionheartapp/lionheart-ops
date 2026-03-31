import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getTransactions } from '@/lib/services/inventoryService'

export const GET = withAuth(async ({ orgId, params }) => {
  const transactions = await getTransactions(orgId, params.id)
  return NextResponse.json(ok(transactions))
}, { permission: PERMISSIONS.INVENTORY_READ })
