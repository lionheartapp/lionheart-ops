import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getUserContext } from '@/lib/request-context'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { seedERateCalendar, getERateTasks } from '@/lib/services/itERateService'

export async function GET(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_ERATE_VIEW)

    const url = new URL(req.url)
    const schoolYear = url.searchParams.get('schoolYear') || undefined

    return await runWithOrgContext(orgId, async () => {
      const tasks = await getERateTasks(orgId, schoolYear)
      return NextResponse.json(ok(tasks))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to fetch E-Rate calendar:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.IT_ERATE_MANAGE)

    const body = await req.json()
    const { schoolYear } = body as { schoolYear: string }

    if (!schoolYear || !/^\d{4}-\d{4}$/.test(schoolYear)) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'schoolYear must be in format YYYY-YYYY'),
        { status: 400 }
      )
    }

    return await runWithOrgContext(orgId, async () => {
      const count = await seedERateCalendar(orgId, schoolYear)
      return NextResponse.json(ok({ seeded: count }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('Failed to seed E-Rate calendar:', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
