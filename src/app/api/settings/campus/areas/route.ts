import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { rawPrisma as prisma } from '@/lib/db'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'

const CreateAreaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  areaType: z.enum(['FIELD', 'COURT', 'GYM', 'COMMON', 'PARKING', 'OTHER']).optional(),
  buildingId: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)

    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_READ)

    return await runWithOrgContext(orgId, async () => {
      const searchParams = new URL(req.url).searchParams
      const includeInactive = searchParams.get('includeInactive') === 'true'
      const buildingId = searchParams.get('buildingId') || undefined
      const db = prisma as any

      const areas = await db.area.findMany({
        where: {
          organizationId: orgId,
          ...(includeInactive ? {} : { isActive: true }),
          ...(buildingId ? { buildingId } : {}),
        },
        include: {
          building: {
            select: { id: true, name: true, code: true },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      })

      return NextResponse.json(ok(areas))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch areas'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    const body = await req.json()

    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_UPDATE)

    return await runWithOrgContext(orgId, async () => {
      const input = CreateAreaSchema.parse(body)
      const db = prisma as any

      if (input.buildingId) {
        const building = await db.building.findFirst({
          where: { id: input.buildingId, organizationId: orgId },
          select: { id: true },
        })
        if (!building) {
          return NextResponse.json(fail('BAD_REQUEST', 'Invalid buildingId for this organization'), { status: 400 })
        }
      }

      const area = await db.area.create({
        data: {
          organizationId: orgId,
          name: input.name,
          areaType: input.areaType || 'OTHER',
          buildingId: input.buildingId || null,
          sortOrder: input.sortOrder ?? 0,
          isActive: input.isActive ?? true,
        },
        include: {
          building: {
            select: { id: true, name: true, code: true },
          },
        },
      })

      return NextResponse.json(ok(area), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid input', error.issues), { status: 400 })
    }
    if (error instanceof Error && error.message.includes('Permission denied')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to create area'), { status: 500 })
  }
}
