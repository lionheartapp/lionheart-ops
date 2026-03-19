/**
 * Staff-facing API for registration form configuration.
 *
 * GET  /api/events/projects/[id]/registration-config  — fetch form + sections + fields
 * POST /api/events/projects/[id]/registration-config  — create form for this event project
 * PUT  /api/events/projects/[id]/registration-config  — update form config + sections/fields
 *
 * All endpoints require events:registration:manage permission.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOrgIdFromRequest } from '@/lib/org-context'
import { getUserContext } from '@/lib/request-context'
import { assertCan } from '@/lib/auth/permissions'
import { runWithOrgContext } from '@/lib/org-context'
import { ok, fail, isAuthError } from '@/lib/api-response'
import { PERMISSIONS } from '@/lib/permissions'
import {
  createRegistrationForm,
  updateRegistrationForm,
  getRegistrationForm,
  upsertFormSections,
} from '@/lib/services/registrationService'

// ─── Validation Schemas ────────────────────────────────────────────────────────

const discountCodeSchema = z.object({
  code: z.string().min(1),
  percentOff: z.number().int().min(0).max(100).optional(),
  amountOff: z.number().int().min(0).optional(),
  maxUses: z.number().int().min(1).optional(),
  usedCount: z.number().int().min(0).optional(),
})

const formDataSchema = z.object({
  title: z.string().optional(),
  shareSlug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
  requiresPayment: z.boolean().optional(),
  basePrice: z.number().int().min(0).optional(),
  depositPercent: z.number().int().min(0).max(100).optional(),
  maxCapacity: z.number().int().min(1).optional().nullable(),
  waitlistEnabled: z.boolean().optional(),
  requiresCoppaConsent: z.boolean().optional(),
  openAt: z.string().datetime().optional().nullable(),
  closeAt: z.string().datetime().optional().nullable(),
  brandingOverride: z.record(z.string(), z.unknown()).optional().nullable(),
  discountCodes: z.array(discountCodeSchema).optional().nullable(),
})

const fieldSchema = z.object({
  id: z.string().optional(),
  fieldType: z.string(),
  fieldKey: z.string().optional(),
  inputType: z.string(),
  label: z.string().min(1),
  helpText: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  enabled: z.boolean().optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  sortOrder: z.number().int(),
})

const sectionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.number().int(),
  fields: z.array(fieldSchema),
})

const putSchema = z.object({
  form: formDataSchema.optional(),
  sections: z.array(sectionSchema).optional(),
})

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_REGISTRATION_MANAGE)

    return await runWithOrgContext(orgId, async () => {
      const raw = await getRegistrationForm(eventProjectId)
      if (!raw) return NextResponse.json(ok(null))
      // Transform into { form, sections } structure the client expects
      const { sections, ...formConfig } = raw as Record<string, unknown> & { sections?: unknown[] }
      return NextResponse.json(ok({ form: formConfig, sections: sections ?? [] }))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[registration-config GET]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_REGISTRATION_MANAGE)

    const body = await req.json()
    const parsed = formDataSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid form data', parsed.error.issues),
        { status: 400 },
      )
    }

    const data = parsed.data

    return await runWithOrgContext(orgId, async () => {
      const raw = await createRegistrationForm({
        organizationId: orgId,
        eventProjectId,
        title: data.title,
        shareSlug: data.shareSlug,
        requiresPayment: data.requiresPayment,
        basePrice: data.basePrice,
        depositPercent: data.depositPercent,
        maxCapacity: data.maxCapacity ?? undefined,
        waitlistEnabled: data.waitlistEnabled,
        requiresCoppaConsent: data.requiresCoppaConsent,
        openAt: data.openAt ? new Date(data.openAt) : undefined,
        closeAt: data.closeAt ? new Date(data.closeAt) : undefined,
        brandingOverride: data.brandingOverride ?? undefined,
        discountCodes: data.discountCodes ?? undefined,
      })

      // Transform into { form, sections } structure the client expects
      const { sections, ...formConfig } = raw as Record<string, unknown> & { sections?: unknown[] }
      return NextResponse.json(ok({ form: formConfig, sections: sections ?? [] }), { status: 201 })
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    if (error instanceof Error && error.message.includes('already taken')) {
      return NextResponse.json(fail('CONFLICT', error.message), { status: 409 })
    }
    console.error('[registration-config POST]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventProjectId } = await params
    const orgId = getOrgIdFromRequest(req)
    const ctx = await getUserContext(req)
    await assertCan(ctx.userId, PERMISSIONS.EVENTS_REGISTRATION_MANAGE)

    const body = await req.json()
    const parsed = putSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        fail('VALIDATION_ERROR', 'Invalid form data', parsed.error.issues),
        { status: 400 },
      )
    }

    return await runWithOrgContext(orgId, async () => {
      // Look up the existing form
      const existingForm = await getRegistrationForm(eventProjectId)

      if (!existingForm) {
        return NextResponse.json(fail('NOT_FOUND', 'Registration form not found'), { status: 404 })
      }

      const formId = (existingForm as { id: string }).id
      const { form: formData, sections } = parsed.data

      if (formData) {
        await updateRegistrationForm(formId, {
          title: formData.title,
          shareSlug: formData.shareSlug,
          requiresPayment: formData.requiresPayment,
          basePrice: formData.basePrice,
          depositPercent: formData.depositPercent,
          maxCapacity: formData.maxCapacity ?? undefined,
          waitlistEnabled: formData.waitlistEnabled,
          requiresCoppaConsent: formData.requiresCoppaConsent,
          openAt: formData.openAt ? new Date(formData.openAt) : undefined,
          closeAt: formData.closeAt ? new Date(formData.closeAt) : undefined,
          brandingOverride: formData.brandingOverride ?? undefined,
          discountCodes: formData.discountCodes ?? undefined,
        })
      }

      if (sections) {
        await upsertFormSections(formId, sections)
      }

      const updatedRaw = await getRegistrationForm(eventProjectId)
      if (!updatedRaw) {
        return NextResponse.json(fail('NOT_FOUND', 'Registration form not found after update'), { status: 404 })
      }
      const { sections: updatedSections, ...updatedFormConfig } = updatedRaw as Record<string, unknown> & { sections?: unknown[] }
      return NextResponse.json(ok({ form: updatedFormConfig, sections: updatedSections ?? [] }))
    })
  } catch (error) {
    if (isAuthError(error)) {
      return NextResponse.json(fail('UNAUTHORIZED', 'Authentication required'), { status: 401 })
    }
    if (error instanceof Error && error.message.includes('Insufficient permissions')) {
      return NextResponse.json(fail('FORBIDDEN', error.message), { status: 403 })
    }
    console.error('[registration-config PUT]', error)
    return NextResponse.json(fail('INTERNAL_ERROR', 'Something went wrong'), { status: 500 })
  }
}
