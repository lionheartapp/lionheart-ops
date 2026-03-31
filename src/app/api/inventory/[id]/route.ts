import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { getItem, updateItem, updateAVEquipment, deleteItem, UpdateItemSchema, UpdateAVEquipmentSchema } from '@/lib/services/inventoryService'

export const GET = withAuth(async ({ orgId, params }) => {
  const item = await getItem(orgId, params.id)
  return NextResponse.json(ok(item))
}, { permission: PERMISSIONS.INVENTORY_READ })

export const PUT = withAuth(async ({ req, orgId, params }) => {
  const body = await req.json()

  // AV Equipment update
  if (body.isAVEquipment) {
    const parsed = UpdateAVEquipmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 }
      )
    }
    const item = await updateAVEquipment(orgId, params.id, parsed.data)
    return NextResponse.json(ok(item))
  }

  // Legacy update
  const parsed = UpdateItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
      { status: 400 }
    )
  }

  const item = await updateItem(orgId, params.id, parsed.data)
  return NextResponse.json(ok(item))
}, { permission: PERMISSIONS.INVENTORY_UPDATE })

export const DELETE = withAuth(async ({ orgId, params }) => {
  await deleteItem(orgId, params.id)
  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.INVENTORY_DELETE })
