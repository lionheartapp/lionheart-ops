import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { listItems, createItem, createAVEquipment, CreateItemSchema, CreateAVEquipmentSchema } from '@/lib/services/inventoryService'
import { embedInventoryItem } from '@/lib/services/ai/embeddingTriggers'
import { parsePagination, paginationMeta } from '@/lib/pagination'
import { prisma } from '@/lib/db'

export const GET = withAuth(async ({ req, orgId, searchParams }) => {
  // TODO: replace with proper paginated list UI. For now, allow up to 500 items
  // per request so the inventory page doesn't silently truncate at 25. Default
  // remains 25 for callers that opt in to smaller pages.
  const { page, limit, skip } = parsePagination(searchParams, 25, 500)
  const search = searchParams.get('search') || undefined
  const category = searchParams.get('category') || undefined
  // Multi-category filter: ?categories=AV Equipment,Cables & Adapters
  const categoriesParam = searchParams.get('categories')
  const categories = categoriesParam ? categoriesParam.split(',').map(c => c.trim()).filter(Boolean) : undefined

  const where: Record<string, unknown> = {}
  if (search) where.name = { contains: search, mode: 'insensitive' }
  if (categories && categories.length > 0) where.category = { in: categories }
  else if (category) where.category = category

  const [total, items] = await Promise.all([
    prisma.inventoryItem.count({ where }),
    listItems(orgId, { search, category, categories, skip, take: limit }),
  ])

  return NextResponse.json(ok(items, paginationMeta(total, { page, limit, skip })))
}, { permission: PERMISSIONS.INVENTORY_READ })

export const POST = withAuth(async ({ req, orgId }) => {
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
    const item = await createAVEquipment(orgId, parsed.data)
    void embedInventoryItem(item.id, {
      name: item.name,
      description: item.description,
      category: item.category,
    })
    return NextResponse.json(ok(item), { status: 201 })
  }

  // Legacy simple form
  const parsed = CreateItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'Invalid input', parsed.error.issues),
      { status: 400 }
    )
  }

  const item = await createItem(orgId, parsed.data)
  void embedInventoryItem(item.id, {
    name: item.name,
    description: item.description,
    category: item.category,
  })
  return NextResponse.json(ok(item), { status: 201 })
}, { permission: PERMISSIONS.INVENTORY_CREATE })
