import { NextRequest, NextResponse } from 'next/server'
import { prismaBase, prisma } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'
import { corsHeaders } from '@/lib/cors'
import { requireActivePlan, PlanRestrictedError } from '@/lib/planCheck'

/** PATCH /api/inventory/items/[itemId] — Update inventory item (extended fields) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params
    if (!itemId) {
      return NextResponse.json(
        { error: 'Missing item ID' },
        { status: 400, headers: corsHeaders }
      )
    }

    return await withOrg(req, prismaBase, async () => {
      await requireActivePlan(prismaBase, getOrgId()!)
      const orgId = getOrgId()
      const item = await prisma.inventoryItem.findFirst({
        where: { id: itemId, ...(orgId ? { organizationId: orgId } : {}) },
        include: { owner: { select: { id: true, name: true, email: true } } },
      })
      if (!item) {
        return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders })
      }
      const body = (await req.json()) as {
        name?: string
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
      const updates: {
        name?: string
        teamId?: string | null
        description?: string | null
        ownerId?: string | null
        allowCheckout?: boolean
        checkoutCategory?: string | null
        manufacturer?: string | null
        model?: string | null
        serialNumbers?: string | null
        imageUrl?: string | null
        documentationLinks?: string | null
        tags?: string | null
      } = {}
      if (body.name != null && typeof body.name === 'string') updates.name = body.name.trim()
      if (body.teamId !== undefined) updates.teamId = body.teamId?.trim() || null
      if (body.description !== undefined) updates.description = body.description?.trim() || null
      if (body.ownerId !== undefined) updates.ownerId = body.ownerId?.trim() || null
      if (typeof body.allowCheckout === 'boolean') updates.allowCheckout = body.allowCheckout
      if (body.checkoutCategory !== undefined) updates.checkoutCategory = body.checkoutCategory?.trim() || null
      if (body.manufacturer !== undefined) updates.manufacturer = body.manufacturer?.trim() || null
      if (body.model !== undefined) updates.model = body.model?.trim() || null
      if (body.serialNumbers !== undefined) updates.serialNumbers = body.serialNumbers?.trim() || null
      if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl?.trim() || null
      if (body.documentationLinks !== undefined) updates.documentationLinks = body.documentationLinks?.trim() || null
      if (body.tags !== undefined) updates.tags = body.tags?.trim() || null
      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { error: 'No valid updates' },
          { status: 400, headers: corsHeaders }
        )
      }
      const updated = await prisma.inventoryItem.update({
        where: { id: itemId },
        data: updates,
        include: { owner: { select: { id: true, name: true, email: true } } },
      })
      return NextResponse.json({
        id: updated.id,
        name: updated.name,
        teamId: updated.teamId ?? undefined,
        description: updated.description ?? undefined,
        ownerId: updated.ownerId ?? undefined,
        owner: updated.owner ? { id: updated.owner.id, name: updated.owner.name, email: updated.owner.email } : undefined,
        allowCheckout: updated.allowCheckout,
        checkoutCategory: updated.checkoutCategory ?? undefined,
        manufacturer: updated.manufacturer ?? undefined,
        model: updated.model ?? undefined,
        serialNumbers: updated.serialNumbers ?? undefined,
        imageUrl: updated.imageUrl ?? undefined,
        documentationLinks: updated.documentationLinks ?? undefined,
        tags: updated.tags ?? undefined,
      }, { headers: corsHeaders })
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
    console.error('PATCH /api/inventory/items/[itemId] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update' },
      { status: 500, headers: corsHeaders }
    )
  }
}

/** DELETE /api/inventory/items/[itemId] — Remove inventory item (cascades to stock) */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params
    if (!itemId) {
      return NextResponse.json(
        { error: 'Missing item ID' },
        { status: 400, headers: corsHeaders }
      )
    }

    return await withOrg(req, prismaBase, async () => {
      await requireActivePlan(prismaBase, getOrgId()!)
      const orgId = getOrgId()
      const item = await prisma.inventoryItem.findFirst({
        where: { id: itemId, ...(orgId ? { organizationId: orgId } : {}) },
      })
      if (!item) {
        return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders })
      }
      await prisma.inventoryItem.delete({ where: { id: itemId } })
      return new NextResponse(null, { status: 204, headers: corsHeaders })
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
    console.error('DELETE /api/inventory/items/[itemId] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete' },
      { status: 500, headers: corsHeaders }
    )
  }
}
