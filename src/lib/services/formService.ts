/**
 * Form Definition Service
 *
 * Manages the lifecycle of FormDefinitions — the configurable field sets
 * that admins customize per ticket category or event registration.
 *
 * Key behavior: "seed on first GET" — when a category form is requested
 * that doesn't exist yet, the service creates it from DEFAULT_CATEGORY_FIELDS
 * and returns it. Admins only ever customize, never create from scratch.
 */

import { prisma } from '@/lib/db'
import { rawPrisma } from '@/lib/db'
import { DEFAULT_CATEGORY_FIELDS, type FormFieldInput, type FormPageInput, type FormActionInput } from '@/lib/forms/schemas'
import { SYSTEM_FORM_SEEDS } from '@/lib/forms/system-form-seeds'
import { Prisma, type FormFieldType, type FormContext, type FieldProtection, type FieldSensitivity } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FormDefinitionWithFields {
  id: string
  organizationId: string
  categoryKey: string | null
  eventId: string | null
  publicStyle: string
  publicCtaColor: string | null
  publicBgColor: string | null
  publicImageUrl: string | null
  publicImageSide: string
  fields: Array<{
    id: string
    key: string
    label: string
    type: FormFieldType
    required: boolean
    placeholder: string | null
    helpText: string | null
    options: string[]
    autoEscalate: boolean
    workflowActions?: unknown
    condFieldKey: string | null
    condEquals: string | null
    sortOrder: number
    sectionId: string | null
  }>
  sections: Array<{
    id: string
    title: string
    sortOrder: number
  }>
}

// ─── Get or Seed Category Form ────────────────────────────────────────────────

/**
 * Returns the FormDefinition for a given category key in the current org.
 * If none exists, seeds it from DEFAULT_CATEGORY_FIELDS and returns the result.
 */
export async function getOrSeedCategoryForm(
  categoryKey: string,
  orgId?: string
): Promise<FormDefinitionWithFields> {
  // Try to find existing
  const existing = await prisma.formDefinition.findFirst({
    where: { categoryKey },
    include: {
      fields: { orderBy: { sortOrder: 'asc' } },
      sections: { orderBy: { sortOrder: 'asc' } },
    },
  })

  if (existing) return existing as FormDefinitionWithFields

  // Seed from defaults
  const defaults = DEFAULT_CATEGORY_FIELDS[categoryKey] ?? []
  const created = await (prisma.formDefinition.create as Function)({
    data: {
      categoryKey,
      ...(orgId ? { organizationId: orgId } : {}),
      fields: {
        create: defaults.map((f, i) => ({
          key: f.key,
          label: f.label,
          type: f.type as FormFieldType,
          required: f.required ?? false,
          placeholder: f.placeholder ?? null,
          helpText: f.helpText ?? null,
          options: f.options ?? [],
          autoEscalate: f.autoEscalate ?? false,
          workflowActions: f.workflowActions ?? undefined,
          condFieldKey: f.condFieldKey ?? null,
          condEquals: f.condEquals ?? null,
          sortOrder: i,
        })),
      },
    },
    include: {
      fields: { orderBy: { sortOrder: 'asc' } },
      sections: { orderBy: { sortOrder: 'asc' } },
    },
  })

  return created as FormDefinitionWithFields
}

// ─── Update Category Form (full replace of fields) ───────────────────────────

export async function updateCategoryFormFields(
  formId: string,
  fields: FormFieldInput[]
): Promise<FormDefinitionWithFields> {
  // Delete existing fields and recreate — simpler than diffing
  await prisma.formField.deleteMany({ where: { formId } })

  const updated = await prisma.formDefinition.update({
    where: { id: formId },
    data: {
      fields: {
        create: fields.map((f, i) => ({
          key: f.key,
          label: f.label,
          type: f.type as FormFieldType,
          required: f.required ?? false,
          placeholder: f.placeholder ?? null,
          helpText: f.helpText ?? null,
          options: f.options ?? [],
          autoEscalate: f.autoEscalate ?? false,
          workflowActions: f.workflowActions ?? undefined,
          condFieldKey: f.condFieldKey ?? null,
          condEquals: f.condEquals ?? null,
          sortOrder: f.sortOrder ?? i,
          sectionId: f.sectionId ?? null,
        })),
      },
    },
    include: {
      fields: { orderBy: { sortOrder: 'asc' } },
      sections: { orderBy: { sortOrder: 'asc' } },
    },
  })

  return updated as FormDefinitionWithFields
}

