/**
 * GET /api/forms/:formId/submissions/export — Export submissions as CSV
 */

import { NextResponse } from 'next/server'
import { fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { exportSubmissionsAsCsv } from '@/lib/services/formSubmissionService'

export const GET = withAuth<unknown, { formId: string }>(
  async ({ params }) => {
    const { formId } = params

    // Fetch field definitions for column headers
    const form = await prisma.formDefinition.findUnique({
      where: { id: formId },
      include: {
        fields: { orderBy: { sortOrder: 'asc' } },
        pages: {
          orderBy: { sortOrder: 'asc' },
          include: { fields: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    })

    if (!form) {
      return NextResponse.json(fail('NOT_FOUND', 'Form not found'), { status: 404 })
    }

    // Collect all field keys and labels (pages first, then loose fields)
    const fieldKeys: string[] = []
    const fieldLabels: Record<string, string> = {}

    for (const page of form.pages) {
      for (const field of page.fields) {
        if (field.type === 'HEADER' || field.type === 'DIVIDER') continue
        fieldKeys.push(field.key)
        fieldLabels[field.key] = field.label
      }
    }
    for (const field of form.fields) {
      if (field.type === 'HEADER' || field.type === 'DIVIDER') continue
      if (!fieldKeys.includes(field.key)) {
        fieldKeys.push(field.key)
        fieldLabels[field.key] = field.label
      }
    }

    const csv = await exportSubmissionsAsCsv(formId, fieldKeys, fieldLabels)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="submissions-${formId}.csv"`,
      },
    })
  },
  { permission: PERMISSIONS.FORMS_MANAGE }
)
