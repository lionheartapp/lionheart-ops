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
        discountCodes: true,
        maxCapacity: true,
        ticketTypes: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            maxPerOrder: true,
            totalInventory: true,
            soldCount: true,
            salesStartAt: true,
            salesEndAt: true,
          },
        },
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

    // Filter ticket types to only those currently on sale
    const now = new Date()
    const onSaleTypes = form.ticketTypes.filter((tt) => {
      if (tt.salesStartAt && new Date(tt.salesStartAt) > now) return false
      if (tt.salesEndAt && new Date(tt.salesEndAt) < now) return false
      return true
    })

    // Compute availability: shared capacity across all types, with optional per-type limits
    const totalSoldAcrossAllTypes = form.ticketTypes.reduce((sum, tt) => sum + tt.soldCount, 0)
    const sharedRemaining = form.maxCapacity != null ? form.maxCapacity - totalSoldAcrossAllTypes : null

    const availableTicketTypes = onSaleTypes.map((tt) => {
      // Per-type remaining (if that type has its own limit)
      const typeRemaining = tt.totalInventory != null ? tt.totalInventory - tt.soldCount : null
      // Effective availability is the lesser of per-type limit and shared pool
      let available: number | null = null
      if (sharedRemaining != null && typeRemaining != null) {
        available = Math.min(sharedRemaining, typeRemaining)
      } else if (sharedRemaining != null) {
        available = sharedRemaining
      } else if (typeRemaining != null) {
        available = typeRemaining
      }
      return { ...tt, available }
    })

    return NextResponse.json(ok({
      ...form,
      ticketTypes: availableTicketTypes,
      maxCapacity: form.maxCapacity,
      totalSold: totalSoldAcrossAllTypes,
      discountCodes: undefined, // don't expose codes to client — validation is server-side
      hasDiscountCodes: Array.isArray(form.discountCodes) && (form.discountCodes as unknown[]).length > 0,
    }))
  } catch {
    return NextResponse.json(fail('INTERNAL_ERROR', 'Failed to load form'), { status: 500 })
  }
}
