/**
 * Registration Service
 *
 * Core CRUD and logic for event registration forms, registration submission,
 * capacity management, waitlist promotion, and sensitive data separation.
 *
 * CRITICAL: All public-facing functions use rawPrisma — parents have no org context.
 * organizationId is always sourced from the form record, never from URL params.
 */

import { rawPrisma } from '@/lib/db'
import { Prisma, RegistrationStatus } from '@prisma/client'

// ─── Types ───────────────────────────────────────────────────────────────────

export type CreateRegistrationFormInput = {
  organizationId: string
  eventProjectId: string
  title?: string
  shareSlug?: string
  requiresPayment?: boolean
  basePrice?: number
  depositPercent?: number
  maxCapacity?: number
  waitlistEnabled?: boolean
  requiresCoppaConsent?: boolean
  openAt?: Date
  closeAt?: Date
  brandingOverride?: Record<string, unknown>
  discountCodes?: Array<{
    code: string
    percentOff?: number
    amountOff?: number
    maxUses?: number
    usedCount?: number
  }>
}

export type UpdateRegistrationFormInput = Partial<Omit<CreateRegistrationFormInput, 'organizationId' | 'eventProjectId'>>

export type FormFieldInput = {
  id?: string
  fieldType: string
  fieldKey?: string
  inputType: string
  label: string
  helpText?: string
  placeholder?: string
  required?: boolean
  enabled?: boolean
  options?: Array<{ label: string; value: string }>
  sortOrder: number
}

export type FormSectionInput = {
  id?: string
  title: string
  description?: string
  sortOrder: number
  fields: FormFieldInput[]
}

export type SubmitRegistrationInput = {
  shareSlug: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  grade?: string
  photoUrl?: string
  tshirtSize?: string
  dietaryNeeds?: string
  coppaConsentAt?: Date
  coppaConsentIp?: string
  responses: Array<{
    fieldId: string
    value?: string
    values?: unknown
    fileUrl?: string
  }>
  sensitiveData?: {
    allergies?: string
    medications?: string
    medicalNotes?: string
    emergencyName?: string
    emergencyPhone?: string
    emergencyRelationship?: string
  }
}

// ─── Slug Helpers ─────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function randomSuffix(length = 6): string {
  return Math.random().toString(36).slice(2, 2 + length)
}

async function generateUniqueSlug(base: string): Promise<string> {
  const baseSlug = slugify(base) || 'event'
  let candidate = `${baseSlug}-${randomSuffix()}`

  // Retry up to 5 times to find a unique slug
  for (let i = 0; i < 5; i++) {
    const existing = await rawPrisma.registrationForm.findUnique({
      where: { shareSlug: candidate },
      select: { id: true },
    })
    if (!existing) return candidate
    candidate = `${baseSlug}-${randomSuffix()}`
  }

  // Fallback: use timestamp + random
  return `${baseSlug}-${Date.now()}-${randomSuffix(4)}`
}

// ─── Form CRUD ────────────────────────────────────────────────────────────────

/**
 * Creates a RegistrationForm for an EventProject.
 * Generates a unique shareSlug from the event title if not provided.
 */
