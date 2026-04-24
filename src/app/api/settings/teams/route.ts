import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { PERMISSIONS } from '@/lib/permissions'
import { audit, getIp } from '@/lib/services/auditService'
import { cacheOrgWide, invalidateOrgCache } from '@/lib/cache/route-cache'

const CreateTeamSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  teamType: z.enum(['PRE_SCHOOL', 'ELEMENTARY', 'MIDDLE_SCHOOL', 'HIGH_SCHOOL']).nullable().optional(),
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

export const GET = withAuth(async ({ orgId }) => {
  const teams = await cacheOrgWide(orgId, 'teams:list', () =>
    prisma.team.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        teamType: true,
        _count: { select: { members: true } },
      },
      orderBy: { name: 'asc' },
    })
  )

  return NextResponse.json(ok(teams))
}, { permission: PERMISSIONS.TEAMS_READ })

export const POST = withAuth<z.infer<typeof CreateTeamSchema>>(async ({ orgId, ctx, body, req }) => {
  const slug = toSlug(body.slug || body.name)

  if (!slug) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'Team name must include letters or numbers'),
      { status: 400 }
    )
  }

  const team = await prisma.team.create({
    data: {
      organizationId: orgId,
      name: body.name,
      slug,
      description: body.description || null,
      teamType: body.teamType ?? null,
    },
  })

  invalidateOrgCache(orgId, 'teams')

  await audit({
    organizationId: orgId,
    userId:         ctx.userId,
    userEmail:      ctx.email,
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
      _count: { members: 0 },
    }),
    { status: 201 }
  )
}, { permission: PERMISSIONS.TEAMS_CREATE, schema: CreateTeamSchema })
