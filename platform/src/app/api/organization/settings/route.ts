import { NextRequest, NextResponse } from 'next/server'
import { prismaBase } from '@/lib/prisma'
import { withOrg, getOrgId } from '@/lib/orgContext'
import { getModules } from '@/lib/modules'

export async function GET(req: NextRequest) {
  try {
    return await withOrg(req, prismaBase, async () => {
      const orgId = getOrgId()
      if (!orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const org = await prismaBase.organization.findUnique({
        where: { id: orgId },
        select: { settings: true },
      })
      const modules = getModules(org?.settings ?? null)
      return NextResponse.json({ modules })
    })
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'Organization ID is required' || err.message === 'Invalid organization')
    ) {
      return NextResponse.json({ error: err.message }, { status: 401 })
    }
    console.error('Organization settings error:', err)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
}
