import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

function nameToSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'role'
}

export async function GET(req: NextRequest) {
  const orgId = getOrgIdFromRequest(req)
  const userContext = await getUserContext(req)
  await assertCan(userContext.userId, PERMISSIONS.ROLES_READ)
  return runWithOrgContext(orgId, async () => {
    const list = await prisma.role.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        isSystem: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return NextResponse.json(ok(list))
  })
}

export async function POST(req: NextRequest) {
  const orgId = getOrgIdFromRequest(req)
  const userContext = await getUserContext(req)
  await assertCan(userContext.userId, PERMISSIONS.ROLES_UPDATE)
  const body = (await req.json()) as { name?: string; description?: string }
  const name = body.name?.trim()
  if (!name) {
    return NextResponse.json(fail('BAD_REQUEST', 'name is required'), { status: 400 })
  }
  return runWithOrgContext(orgId, async () => {
    let slug = nameToSlug(name)
    const existing = await prisma.role.findUnique({
      where: { organizationId_slug: { organizationId: orgId, slug } },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json(fail('CONFLICT', 'A role with this name already exists'), { status: 409 })
    }
    const created = await prisma.role.create({
      data: {
        organizationId: orgId,
        name,
        slug,
        description: body.description?.trim() ?? null,
        isSystem: false,
      },
      select: { id: true, name: true, slug: true, description: true, isSystem: true, createdAt: true, updatedAt: true },
    })
    return NextResponse.json(ok(created), { status: 201 })
  })
}
