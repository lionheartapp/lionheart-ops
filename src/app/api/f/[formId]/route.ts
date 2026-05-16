/**
 * GET /api/f/[formId] — Public form fetch (no auth required)
 *
 * Returns the form definition with pages and fields for public rendering.
 * Only returns forms that have isPublic: true, or all forms for now (MVP).
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { rawPrisma } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ formId: string }> }
) {
  const { formId } = await params

  try {
    const form = await rawPrisma.formDefinition.findUnique({
      where: { id: formId },
      select: {
        id: true,
        description: true,
        coverColor: true,
        requireEmail: true,
        confirmMessage: true,
        publicStyle: true,
        publicCtaColor: true,
        publicBgColor: true,
        publicImageUrl: true,
        publicImageSide: true,
        logoUrl: true,
        pages: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            sortOrder: true,
            isOptional: true,
            fields: {
              where: { isIncluded: true },
              orderBy: { sortOrder: 'asc' },
              select: {
                id: true,
                key: true,
                label: true,
                type: true,
                required: true,
                placeholder: true,
                helpText: true,
                options: true,
                isIncluded: true,
                sensitivityLevel: true,
              },
            },
          },
        },
      },
    })

    if (!form) {
      return NextResponse.json(fail('NOT_FOUND', 'Form not found'), { status: 404 })
    }

    return NextResponse.json(ok(form))
  } catch {
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to load form'), { status: 500 })
  }
}
