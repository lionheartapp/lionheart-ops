/**
 * GET /api/forms/:formId/prefill — Get pre-fill values for the current user
 *
 * Reads each field's prefillSource and resolves values from the user's
 * profile, their school, or the org context.
 */

import { NextResponse } from 'next/server'
import { ok } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { prisma } from '@/lib/db'
import { rawPrisma } from '@/lib/db'

export const GET = withAuth<unknown, { formId: string }>(
  async ({ ctx, params }) => {
    // Get all fields with a prefillSource set
    const fields = await prisma.formField.findMany({
      where: { formId: params.formId, prefillSource: { not: null } },
      select: { key: true, prefillSource: true },
    })

    if (fields.length === 0) {
      return NextResponse.json(ok({}))
    }

    // Fetch user profile data (rawPrisma for relation includes)
    const user = await rawPrisma.user.findUnique({
      where: { id: ctx.userId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        userRole: { select: { name: true } },
        school: { select: { name: true, address: true } },
      },
    })

    // Fetch org data
    const org = await prisma.organization.findFirst({
      select: { name: true },
    })

    // Build the pre-fill map
    const prefillValues: Record<string, string> = {}
    const sources: Record<string, string | null> = {
      'user.name': user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : null,
      'user.firstName': user?.firstName ?? null,
      'user.lastName': user?.lastName ?? null,
      'user.email': user?.email ?? null,
      'user.phone': user?.phone ?? null,
      'user.role': user?.userRole?.name ?? null,
      'school.name': user?.school?.name ?? null,
      'school.address': user?.school?.address ?? null,
      'org.name': org?.name ?? null,
    }

    for (const field of fields) {
      const source = field.prefillSource
      if (source && sources[source]) {
        prefillValues[field.key] = sources[source]!
      }
    }

    return NextResponse.json(ok(prefillValues))
  }
)
