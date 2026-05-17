/**
 * POST /api/forms/[formId]/archive — Archive or unarchive a form
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { z } from 'zod'

type RouteParams = { params: Promise<{ formId: string }> }

const archiveSchema = z.object({
  action: z.enum(['archive', 'unarchive']),
})

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FORMS_MANAGE)

    const { formId } = await params
    const body = await req.json()
    const parsed = archiveSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(fail('VALIDATION_ERROR', 'Invalid request'), { status: 400 })
    }

    return await runWithOrgContext(orgId, async () => {
      const form = await prisma.formDefinition.findFirst({
        where: { id: formId },
        select: { id: true, isDefault: true, systemKey: true },
      })

      if (!form) {
        return NextResponse.json(fail('NOT_FOUND', 'Form not found'), { status: 404 })
      }

      if (form.isDefault || form.systemKey) {
        return NextResponse.json(fail('FORBIDDEN', 'System forms cannot be archived'), { status: 403 })
      }

      await prisma.formDefinition.update({
        where: { id: formId },
        data: { status: parsed.data.action === 'archive' ? 'ARCHIVED' : 'ACTIVE' },
      })

      return NextResponse.json(ok({ status: parsed.data.action === 'archive' ? 'ARCHIVED' : 'ACTIVE' }))
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
