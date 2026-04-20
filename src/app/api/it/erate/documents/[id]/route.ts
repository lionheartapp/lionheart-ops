/**
 * DELETE /api/it/erate/documents/[id] — remove an E-Rate document record
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { rawPrisma, type PrismaDelegate } from '@/lib/db'

export const DELETE = withAuth(async ({ orgId, params }) => {
  const docId = params.id
  if (!docId) {
    return NextResponse.json(fail('VALIDATION_ERROR', 'Document ID required'), { status: 400 })
  }

  const existing = await (rawPrisma.iTERateDocument as unknown as PrismaDelegate).findFirst({
    where: { id: docId, organizationId: orgId },
    select: { id: true },
  })

  if (!existing) {
    return NextResponse.json(fail('NOT_FOUND', 'Document not found'), { status: 404 })
  }

  await (rawPrisma.iTERateDocument as unknown as PrismaDelegate).delete({
    where: { id: docId },
  })

  return NextResponse.json(ok({ deleted: true }))
}, { permission: PERMISSIONS.IT_ERATE_MANAGE })
