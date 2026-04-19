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
import { DEFAULT_CATEGORY_FIELDS, type FormFieldInput } from '@/lib/forms/schemas'
import type { FormFieldType } from '@prisma/client'

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
      label: field.label,
      type: field.type as FormFieldType,
      required: field.required ?? false,
      placeholder: field.placeholder ?? null,
      helpText: field.helpText ?? null,
      options: field.options ?? [],
      autoEscalate: field.autoEscalate ?? false,
      condFieldKey: field.condFieldKey ?? null,
      condEquals: field.condEquals ?? null,
      sortOrder,
      sectionId: field.sectionId ?? null,
    },
  })
}

// ─── Update a single field ────────────────────────────────────────────────────

export async function updateField(
  fieldId: string,
  patch: Partial<FormFieldInput>
) {
  return prisma.formField.update({
    where: { id: fieldId },
    data: {
      ...(patch.key != null && { key: patch.key }),
      ...(patch.label != null && { label: patch.label }),
      ...(patch.type != null && { type: patch.type as FormFieldType }),
      ...(patch.required != null && { required: patch.required }),
      ...(patch.placeholder !== undefined && { placeholder: patch.placeholder ?? null }),
      ...(patch.helpText !== undefined && { helpText: patch.helpText ?? null }),
      ...(patch.options != null && { options: patch.options }),
      ...(patch.autoEscalate != null && { autoEscalate: patch.autoEscalate }),
      ...(patch.condFieldKey !== undefined && { condFieldKey: patch.condFieldKey ?? null }),
      ...(patch.condEquals !== undefined && { condEquals: patch.condEquals ?? null }),
      ...(patch.sortOrder != null && { sortOrder: patch.sortOrder }),
      ...(patch.sectionId !== undefined && { sectionId: patch.sectionId ?? null }),
    },
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
