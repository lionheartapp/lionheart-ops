/**
 * Staff-facing API for registration form configuration.
 *
 * GET  /api/events/projects/[id]/registration-config  — fetch form + sections + fields
 * POST /api/events/projects/[id]/registration-config  — create form for this event project
 * PUT  /api/events/projects/[id]/registration-config  — update form config + sections/fields
 *
 * All endpoints require events:registration:manage permission.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ok, fail } from '@/lib/api-response'
import { withAuth } from '@/lib/api/with-auth'
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

export const GET = withAuth(async ({ params }) => {
  const eventProjectId = params.id
  const raw = await getRegistrationForm(eventProjectId)
  if (!raw) return NextResponse.json(ok(null))
  // Transform into { form, sections } structure the client expects
  const { sections, ...formConfig } = raw as Record<string, unknown> & { sections?: unknown[] }
  return NextResponse.json(ok({ form: formConfig, sections: sections ?? [] }))
}, { permission: PERMISSIONS.EVENTS_REGISTRATION_MANAGE })

// ─── POST ─────────────────────────────────────────────────────────────────────

export const POST = withAuth(async ({ req, orgId, params }) => {
  const eventProjectId = params.id
  const body = await req.json()
  const parsed = formDataSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'Invalid form data', parsed.error.issues),
      { status: 400 },
    )
  }

  const data = parsed.data

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
}, { permission: PERMISSIONS.EVENTS_REGISTRATION_MANAGE })

// ─── PUT ──────────────────────────────────────────────────────────────────────

export const PUT = withAuth(async ({ req, params }) => {
  const eventProjectId = params.id
  const body = await req.json()
  const parsed = putSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      fail('VALIDATION_ERROR', 'Invalid form data', parsed.error.issues),
      { status: 400 },
    )
  }

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
}, { permission: PERMISSIONS.EVENTS_REGISTRATION_MANAGE })
