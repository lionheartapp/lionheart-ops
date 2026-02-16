import { NextRequest, NextResponse } from 'next/server'
import { prismaBase, prisma } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'
import { corsHeaders } from '@/lib/cors'
import { requireActivePlan, PlanRestrictedError } from '@/lib/planCheck'

/** PATCH /api/inventory/stock/[stockId] — Update stock entry */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ stockId: string }> }
) {
  try {
    const { stockId } = await params
    if (!stockId) {
      return NextResponse.json(
        { error: 'Missing stock ID' },
        { status: 400, headers: corsHeaders }
      )
    }

    return await withOrg(req, prismaBase, async () => {
      await requireActivePlan(prismaBase, getOrgId()!)
      const orgId = getOrgId()
      const existing = await prisma.inventoryStock.findUnique({
        where: { id: stockId },
        include: { item: true },
      })
      if (!existing || (orgId && existing.item?.organizationId !== orgId)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders })
      }
      const body = (await req.json()) as { location?: string; quantity?: number }
      const updates: { location?: string; quantity?: number } = {}
      if (body.location != null && typeof body.location === 'string') {
        updates.location = body.location.trim()
      }
      if (typeof body.quantity === 'number') {
        updates.quantity = Math.max(0, Math.floor(body.quantity))
      }
      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { error: 'No valid updates' },
          { status: 400, headers: corsHeaders }
        )
      }

      const stock = await prisma.inventoryStock.update({
        where: { id: stockId },
        data: updates,
      })
      return NextResponse.json(stock, { headers: corsHeaders })
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
    console.error('PATCH /api/inventory/stock/[stockId] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update' },
      { status: 500, headers: corsHeaders }
    )
  }
}

/** DELETE /api/inventory/stock/[stockId] — Remove stock entry */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ stockId: string }> }
) {
  try {
    const { stockId } = await params
    if (!stockId) {
      return NextResponse.json(
        { error: 'Missing stock ID' },
        { status: 400, headers: corsHeaders }
      )
    }

    return await withOrg(req, prismaBase, async () => {
      await requireActivePlan(prismaBase, getOrgId()!)
      const orgId = getOrgId()
      const existing = await prisma.inventoryStock.findUnique({
        where: { id: stockId },
        include: { item: true },
      })
      if (!existing || (orgId && existing.item?.organizationId !== orgId)) {
        return NextResponse.json({ error: 'Not found' }, { status: 404, headers: corsHeaders })
      }
      await prisma.inventoryStock.delete({ where: { id: stockId } })
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
    console.error('DELETE /api/inventory/stock/[stockId] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete' },
      { status: 500, headers: corsHeaders }
    )
  }
}
