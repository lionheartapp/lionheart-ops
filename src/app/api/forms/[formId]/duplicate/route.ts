/**
 * POST /api/forms/[formId]/duplicate — Duplicate a form (structure only, no submissions)
 */

import { NextRequest, NextResponse } from 'next/server'
import { ok, fail } from '@/lib/api-response'
import { getOrgIdFromRequest, runWithOrgContext } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { PERMISSIONS } from '@/lib/permissions'
import { prisma } from '@/lib/db'

type RouteParams = { params: Promise<{ formId: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.FORMS_MANAGE)

    const { formId } = await params

    return await runWithOrgContext(orgId, async () => {
      const source = await prisma.formDefinition.findFirst({
        where: { id: formId },
        include: {
          pages: {
            include: { fields: { orderBy: { sortOrder: 'asc' } } },
            orderBy: { sortOrder: 'asc' },
          },
          ticketTypes: { orderBy: { sortOrder: 'asc' } },
        },
      })

      if (!source) {
        return NextResponse.json(fail('NOT_FOUND', 'Form not found'), { status: 404 })
      }

      // Create the duplicate
      const duplicate = await prisma.formDefinition.create({
        data: {
          organizationId: orgId,
          context: 'CUSTOM',
          visibility: source.visibility,
          description: `${source.description || 'Untitled Form'} (copy)`,
          coverColor: source.coverColor,
          logoUrl: source.logoUrl,
          confirmMessage: source.confirmMessage,
          redirectUrl: source.redirectUrl,
          autoSave: source.autoSave,
          allowDrafts: source.allowDrafts,
          isPublic: source.isPublic,
          requireEmail: source.requireEmail,
          publicStyle: source.publicStyle,
          publicCtaColor: source.publicCtaColor,
          publicBgColor: source.publicBgColor,
          publicImageUrl: source.publicImageUrl,
          publicImageSide: source.publicImageSide,
          maxCapacity: source.maxCapacity,
          waitlistEnabled: source.waitlistEnabled,
          discountCodes: source.discountCodes ?? undefined,
          createdBy: ctx.userId,
        },
      })

      // Copy pages + fields
      for (const page of source.pages) {
        const newPage = await prisma.formPage.create({
          data: {
            formId: duplicate.id,
            title: page.title,
            description: page.description,
            sortOrder: page.sortOrder,
            isOptional: page.isOptional,
            condFieldKey: page.condFieldKey,
            condOperator: page.condOperator,
            condEquals: page.condEquals,
          },
        })
        for (const field of page.fields) {
          await prisma.formField.create({
            data: {
              formId: duplicate.id,
              pageId: newPage.id,
              key: field.key,
              label: field.label,
              type: field.type,
              required: field.required,
              placeholder: field.placeholder,
              helpText: field.helpText,
              options: field.options,
              protection: field.protection,
              isIncluded: field.isIncluded,
              sensitivityLevel: field.sensitivityLevel,
              autoEscalate: field.autoEscalate,
              condFieldKey: field.condFieldKey,
              condOperator: field.condOperator,
              condEquals: field.condEquals,
              sortOrder: field.sortOrder,
            },
          })
        }
      }

      // Copy ticket types (without sold counts)
      for (const tt of source.ticketTypes) {
        await prisma.ticketType.create({
          data: {
            formId: duplicate.id,
            name: tt.name,
            description: tt.description,
            price: tt.price,
            maxPerOrder: tt.maxPerOrder,
            totalInventory: tt.totalInventory,
            soldCount: 0,
            sortOrder: tt.sortOrder,
            salesStartAt: tt.salesStartAt,
            salesEndAt: tt.salesEndAt,
            isActive: tt.isActive,
            depositPercent: tt.depositPercent,
          },
        })
      }

      return NextResponse.json(ok({ id: duplicate.id, description: duplicate.description }), { status: 201 })
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
