import { NextRequest, NextResponse } from 'next/server'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { listItems, createItem, createAVEquipment, CreateItemSchema, CreateAVEquipmentSchema } from '@/lib/services/inventoryService'
import { embedInventoryItem } from '@/lib/services/ai/embeddingTriggers'
import { parsePagination, paginationMeta } from '@/lib/pagination'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import * as Sentry from '@sentry/nextjs'

export async function GET(req: NextRequest) {
  const log = logger.child({ route: '/api/inventory', method: 'GET' })
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)
    await assertCan(ctx.userId, PERMISSIONS.INVENTORY_READ)

    const { searchParams } = new URL(req.url)
    const { page, limit, skip } = parsePagination(searchParams)
    const search = searchParams.get('search') || undefined
    const category = searchParams.get('category') || undefined

    return await runWithOrgContext(orgId, async () => {
      const where: Record<string, unknown> = {}
      if (search) where.name = { contains: search, mode: 'insensitive' }
      if (category) where.category = category

      const [total, items] = await Promise.all([
        prisma.inventoryItem.count({ where }),
        listItems(orgId, { search, category, skip, take: limit }),
      ])

      return NextResponse.json(ok(items, paginationMeta(total, { page, limit, skip })))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to list inventory items')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to list inventory items'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const log = logger.child({ route: '/api/inventory', method: 'POST' })
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    Sentry.setTag('org_id', orgId)
    await assertCan(ctx.userId, PERMISSIONS.INVENTORY_CREATE)

    const body = await req.json()

    // AV Equipment 2-step form
    if (body.isAVEquipment) {
      const parsed = CreateAVEquipmentSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
          { status: 400 }
        )
      }
      return await runWithOrgContext(orgId, async () => {
        const item = await createAVEquipment(orgId, parsed.data)
        void embedInventoryItem(item.id, {
          name: item.name,
          description: item.description,
          category: item.category,
        })
        return NextResponse.json(ok(item), { status: 201 })
      })
    }

    // Legacy simple form
    const parsed = CreateItemSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const item = await createItem(orgId, parsed.data)
      void embedInventoryItem(item.id, {
        name: item.name,
        description: item.description,
        category: item.category,
      })
      return NextResponse.json(ok(item), { status: 201 })
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    log.error({ err: error }, 'Failed to create inventory item')
    Sentry.captureException(error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to create inventory item'), { status: 500 })
  }
}