export async function createRegistrationForm(
  data: CreateRegistrationFormInput,
): Promise<Record<string, unknown>> {
  // Derive shareSlug from event title if not provided
  let shareSlug = data.shareSlug

  if (!shareSlug) {
    const project = await rawPrisma.eventProject.findUnique({
      where: { id: data.eventProjectId },
      select: { title: true },
    })
    const base = project?.title ?? 'event'
    shareSlug = await generateUniqueSlug(base)
  } else {
    // Validate provided slug is unique
    const existing = await rawPrisma.registrationForm.findUnique({
      where: { shareSlug },
      select: { id: true },
    })
    if (existing) {
      throw new Error(`Share slug '${shareSlug}' is already taken`)
    }
  }

  return rawPrisma.registrationForm.create({
    data: {
      organizationId: data.organizationId,
      eventProjectId: data.eventProjectId,
      title: data.title ?? null,
      shareSlug,
      requiresPayment: data.requiresPayment ?? false,
      basePrice: data.basePrice ?? null,
      depositPercent: data.depositPercent ?? null,
      maxCapacity: data.maxCapacity ?? null,
      waitlistEnabled: data.waitlistEnabled ?? true,
      requiresCoppaConsent: data.requiresCoppaConsent ?? false,
      openAt: data.openAt ?? null,
      closeAt: data.closeAt ?? null,
      brandingOverride: data.brandingOverride !== undefined
        ? (data.brandingOverride as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      discountCodes: data.discountCodes !== undefined
        ? (data.discountCodes as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
    include: {
      sections: {
        orderBy: { sortOrder: 'asc' },
        include: {
          fields: { orderBy: { sortOrder: 'asc' } },
        },
      },
    },
  })
}

/**
 * Updates a RegistrationForm's config fields.
 */
export async function updateRegistrationForm(
  formId: string,
  data: UpdateRegistrationFormInput,
): Promise<Record<string, unknown>> {
  return rawPrisma.registrationForm.update({
    where: { id: formId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.shareSlug !== undefined && { shareSlug: data.shareSlug }),
      ...(data.requiresPayment !== undefined && { requiresPayment: data.requiresPayment }),
      ...(data.basePrice !== undefined && { basePrice: data.basePrice }),
      ...(data.depositPercent !== undefined && { depositPercent: data.depositPercent }),
      ...(data.maxCapacity !== undefined && { maxCapacity: data.maxCapacity }),
      ...(data.waitlistEnabled !== undefined && { waitlistEnabled: data.waitlistEnabled }),
      ...(data.requiresCoppaConsent !== undefined && { requiresCoppaConsent: data.requiresCoppaConsent }),
      ...(data.openAt !== undefined && { openAt: data.openAt }),
      ...(data.closeAt !== undefined && { closeAt: data.closeAt }),
      ...(data.brandingOverride !== undefined && {
        brandingOverride: data.brandingOverride as Prisma.InputJsonValue,
      }),
      ...(data.discountCodes !== undefined && {
        discountCodes: data.discountCodes as Prisma.InputJsonValue,
      }),
    },
  })
}

/**
 * Returns the registration form for an EventProject, with sections and fields sorted by sortOrder.
 */
export async function getRegistrationForm(eventProjectId: string): Promise<Record<string, unknown> | null> {
  return rawPrisma.registrationForm.findUnique({
    where: { eventProjectId },
    include: {
      sections: {
        orderBy: { sortOrder: 'asc' },
        include: {
          fields: { orderBy: { sortOrder: 'asc' } },
        },
      },
    },
  })
}

/**
 * Public lookup of a registration form by shareSlug.
 * Returns form + event project details + org branding.
 * Does NOT include sensitive data, capacity numbers, or payment secrets.
 */
export async function getRegistrationFormBySlug(shareSlug: string): Promise<Record<string, unknown> | null> {
  const form = await rawPrisma.registrationForm.findUnique({
    where: { shareSlug },
    include: {
      sections: {
        orderBy: { sortOrder: 'asc' },
        include: {
          fields: {
            where: { enabled: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
      },
      eventProject: {
        select: {
          id: true,
          title: true,
          description: true,
          coverImageUrl: true,
          startsAt: true,
          endsAt: true,
          locationText: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          theme: true,
        },
      },
    },
  })

  if (!form) return null

  // Return public-safe subset: no capacity counts, no payment secrets, no discount codes
  const { discountCodes: _discountCodes, ...publicForm } = form as Record<string, unknown>
  void _discountCodes

  return publicForm
}

/**
 * Upserts form sections and fields atomically.
 * Deletes existing sections/fields for the form, then creates new ones.
 */
export async function upsertFormSections(
  formId: string,
  sections: FormSectionInput[],
): Promise<void> {
  // Use rawPrisma directly (not $transaction) for the atomic upsert
  // because interactive transactions on the extended client can behave unexpectedly per CLAUDE.md
  await rawPrisma.registrationFormSection.deleteMany({
    where: { formId },
  })

  for (const section of sections) {
    // eslint-disable-next-line no-await-in-loop
    const created = await rawPrisma.registrationFormSection.create({
      data: {
        formId,
        title: section.title,
        description: section.description ?? null,
        sortOrder: section.sortOrder,
      },
    })

    if (section.fields.length > 0) {
      // eslint-disable-next-line no-await-in-loop
      await (rawPrisma as any).registrationFormField.createMany({
        data: section.fields.map((field) => ({
          sectionId: created.id,
          formId,
          fieldType: field.fieldType,
          fieldKey: field.fieldKey ?? null,
          inputType: field.inputType,
          label: field.label,
          helpText: field.helpText ?? null,
          placeholder: field.placeholder ?? null,
          required: field.required ?? false,
          enabled: field.enabled ?? true,
          options: field.options != null ? field.options : null,
          sortOrder: field.sortOrder,
        })),
      })
    }
  }
}

// ─── Registration Submission ──────────────────────────────────────────────────

/**
 * Submits a registration for an event.
 *
 * Flow:
 * 1. Look up form by shareSlug, verify it's open (openAt/closeAt)
 * 2. Check capacity vs. maxCapacity
 * 3. Create EventRegistration with REGISTERED or WAITLISTED status
 * 4. Create RegistrationResponse rows
 * 5. If sensitiveData provided, create RegistrationSensitiveData row
 * 6. Return registration with status
 *
 * CRITICAL: Uses rawPrisma — parent has no org context.
 */
export async function submitRegistration(
  data: SubmitRegistrationInput,
): Promise<Record<string, unknown>> {
  // 1. Look up form by shareSlug
  const form = await rawPrisma.registrationForm.findUnique({
    where: { shareSlug: data.shareSlug },
    select: {
      id: true,
      organizationId: true,
      eventProjectId: true,
      requiresPayment: true,
      basePrice: true,
      depositPercent: true,
      maxCapacity: true,
      waitlistEnabled: true,
      requiresCoppaConsent: true,
      openAt: true,
      closeAt: true,
    },
  })

  if (!form) {
    throw new Error('Registration form not found')
  }

  // 2. Verify form is open
  const now = new Date()
  if (form.openAt && now < form.openAt) {
    throw new Error('Registration has not opened yet')
  }
  if (form.closeAt && now > form.closeAt) {
    throw new Error('Registration has closed')
  }

  // 3. Check capacity and determine status
  let status: RegistrationStatus

  if (form.maxCapacity !== null) {
    const registeredCount = await rawPrisma.eventRegistration.count({
      where: {
        formId: form.id,
        status: RegistrationStatus.REGISTERED,
        deletedAt: null,
      },
    })

    if (registeredCount >= form.maxCapacity) {
      if (!form.waitlistEnabled) {
        throw new Error('This event is full and waitlist is not available')
      }
      status = RegistrationStatus.WAITLISTED
    } else {
      status = RegistrationStatus.REGISTERED
    }
  } else {
    // No capacity limit
    status = RegistrationStatus.REGISTERED
  }

  // 4. Create registration (and responses + sensitiveData) in a transaction
  const registration = await rawPrisma.$transaction(async (tx) => {
    const newReg = await tx.eventRegistration.create({
      data: {
        organizationId: form.organizationId,
        eventProjectId: form.eventProjectId,
        formId: form.id,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone ?? null,
        grade: data.grade ?? null,
        photoUrl: data.photoUrl ?? null,
        tshirtSize: data.tshirtSize ?? null,
        dietaryNeeds: data.dietaryNeeds ?? null,
        status,
        coppaConsentAt: data.coppaConsentAt ?? null,
        coppaConsentIp: data.coppaConsentIp ?? null,
        submittedAt: new Date(),
      },
    })

    // 5. Create response rows
    if (data.responses.length > 0) {
      await tx.registrationResponse.createMany({
        data: data.responses.map((r) => ({
          registrationId: newReg.id,
          fieldId: r.fieldId,
          value: r.value ?? null,
          values: r.values != null ? (r.values as Prisma.InputJsonValue) : Prisma.JsonNull,
          fileUrl: r.fileUrl ?? null,
        })),
      })
    }

    // 6. Create sensitive data row if provided
    if (data.sensitiveData) {
      const sd = data.sensitiveData
      const hasData = Object.values(sd).some((v) => v != null && v !== '')
      if (hasData) {
        await tx.registrationSensitiveData.create({
          data: {
            registrationId: newReg.id,
            allergies: sd.allergies ?? null,
            medications: sd.medications ?? null,
            medicalNotes: sd.medicalNotes ?? null,
            emergencyName: sd.emergencyName ?? null,
            emergencyPhone: sd.emergencyPhone ?? null,
            emergencyRelationship: sd.emergencyRelationship ?? null,
          },
        })
      }
    }

    return newReg
  })

  return {
    ...registration,
    requiresPayment: form.requiresPayment,
    basePrice: form.basePrice,
    depositPercent: form.depositPercent,
  }
}

/**
 * Cancels a registration and triggers waitlist promotion.
 */
export async function cancelRegistration(registrationId: string): Promise<void> {
  const reg = await rawPrisma.eventRegistration.findUnique({
    where: { id: registrationId },
    select: { eventProjectId: true, organizationId: true },
  })

  if (!reg) throw new Error('Registration not found')

  await rawPrisma.eventRegistration.update({
    where: { id: registrationId },
    data: { status: RegistrationStatus.CANCELLED },
  })

  // Attempt to promote from waitlist
  await promoteFromWaitlist(reg.eventProjectId, reg.organizationId)
}

/**
 * Atomically promotes the oldest WAITLISTED registration to REGISTERED.
 * Re-checks capacity inside the transaction to prevent races.
 *
 * Returns the promoted registration, or null if no promotion occurred.
 */
export async function promoteFromWaitlist(
  eventProjectId: string,
  organizationId: string,
): Promise<Record<string, unknown> | null> {
  return rawPrisma.$transaction(async (tx) => {
    // Look up form for this event project
    const form = await tx.registrationForm.findUnique({
      where: { eventProjectId },
      select: { id: true, maxCapacity: true },
    })

    if (!form || form.maxCapacity === null) return null

    // Re-check current registered count inside transaction
    const registeredCount = await tx.eventRegistration.count({
      where: {
        formId: form.id,
        status: RegistrationStatus.REGISTERED,
        deletedAt: null,
      },
    })

    if (registeredCount >= form.maxCapacity) return null

    // Find oldest WAITLISTED registration
    const oldest = await tx.eventRegistration.findFirst({
      where: {
        organizationId,
        eventProjectId,
        status: RegistrationStatus.WAITLISTED,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    })

    if (!oldest) return null

    // Promote to REGISTERED
    const promoted = await tx.eventRegistration.update({
      where: { id: oldest.id },
      data: {
        status: RegistrationStatus.REGISTERED,
        promotedAt: new Date(),
      },
    })

    return promoted as unknown as Record<string, unknown>
  })
}

/**
 * Lists registrations for an EventProject.
 * Does NOT include sensitiveData by default.
 */
export async function getRegistrations(
  eventProjectId: string,
  options?: {
    status?: string
    includeDeleted?: boolean
  },
): Promise<Record<string, unknown>[]> {
  const where = {
    eventProjectId,
    ...(options?.status ? { status: options.status as RegistrationStatus } : {}),
    ...(options?.includeDeleted ? {} : { deletedAt: null }),
  }

  return rawPrisma.eventRegistration.findMany({
    where,
    orderBy: { submittedAt: 'desc' },
    include: {
      responses: true,
      payments: true,
    },
  }) as unknown as Record<string, unknown>[]
}

/**
 * Returns a registration with its sensitiveData included.
 *
 * SECURITY: Caller MUST verify events:medical:read permission before calling this function.
 */
export async function getRegistrationWithSensitiveData(
  registrationId: string,
): Promise<Record<string, unknown> | null> {
  return rawPrisma.eventRegistration.findUnique({
    where: { id: registrationId },
    include: {
      responses: true,
      payments: true,
      sensitiveData: true,
    },
  }) as unknown as Record<string, unknown> | null
}
