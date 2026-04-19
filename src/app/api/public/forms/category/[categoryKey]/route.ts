/**
 * GET /api/public/forms/category/[categoryKey]?orgId=xxx
 *
 * Public endpoint — returns form fields for a ticket category.
 * Used by the sub-teacher landing page after magic link validation.
 * Requires orgId as query param (obtained from magic link validation).
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getCategoryFormByOrgAndKey } from '@/lib/services/formService'

type RouteParams = { params: Promise<{ categoryKey: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { categoryKey } = await params
    const orgId = req.nextUrl.searchParams.get('orgId')

    if (!orgId) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'orgId query parameter is required'),
        { status: 400 }
      )
    }

    const form = await getCategoryFormByOrgAndKey(orgId, categoryKey)

    // Return empty fields array if no form exists (category has no custom fields)
    return NextResponse.json(
      ok({
        fields: form?.fields ?? [],
        formId: form?.id ?? null,
      })
    )
  } catch {
    return NextResponse.json(
      fail('INTERNAL_ERROR', 'Something went wrong'),
      { status: 500 }
    )
  }
}
