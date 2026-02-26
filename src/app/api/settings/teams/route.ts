import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma as prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { audit, getIp } from '@/lib/services/auditService'

const CreateTeamSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional().nullable(),
})

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    // Check permission to view teams
    await assertCan(userContext.userId, PERMISSIONS.TEAMS_READ)

    return await runWithOrgContext(orgId, async () => {
      const teams = await prisma.team.findMany({
        where: { organizationId: orgId },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          _count: { select: { members: true } },
        },
        orderBy: { name: 'asc' },
      })

      return NextResponse.json(ok(teams))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to fetch teams:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to fetch teams'),
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    const body = await req.json()
    const input = CreateTeamSchema.parse(body)

    // Check permission to create teams
    await assertCan(userContext.userId, PERMISSIONS.TEAMS_CREATE)

    return await runWithOrgContext(orgId, async () => {
      const slug = toSlug(input.slug || input.name)

      if (!slug) {
        return NextResponse.json(
          fail('VALIDATION_ERROR', 'Team name must include letters or numbers'),
          { status: 400 }
        )
      }

      const team = await prisma.team.create({
        data: {
          organizationId: orgId,
          name: input.name,
          slug,
          description: input.description || null,
        },
      })

      await audit({
        organizationId: orgId,
        userId:         userContext.userId,
        userEmail:      userContext.email,
        action:         'team.create',
        resourceType:   'Team',
        resourceId:     team.id,
        resourceLabel:  team.name,
        changes:        { name: team.name, slug },
        ipAddress:      getIp(req),
      })

      return NextResponse.json(
        ok({
          ...team,
          _count: { members: 0 }, // newly created team has no members yet
        }),
        { status: 201 }
      )
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid team input', error.issues),
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        fail('CONFLICT', 'A team with this name/slug already exists'),
        { status: 409 }
      )
    }
    console.error('Failed to create team:', error)
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Failed to create team'),
      { status: 500 }
    )
  }
}
