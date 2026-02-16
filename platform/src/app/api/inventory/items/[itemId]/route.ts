import { NextRequest, NextResponse } from 'next/server'
import { prismaBase, prisma } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'
import { corsHeaders } from '@/lib/cors'

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
