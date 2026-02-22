import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'
import { corsHeaders } from '@/lib/cors'
import { requireActivePlan, PlanRestrictedError } from '@/lib/planCheck'

/** GET /api/inventory — Fetch all inventory items and stock for the organization */
export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const orgId = getOrgId()
      const [items, stock] = await Promise.all([
        prisma.inventoryItem.findMany({
          orderBy: { name: 'asc' },
          include: { owner: { select: { id: true, name: true, email: true } } },
        }),
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
        usageNotes: s.usageNotes ?? undefined,
      }))

      return NextResponse.json(
        {
          items: items.map((i) => ({
            id: i.id,
            name: i.name,
            teamId: i.teamId,
            description: i.description ?? undefined,
            ownerId: i.ownerId ?? undefined,
            owner: i.owner ? { id: i.owner.id, name: i.owner.name, email: i.owner.email } : undefined,
            allowCheckout: i.allowCheckout,
            checkoutCategory: i.checkoutCategory ?? undefined,
            manufacturer: i.manufacturer ?? undefined,
            model: i.model ?? undefined,
            serialNumbers: i.serialNumbers ?? undefined,
            imageUrl: i.imageUrl ?? undefined,
            documentationLinks: i.documentationLinks ?? undefined,
            tags: i.tags ?? undefined,
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
      await requireActivePlan(prismaBase, getOrgId()!)
      const body = (await req.json()) as
        | { name: string; teamId?: string; description?: string; ownerId?: string; allowCheckout?: boolean; checkoutCategory?: string; manufacturer?: string; model?: string; serialNumbers?: string; imageUrl?: string; documentationLinks?: string; tags?: string }
        | { itemId: string; location: string; quantity: number; usageNotes?: string }

      if ('itemId' in body && body.itemId && 'location' in body && typeof body.quantity === 'number') {
        const { itemId, location, quantity, usageNotes } = body
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
            usageNotes: typeof usageNotes === 'string' ? usageNotes.trim() || null : null,
          },
        })
        return NextResponse.json(
          { id: stock.id, itemId: stock.itemId, location: stock.location, quantity: stock.quantity, usageNotes: stock.usageNotes ?? undefined },
          { headers: corsHeaders }
        )
      }

      const {
        name,
        teamId,
        description,
        ownerId,
        allowCheckout,
        checkoutCategory,
        manufacturer,
        model,
        serialNumbers,
        imageUrl,
        documentationLinks,
        tags,
      } = body as {
        name: string
        teamId?: string
        description?: string
        ownerId?: string
        allowCheckout?: boolean
        checkoutCategory?: string
        manufacturer?: string
        model?: string
        serialNumbers?: string
        imageUrl?: string
        documentationLinks?: string
        tags?: string
      }
      if (!name?.trim()) {
        return NextResponse.json({ error: 'Missing name' }, { status: 400, headers: corsHeaders })
      }

      const orgId = getOrgId()
      const item = await prisma.inventoryItem.create({
        data: {
          organizationId: orgId ?? undefined,
          name: name.trim(),
          teamId: teamId?.trim() || null,
          description: description?.trim() || null,
          ownerId: ownerId?.trim() || null,
          allowCheckout: allowCheckout === true,
          checkoutCategory: checkoutCategory?.trim() || null,
          manufacturer: manufacturer?.trim() || null,
          model: model?.trim() || null,
          serialNumbers: serialNumbers?.trim() || null,
          imageUrl: imageUrl?.trim() || null,
          documentationLinks: documentationLinks?.trim() || null,
          tags: tags?.trim() || null,
        },
      })
      const withOwner = await prisma.inventoryItem.findUnique({
        where: { id: item.id },
        include: { owner: { select: { id: true, name: true, email: true } } },
      })
      return NextResponse.json(
        {
          id: item.id,
          name: item.name,
          teamId: item.teamId,
          description: item.description ?? undefined,
          ownerId: item.ownerId ?? undefined,
          owner: withOwner?.owner ? { id: withOwner.owner.id, name: withOwner.owner.name, email: withOwner.owner.email } : undefined,
          allowCheckout: item.allowCheckout,
          checkoutCategory: item.checkoutCategory ?? undefined,
          manufacturer: item.manufacturer ?? undefined,
          model: item.model ?? undefined,
          serialNumbers: item.serialNumbers ?? undefined,
          imageUrl: item.imageUrl ?? undefined,
          documentationLinks: item.documentationLinks ?? undefined,
          tags: item.tags ?? undefined,
        },
        { headers: corsHeaders }
      )
    })
  } catch (err) {
    if (err instanceof PlanRestrictedError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 402, headers: corsHeaders })
    }
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
