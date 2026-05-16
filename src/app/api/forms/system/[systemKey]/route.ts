/**
 * GET /api/forms/system/:systemKey — Fetch a system form definition by its systemKey.
 *
 * Used by the event creation modal and other UIs that need to render
 * dynamic fields from a system form template. Lazy-seeds system forms
 * if they don't exist yet.
 */

import { NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { seedSystemForms } from '@/lib/services/formService'

const FULL_FORM_INCLUDE = {
  pages: {
    orderBy: { sortOrder: 'asc' as const },
    include: { fields: { orderBy: { sortOrder: 'asc' as const } } },
  },
  fields: {
    where: { pageId: null },
    orderBy: { sortOrder: 'asc' as const },
  },
}

export const GET = withAuth<unknown, { systemKey: string }>(
  async ({ orgId, params }) => {
    const { systemKey } = params

    // Lazy seed system forms if none exist yet
    try {
      await seedSystemForms(orgId)
    } catch (e) {
      console.error('[forms/system] seedSystemForms failed:', e)
    }

    const form = await prisma.formDefinition.findFirst({
      where: { systemKey, isDefault: true },
      include: FULL_FORM_INCLUDE,
    })

    if (!form) {
      return NextResponse.json(
        fail('NOT_FOUND', `System form '${systemKey}' not found`),
        { status: 404 }
      )
    }

    return NextResponse.json(ok(form))
  }
)
