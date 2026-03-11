import { NextRequest, NextResponse } from 'next/server'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { getItem, updateItem, updateAVEquipment, deleteItem, UpdateItemSchema, UpdateAVEquipmentSchema } from '@/lib/services/inventoryService'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  const log = logger.child({ route: '/api/inventory/[id]', method: 'GET' })
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.INVENTORY_READ)

    return await runWithOrgContext(orgId, async () => {
      const item = await getItem(orgId, id)
      return NextResponse.json(ok(item))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && (error as any).code === 'NOT_FOUND') {
      return NextResponse.json(fail('NOT_FOUND', 'Inventory item not found'), { status: 404 })
    }
    log.error({ err: error }, 'Failed to fetch inventory item')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch inventory item'), { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const log = logger.child({ route: '/api/inventory/[id]', method: 'PUT' })
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.INVENTORY_UPDATE)

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
      return await runWithOrgContext(orgId, async () => {
        const item = await updateAVEquipment(orgId, id, parsed.data)
        return NextResponse.json(ok(item))
      })
    }

    // Legacy update
    const parsed = UpdateItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const item = await updateItem(orgId, id, parsed.data)
      return NextResponse.json(ok(item))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && (error as any).code === 'NOT_FOUND') {
      return NextResponse.json(fail('NOT_FOUND', 'Inventory item not found'), { status: 404 })
    }
    log.error({ err: error }, 'Failed to update inventory item')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to update inventory item'), { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const log = logger.child({ route: '/api/inventory/[id]', method: 'DELETE' })
  try {
    const { id } = await params
    const orgId = getOrgIdFromRequest(req)
    Sentry.setTag('org_id', orgId)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.INVENTORY_DELETE)

    return await runWithOrgContext(orgId, async () => {
      await deleteItem(orgId, id)
      return NextResponse.json(ok({ deleted: true }))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && (error as any).code === 'NOT_FOUND') {
      return NextResponse.json(fail('NOT_FOUND', 'Inventory item not found'), { status: 404 })
    }
    log.error({ err: error }, 'Failed to delete inventory item')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to delete inventory item'), { status: 500 })
  }
}
