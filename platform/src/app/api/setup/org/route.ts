import { NextRequest, NextResponse } from 'next/server'
import { prismaBase } from '@/lib/prisma'
import { corsHeaders } from '@/lib/cors'

/** GET /api/setup/org?orgId=... - Fetch org name for setup wizard (no auth, used when orgName not in URL). */
export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get('orgId')?.trim()
    if (!orgId) {
      return NextResponse.json({ error: 'Missing orgId' }, { status: 400, headers: corsHeaders })
    }

    const org = await prismaBase.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    })

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404, headers: corsHeaders })
    }

    return NextResponse.json({ name: org.name }, { headers: corsHeaders })
  } catch (err) {
    console.error('setup/org error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500, headers: corsHeaders }
    )
  }
}
