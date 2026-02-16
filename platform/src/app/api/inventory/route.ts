import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'
import { corsHeaders } from '@/lib/cors'

/** GET /api/inventory — Fetch all inventory items and stock for the organization */
export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const orgId = getOrgId()
      const [items, stock] = await Promise.all([
        prisma.inventoryItem.findMany({ orderBy: { name: 'asc' } }),
        prisma.inventoryStock.findMany({
          where: orgId ? { item: { organizationId: orgId } } : undefined,
          orderBy: [{ itemId: 'asc' }, { location: 'asc' }],
        }),
      ])

      const stockFormatted = stock.map((s) => ({
        id: s.id,
        itemId: s.itemId,
        location: s.location,
        quantity: s.quantity,
      }))

      return NextResponse.json(
        {
          items: items.map((i) => ({
            id: i.id,
            name: i.name,
            teamId: i.teamId,
          })),
          stock: stockFormatted,
        },
        { headers: corsHeaders }
      )
    })
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'Organization ID is required' || err.message === 'Invalid organization')
    ) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    console.error('GET /api/inventory error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch inventory' },
      { status: 500, headers: corsHeaders }
    )
  }
}

/** POST /api/inventory — Create an inventory item or stock entry */
export async function POST(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const body = (await req.json()) as
        | { name: string; teamId?: string }
        | { itemId: string; location: string; quantity: number }

      if ('itemId' in body && body.itemId && 'location' in body && typeof body.quantity === 'number') {
        const { itemId, location, quantity } = body
        if (!itemId?.trim() || !location?.trim()) {
          return NextResponse.json(
            { error: 'Missing itemId or location' },
            { status: 400, headers: corsHeaders }
          )
        }
        const orgId = getOrgId()
        const item = await prisma.inventoryItem.findFirst({
          where: { id: itemId.trim(), ...(orgId ? { organizationId: orgId } : {}) },
        })
        if (!item) {
          return NextResponse.json(
            { error: 'Item not found or access denied' },
            { status: 404, headers: corsHeaders }
          )
        }
        const stock = await prisma.inventoryStock.create({
          data: {
            itemId: itemId.trim(),
            location: location.trim(),
            quantity: Math.max(0, Math.floor(quantity) || 0),
          },
        })
        return NextResponse.json(stock, { headers: corsHeaders })
      }

      const { name, teamId } = body as { name: string; teamId?: string }
      if (!name?.trim()) {
        return NextResponse.json({ error: 'Missing name' }, { status: 400, headers: corsHeaders })
      }

      const item = await prisma.inventoryItem.create({
        data: {
          name: name.trim(),
          teamId: teamId?.trim() || null,
        },
      })
      return NextResponse.json(
        { id: item.id, name: item.name, teamId: item.teamId },
        { headers: corsHeaders }
      )
    })
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'Organization ID is required' || err.message === 'Invalid organization')
    ) {
      return NextResponse.json({ error: err.message }, { status: 401, headers: corsHeaders })
    }
    console.error('POST /api/inventory error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create' },
      { status: 500, headers: corsHeaders }
    )
  }
}