// ─── Add a single field ───────────────────────────────────────────────────────

export async function addField(
  formId: string,
  field: FormFieldInput
) {
  // Get current max sort order
  const maxField = await prisma.formField.findFirst({
    where: { formId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  const sortOrder = (maxField?.sortOrder ?? -1) + 1

  return prisma.formField.create({
    data: {
      formId,
      key: field.key,
      label: field.label || '',
      type: field.type as FormFieldType,
      required: field.required ?? false,
      placeholder: field.placeholder ?? null,
      helpText: field.helpText ?? null,
      options: field.options ?? [],
      autoEscalate: field.autoEscalate ?? false,
      workflowActions: field.workflowActions ?? undefined,
      condFieldKey: field.condFieldKey ?? null,
      condEquals: field.condEquals ?? null,
      sortOrder,
      sectionId: field.sectionId ?? null,
      pageId: field.pageId ?? null,
    },
  })
}

// ─── Update a single field ────────────────────────────────────────────────────

export async function updateField(
  fieldId: string,
  patch: Partial<FormFieldInput>
) {
  const data: Prisma.FormFieldUncheckedUpdateInput = {
    ...(patch.key != null && { key: patch.key }),
    ...(patch.label != null && { label: patch.label }),
    ...(patch.type != null && { type: patch.type as FormFieldType }),
    ...(patch.required != null && { required: patch.required }),
    ...(patch.placeholder !== undefined && { placeholder: patch.placeholder ?? null }),
    ...(patch.helpText !== undefined && { helpText: patch.helpText ?? null }),
    ...(patch.options != null && { options: patch.options }),
    ...(patch.autoEscalate != null && { autoEscalate: patch.autoEscalate }),
    ...(patch.workflowActions !== undefined && {
      workflowActions: patch.workflowActions === null
        ? Prisma.JsonNull
        : patch.workflowActions as Prisma.InputJsonValue,
    }),
    ...(patch.condFieldKey !== undefined && { condFieldKey: patch.condFieldKey ?? null }),
    ...(patch.condOperator !== undefined && { condOperator: patch.condOperator ?? null }),
    ...(patch.condEquals !== undefined && { condEquals: patch.condEquals ?? null }),
    ...(patch.sortOrder != null && { sortOrder: patch.sortOrder }),
    ...(patch.sectionId !== undefined && { sectionId: patch.sectionId ?? null }),
    ...(patch.pageId !== undefined && { pageId: patch.pageId ?? null }),
    // Protection & visibility
    ...(patch.protection != null && { protection: patch.protection as FieldProtection }),
    ...(patch.isIncluded != null && { isIncluded: patch.isIncluded }),
    ...(patch.sensitivityLevel != null && { sensitivityLevel: patch.sensitivityLevel as FieldSensitivity }),
    // Validation
    ...(patch.minValue !== undefined && { minValue: patch.minValue ?? null }),
    ...(patch.maxValue !== undefined && { maxValue: patch.maxValue ?? null }),
    ...(patch.pattern !== undefined && { pattern: patch.pattern ?? null }),
    ...(patch.errorMessage !== undefined && { errorMessage: patch.errorMessage ?? null }),
    // Defaults & pre-fill
    ...(patch.defaultValue !== undefined && { defaultValue: patch.defaultValue ?? null }),
    ...(patch.prefillSource !== undefined && { prefillSource: patch.prefillSource ?? null }),
    // File upload config
    ...(patch.fileTypes != null && { fileTypes: patch.fileTypes }),
    ...(patch.maxFileSize !== undefined && { maxFileSize: patch.maxFileSize ?? null }),
  }

  return prisma.formField.update({
    where: { id: fieldId },
    data,
  })
}

// ─── Remove a field ───────────────────────────────────────────────────────────

export async function removeField(fieldId: string) {
  return prisma.formField.delete({ where: { id: fieldId } })
}

// ─── Reorder fields ───────────────────────────────────────────────────────────

export async function reorderFields(formId: string, fieldIds: string[]) {
  // Update sort orders in sequence
  const updates = fieldIds.map((id, index) =>
    prisma.formField.update({
      where: { id },
      data: { sortOrder: index },
    })
  )

  await Promise.all(updates)

  return prisma.formDefinition.findUnique({
    where: { id: formId },
    include: {
      fields: { orderBy: { sortOrder: 'asc' } },
      sections: { orderBy: { sortOrder: 'asc' } },
    },
  })
}

// ─── Get category form for public/submission use (by org ID + category) ──────

/**
 * Fetch a category form without org-scoping (for public/sub-teacher routes).
 * Returns null if no form exists for this org+category.
 */
export async function getCategoryFormByOrgAndKey(
  organizationId: string,
  categoryKey: string
): Promise<FormDefinitionWithFields | null> {
  const form = await rawPrisma.formDefinition.findFirst({
    where: { organizationId, categoryKey },
    include: {
      fields: { orderBy: { sortOrder: 'asc' } },
      sections: { orderBy: { sortOrder: 'asc' } },
    },
  })

  return form as FormDefinitionWithFields | null
}

// ─── Full Form With Pages ────────────────────────────────────────────────────

const FULL_FORM_INCLUDE = {
  fields: { orderBy: { sortOrder: 'asc' as const } },
  sections: { orderBy: { sortOrder: 'asc' as const } },
  pages: {
    orderBy: { sortOrder: 'asc' as const },
    include: { fields: { orderBy: { sortOrder: 'asc' as const } } },
  },
  actions: { orderBy: { sortOrder: 'asc' as const } },
}

/** Get a single form by ID with all related data */
export async function getFormById(formId: string) {
  return prisma.formDefinition.findUnique({
    where: { id: formId },
    include: FULL_FORM_INCLUDE,
  })
}

/** List all forms for the current org (system + custom, excludes ticket category forms).
 *  Custom forms are filtered by visibility: you see your own + SHARED ones. */
export async function listForms(userId?: string) {
  const all = await prisma.formDefinition.findMany({
    include: {
      pages: { select: { id: true }, orderBy: { sortOrder: 'asc' } },
      fields: { select: { id: true } },
      _count: { select: { submissions: true } },
      updatedByUser: { select: { id: true, firstName: true, lastName: true, avatar: true } },
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  })
  // Filter out ticket category forms
  // For custom forms, only show the creator's own forms + shared ones
  return all.filter((f) => {
    if (f.context === 'TICKET_CATEGORY') return false
    if (f.context === 'CUSTOM' && userId && f.visibility === 'PRIVATE' && f.createdBy !== userId) return false
    return true
  })
}

/** Create a new custom form */
export async function createForm(data: {
  name: string
  description?: string | null
  context?: FormContext
  createdBy?: string | null
}) {
  return (prisma.formDefinition.create as Function)({
    data: {
      context: data.context ?? ('CUSTOM' as FormContext),
      description: data.description ?? null,
      categoryKey: null,
      systemKey: null,
      createdBy: data.createdBy ?? null,
      // Create a default first page
      pages: {
        create: [{ title: data.name || 'Page 1', sortOrder: 0 }],
      },
    },
    include: FULL_FORM_INCLUDE,
  })
}

/** Update form-level settings */
export async function updateForm(
  formId: string,
  patch: {
    description?: string | null
    coverColor?: string | null
    confirmMessage?: string | null
    redirectUrl?: string | null
    autoSave?: boolean
    allowDrafts?: boolean
    isPublic?: boolean
    requireEmail?: boolean
    visibility?: 'PRIVATE' | 'SHARED'
    publicStyle?: 'MINIMAL' | 'SPLIT' | 'HERO'
    publicCtaColor?: string | null
    publicBgColor?: string | null
    publicImageUrl?: string | null
    publicImageSide?: 'LEFT' | 'RIGHT'
    logoUrl?: string | null
    updatedById?: string
  }
) {
  return prisma.formDefinition.update({
    where: { id: formId },
    data: patch,
    include: FULL_FORM_INCLUDE,
  })
}

/** Stamp the updatedById on a form (called after any edit — fields, pages, etc.) */
export async function touchFormUpdatedBy(formId: string, userId: string) {
  await rawPrisma.formDefinition.update({
    where: { id: formId },
    data: { updatedById: userId },
  })
}

/** Delete a custom form (system forms cannot be deleted) */
export async function deleteForm(formId: string) {
  const form = await prisma.formDefinition.findUnique({
    where: { id: formId },
    select: { isDefault: true, systemKey: true },
  })
  if (form?.isDefault || form?.systemKey) {
    throw new Error('System forms cannot be deleted')
  }
  return prisma.formDefinition.delete({ where: { id: formId } })
}

// ─── Page CRUD ───────────────────────────────────────────────────────────────

export async function addPage(formId: string, page: FormPageInput) {
  const maxPage = await prisma.formPage.findFirst({
    where: { formId },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  })
  const sortOrder = page.sortOrder ?? (maxPage?.sortOrder ?? -1) + 1

  return prisma.formPage.create({
    data: {
      formId,
      title: page.title,
      description: page.description ?? null,
      sortOrder,
      isOptional: page.isOptional ?? false,
      condFieldKey: page.condFieldKey ?? null,
      condOperator: page.condOperator ?? null,
      condEquals: page.condEquals ?? null,
    },
    include: { fields: { orderBy: { sortOrder: 'asc' } } },
  })
}

export async function updatePage(pageId: string, patch: Partial<FormPageInput>) {
  return prisma.formPage.update({
    where: { id: pageId },
    data: {
      ...(patch.title != null && { title: patch.title }),
      ...(patch.description !== undefined && { description: patch.description ?? null }),
      ...(patch.sortOrder != null && { sortOrder: patch.sortOrder }),
      ...(patch.isOptional != null && { isOptional: patch.isOptional }),
      ...(patch.condFieldKey !== undefined && { condFieldKey: patch.condFieldKey ?? null }),
      ...(patch.condOperator !== undefined && { condOperator: patch.condOperator ?? null }),
      ...(patch.condEquals !== undefined && { condEquals: patch.condEquals ?? null }),
    },
  })
}

export async function removePage(pageId: string) {
  // Move fields from this page to null (unassigned) before deleting
  await prisma.formField.updateMany({
    where: { pageId },
    data: { pageId: null },
  })
  return prisma.formPage.delete({ where: { id: pageId } })
}

export async function reorderPages(formId: string, pageIds: string[]) {
  const updates = pageIds.map((id, index) =>
    prisma.formPage.update({ where: { id }, data: { sortOrder: index } })
  )
  await Promise.all(updates)
  return prisma.formDefinition.findUnique({
    where: { id: formId },
    include: FULL_FORM_INCLUDE,
  })
}

// ─── Seed System Forms ──────────────────────────────────────────────────────

/**
 * Seed system forms for an org if they don't exist yet.
 * Uses rawPrisma because this may run outside org context (during signup or lazy seed).
 */
export async function seedSystemForms(orgId: string): Promise<void> {
  // Check if any system forms already exist for this org
  const existing = await rawPrisma.formDefinition.findFirst({
    where: { organizationId: orgId, isDefault: true },
    select: { id: true },
  })
  if (existing) return // Already seeded

  for (const seed of SYSTEM_FORM_SEEDS) {
    const form = await rawPrisma.formDefinition.create({
      data: {
        organizationId: orgId,
        context: seed.context as FormContext,
        systemKey: seed.systemKey,
        description: seed.description,
        isDefault: true,
      },
    })

    for (let pi = 0; pi < seed.pages.length; pi++) {
      const pageSeed = seed.pages[pi]
      const page = await rawPrisma.formPage.create({
        data: {
          formId: form.id,
          title: pageSeed.title,
          sortOrder: pi,
        },
      })

      if (pageSeed.fields.length > 0) {
        await rawPrisma.formField.createMany({
          data: pageSeed.fields.map((f, fi) => ({
            formId: form.id,
            pageId: page.id,
            key: f.key,
            label: f.label,
            type: f.type,
            required: f.required,
            protection: f.protection as FieldProtection,
            isIncluded: true,
            placeholder: f.placeholder ?? null,
            helpText: f.helpText ?? null,
            options: f.options ?? [],
            sortOrder: fi,
          })),
        })
      }
    }
  }

  // Seed default approval workflows for the newly created forms
  await seedFormApprovalDefaults(orgId)
}

/**
 * Seed default approval workflows for system forms.
 * Each system form gets a default catch-all workflow so admins have something to configure.
 */
export async function seedFormApprovalDefaults(orgId: string): Promise<void> {
  // Look up system forms for this org
  const systemForms = await rawPrisma.formDefinition.findMany({
    where: { organizationId: orgId, systemKey: { not: null }, isDefault: true },
    select: { id: true, systemKey: true },
  })

  if (systemForms.length === 0) return

  // Look up the org's teams by slug so we can assign the right team to each form
  const teams = await rawPrisma.team.findMany({
    where: { organizationId: orgId },
    select: { id: true, slug: true },
  })
  const teamBySlug = Object.fromEntries(teams.map((t) => [t.slug, t.id]))

  // Default workflow mapping: systemKey → { ruleName, teamSlug, module }
  const defaults: Record<string, { name: string; teamSlug: string; module: string }> = {
    single_event: { name: 'Default Event Approval', teamSlug: 'administration', module: 'EVENT' },
    recurring_event: { name: 'Default Event Approval', teamSlug: 'administration', module: 'EVENT' },
    multiday_event: { name: 'Default Event Approval', teamSlug: 'administration', module: 'EVENT' },
    facilities_request: { name: 'Default Facilities Approval', teamSlug: 'maintenance', module: 'MAINTENANCE' },
    it_request: { name: 'Default IT Approval', teamSlug: 'it-support', module: 'IT' },
  }

  for (const form of systemForms) {
    if (!form.systemKey || !defaults[form.systemKey]) continue

    // Skip if this form already has approval rules
    const existingRules = await rawPrisma.approvalRule.findFirst({
      where: { organizationId: orgId, formDefinitionId: form.id },
      select: { id: true },
    })
    if (existingRules) continue

    const def = defaults[form.systemKey]
    const teamId = teamBySlug[def.teamSlug]
    if (!teamId) continue // Team not found — skip

    // Create the default catch-all rule
    const rule = await rawPrisma.approvalRule.create({
      data: {
        organizationId: orgId,
        formDefinitionId: form.id,
        module: def.module,
        name: def.name,
        isDefault: true,
        sortOrder: 0,
      },
    })

    // Add the primary team as a required approval step
    await rawPrisma.approvalFlowEntry.create({
      data: {
        organizationId: orgId,
        ruleId: rule.id,
        teamId,
        mode: 'REQUIRED',
        trigger: 'ALWAYS',
        sortOrder: 0,
      },
    })

    // Event forms also get Facilities, IT, and A/V as conditional approvers
    const isEventForm = ['single_event', 'recurring_event', 'multiday_event'].includes(form.systemKey!)
    if (isEventForm) {
      const maintenanceTeamId = teamBySlug['maintenance']
      const itTeamId = teamBySlug['it-support']
      const avTeamId = teamBySlug['av-production']

      if (maintenanceTeamId) {
        await rawPrisma.approvalFlowEntry.create({
          data: {
            organizationId: orgId,
            ruleId: rule.id,
            teamId: maintenanceTeamId,
            mode: 'REQUIRED',
            trigger: 'WHEN_RESOURCE_REQUESTED',
            resourceType: 'facilities',
            sortOrder: 1,
          },
        })
      }
      if (itTeamId) {
        await rawPrisma.approvalFlowEntry.create({
          data: {
            organizationId: orgId,
            ruleId: rule.id,
            teamId: itTeamId,
            mode: 'REQUIRED',
            trigger: 'WHEN_RESOURCE_REQUESTED',
            resourceType: 'it',
            sortOrder: 2,
          },
        })
      }
      if (avTeamId) {
        await rawPrisma.approvalFlowEntry.create({
          data: {
            organizationId: orgId,
            ruleId: rule.id,
            teamId: avTeamId,
            mode: 'REQUIRED',
            trigger: 'WHEN_RESOURCE_REQUESTED',
            resourceType: 'av',
            sortOrder: 3,
          },
        })
      }
    }
  }
}

// ─── Clone Form (for per-event copies) ──────────────────────────────────────

/**
 * Deep-clone a form definition for a specific event.
 * Copies pages, fields, and actions. Sets parentTemplateId back to the source.
 */
export async function cloneFormForEvent(
  templateFormId: string,
  eventId: string,
  orgId: string
) {
  const source = await rawPrisma.formDefinition.findUnique({
    where: { id: templateFormId },
    include: {
      pages: { orderBy: { sortOrder: 'asc' }, include: { fields: { orderBy: { sortOrder: 'asc' } } } },
      fields: { where: { pageId: null }, orderBy: { sortOrder: 'asc' } },
      actions: { orderBy: { sortOrder: 'asc' } },
    },
  })

  if (!source) throw new Error('Template form not found')

  // Create the clone
  const clone = await rawPrisma.formDefinition.create({
    data: {
      organizationId: orgId,
      context: source.context,
      eventId,
      parentTemplateId: templateFormId,
      systemKey: source.systemKey,
      isDefault: false,
      description: source.description,
      coverColor: source.coverColor,
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
    },
  })

  // Clone pages with their fields
  for (const page of source.pages) {
    const newPage = await rawPrisma.formPage.create({
      data: {
        formId: clone.id,
        title: page.title,
        description: page.description,
        sortOrder: page.sortOrder,
        isOptional: page.isOptional,
        condFieldKey: page.condFieldKey,
        condOperator: page.condOperator,
        condEquals: page.condEquals,
      },
    })

    if (page.fields.length > 0) {
      await rawPrisma.formField.createMany({
        data: page.fields.map((f) => ({
          formId: clone.id,
          pageId: newPage.id,
          key: f.key,
          label: f.label,
          type: f.type,
          required: f.required,
          placeholder: f.placeholder,
          helpText: f.helpText,
          options: f.options,
          autoEscalate: f.autoEscalate,
          workflowActions: f.workflowActions ?? undefined,
          condFieldKey: f.condFieldKey,
          condOperator: f.condOperator,
          condEquals: f.condEquals,
          sortOrder: f.sortOrder,
          protection: f.protection,
          isIncluded: f.isIncluded,
          sensitivityLevel: f.sensitivityLevel,
          defaultValue: f.defaultValue,
          prefillSource: f.prefillSource,
          minValue: f.minValue,
          maxValue: f.maxValue,
          pattern: f.pattern,
          errorMessage: f.errorMessage,
          fileTypes: f.fileTypes,
          maxFileSize: f.maxFileSize,
        })),
      })
    }
  }

  // Clone pageless fields
  if (source.fields.length > 0) {
    await rawPrisma.formField.createMany({
      data: source.fields.map((f) => ({
        formId: clone.id,
        pageId: null,
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required,
        placeholder: f.placeholder,
        helpText: f.helpText,
        options: f.options,
        autoEscalate: f.autoEscalate,
        workflowActions: f.workflowActions ?? undefined,
        condFieldKey: f.condFieldKey,
        condOperator: f.condOperator,
        condEquals: f.condEquals,
        sortOrder: f.sortOrder,
        protection: f.protection,
        isIncluded: f.isIncluded,
        sensitivityLevel: f.sensitivityLevel,
        defaultValue: f.defaultValue,
        prefillSource: f.prefillSource,
        minValue: f.minValue,
        maxValue: f.maxValue,
        pattern: f.pattern,
        errorMessage: f.errorMessage,
        fileTypes: f.fileTypes,
        maxFileSize: f.maxFileSize,
      })),
    })
  }

  // Clone actions
  if (source.actions.length > 0) {
    await rawPrisma.formAction.createMany({
      data: source.actions.map((a) => ({
        formId: clone.id,
        actionType: a.actionType,
        config: a.config as object,
        sortOrder: a.sortOrder,
        isEnabled: a.isEnabled,
      })),
    })
  }

  return rawPrisma.formDefinition.findUnique({
    where: { id: clone.id },
    include: FULL_FORM_INCLUDE,
  })
}
