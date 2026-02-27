import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { runWithOrgContext, getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { z } from 'zod'
import {
  listCampusAssignments,
  assignUserToCampus,
  CreateCampusAssignmentSchema,
} from '@/lib/services/campusService'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId') || undefined
    const campusId = searchParams.get('campusId') || undefined

    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_READ)

    return await runWithOrgContext(orgId, async () => {
      const assignments = await listCampusAssignments({ userId, campusId })
      return NextResponse.json(ok(assignments))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to fetch campus assignments:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to fetch campus assignments'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const userContext = await getUserContext(req)
    const body = await req.json()
    const input = CreateCampusAssignmentSchema.parse(body)

    await assertCan(userContext.userId, PERMISSIONS.SETTINGS_UPDATE)

    return await runWithOrgContext(orgId, async () => {
      const assignment = await assignUserToCampus(input)
      return NextResponse.json(ok(assignment), { status: 201 })
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid assignment data', error.issues),
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to create campus assignment:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to create campus assignment'), { status: 500 })
  }
}
