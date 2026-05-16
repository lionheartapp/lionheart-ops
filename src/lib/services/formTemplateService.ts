/**
 * Form Template Service
 *
 * Manages FormTemplate records — system templates seeded per org,
 * user-saved templates, and cloning templates into new forms.
 */

import { prisma } from '@/lib/db'
import { rawPrisma } from '@/lib/db'
import type { FormContext } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TemplateFieldSnapshot {
  key: string
  label: string
  type: string
  required: boolean
  placeholder?: string | null
  helpText?: string | null
  options?: string[]
  protection?: string
  sortOrder: number
}

export interface TemplatePageSnapshot {
  title: string
  description?: string | null
  sortOrder: number
  isOptional?: boolean
  fields: TemplateFieldSnapshot[]
}

export interface TemplateSnapshot {
  pages: TemplatePageSnapshot[]
}

// ─── List Templates ──────────────────────────────────────────────────────────

export async function listTemplates() {
  return prisma.formTemplate.findMany({
    orderBy: [{ isSystem: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  })
}

// ─── Get Single Template ────────────────────────────────────────────────────

export async function getTemplate(templateId: string) {
  return prisma.formTemplate.findUnique({ where: { id: templateId } })
}

// ─── Save Form as Template ──────────────────────────────────────────────────

export async function saveFormAsTemplate(
  formId: string,
  name: string,
  category?: string | null,
  description?: string | null
) {
  // Snapshot the form's current state
  const form = await prisma.formDefinition.findUnique({
    where: { id: formId },
    include: {
      pages: {
        orderBy: { sortOrder: 'asc' },
        include: { fields: { orderBy: { sortOrder: 'asc' } } },
      },
      fields: { where: { pageId: null }, orderBy: { sortOrder: 'asc' } },
    },
  })

  if (!form) throw new Error('Form not found')

  const fieldSnapshot: TemplateSnapshot = {
    pages: form.pages.map((p) => ({
      title: p.title,
      description: p.description,
      sortOrder: p.sortOrder,
      isOptional: p.isOptional,
      fields: p.fields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required,
        placeholder: f.placeholder,
        helpText: f.helpText,
        options: f.options,
        protection: f.protection,
        sortOrder: f.sortOrder,
      })),
    })),
  }

  // Include loose fields on a virtual page if any
  if (form.fields.length > 0) {
    fieldSnapshot.pages.push({
      title: 'Additional Fields',
      sortOrder: fieldSnapshot.pages.length,
      fields: form.fields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        required: f.required,
        placeholder: f.placeholder,
        helpText: f.helpText,
        options: f.options,
        protection: f.protection,
        sortOrder: f.sortOrder,
      })),
    })
  }

  const styleSnapshot = {
    coverColor: form.coverColor,
    description: form.description,
    publicStyle: form.publicStyle,
    publicCtaColor: form.publicCtaColor,
    publicBgColor: form.publicBgColor,
  }

  return prisma.formTemplate.create({
    data: {
      name,
      description: description ?? form.description,
      category: category ?? null,
      fieldSnapshot: JSON.parse(JSON.stringify(fieldSnapshot)),
      styleSnapshot: JSON.parse(JSON.stringify(styleSnapshot)),
      isSystem: false,
    },
  })
}

// ─── Clone Template into a New Form ─────────────────────────────────────────

export async function cloneFromTemplate(
  templateId: string,
  createdBy: string
) {
  const template = await prisma.formTemplate.findUnique({
    where: { id: templateId },
  })

  if (!template) throw new Error('Template not found')

  const snapshot = template.fieldSnapshot as unknown as TemplateSnapshot
  const style = (template.styleSnapshot ?? {}) as Record<string, unknown>

  // Create the form
  const form = await (prisma.formDefinition.create as Function)({
    data: {
      context: 'CUSTOM' as FormContext,
      description: template.description ?? template.name,
      coverColor: (style.coverColor as string) ?? null,
      publicStyle: ((style.publicStyle as string) ?? 'MINIMAL') as 'MINIMAL' | 'SPLIT' | 'HERO',
      publicCtaColor: (style.publicCtaColor as string) ?? null,
      publicBgColor: (style.publicBgColor as string) ?? null,
      createdBy,
      parentTemplateId: null,
    },
  })

  // Create pages and fields
  for (const pageDef of snapshot.pages ?? []) {
    const page = await prisma.formPage.create({
      data: {
        formId: form.id,
        title: pageDef.title,
        description: pageDef.description ?? null,
        sortOrder: pageDef.sortOrder,
        isOptional: pageDef.isOptional ?? false,
      },
    })

    if (pageDef.fields.length > 0) {
      await prisma.formField.createMany({
        data: pageDef.fields.map((f) => ({
          formId: form.id,
          pageId: page.id,
          key: f.key,
          label: f.label,
          type: f.type as any,
          required: f.required,
          placeholder: f.placeholder ?? null,
          helpText: f.helpText ?? null,
          options: f.options ?? [],
          protection: (f.protection as any) ?? 'CUSTOM',
          sortOrder: f.sortOrder,
        })),
      })
    }
  }

  return prisma.formDefinition.findUnique({
    where: { id: form.id },
    include: {
      pages: {
        orderBy: { sortOrder: 'asc' },
        include: { fields: { orderBy: { sortOrder: 'asc' } } },
      },
      fields: { where: { pageId: null }, orderBy: { sortOrder: 'asc' } },
    },
  })
}

// ─── Delete Template ─────────────────────────────────────────────────────────

export async function deleteTemplate(templateId: string) {
  const template = await prisma.formTemplate.findUnique({
    where: { id: templateId },
    select: { isSystem: true },
  })
  if (template?.isSystem) {
    throw new Error('System templates cannot be deleted')
  }
  return prisma.formTemplate.delete({ where: { id: templateId } })
}

// ─── Seed System Templates ──────────────────────────────────────────────────

const SYSTEM_TEMPLATES: Array<{
  name: string
  icon: string
  description: string
  category: string
  pages: TemplatePageSnapshot[]
}> = [
  {
    name: 'Field Trip Permission',
    icon: 'Bus',
    description: 'Parent permission slip for field trips',
    category: 'events',
    pages: [
      {
        title: 'Trip Details', sortOrder: 0,
        fields: [
          { key: 'student_name', label: 'Student Name', type: 'TEXT', required: true, sortOrder: 0 },
          { key: 'destination', label: 'Destination', type: 'TEXT', required: true, placeholder: 'Where is the trip?', sortOrder: 1 },
          { key: 'trip_date', label: 'Trip Date', type: 'DATE', required: true, sortOrder: 2 },
          { key: 'departure_time', label: 'Departure Time', type: 'TIME', required: false, sortOrder: 3 },
          { key: 'return_time', label: 'Expected Return', type: 'TIME', required: false, sortOrder: 4 },
        ],
      },
      {
        title: 'Medical & Safety', sortOrder: 1,
        fields: [
          { key: 'emergency_contact', label: 'Emergency Contact', type: 'TEXT', required: true, sortOrder: 0 },
          { key: 'emergency_phone', label: 'Emergency Phone', type: 'PHONE', required: true, sortOrder: 1 },
          { key: 'medical_conditions', label: 'Medical Conditions / Allergies', type: 'TEXTAREA', required: false, helpText: 'List any conditions the chaperone should know about', sortOrder: 2 },
          { key: 'medications', label: 'Current Medications', type: 'TEXTAREA', required: false, sortOrder: 3 },
        ],
      },
      {
        title: 'Consent', sortOrder: 2,
        fields: [
          { key: 'transportation', label: 'Transportation Preference', type: 'DROPDOWN', required: true, options: ['School bus', 'Parent drives', 'No preference'], sortOrder: 0 },
          { key: 'photo_consent', label: 'Photo/video consent', type: 'CHECKBOX', required: false, sortOrder: 1 },
          { key: 'parent_name', label: 'Parent/Guardian Name', type: 'TEXT', required: true, sortOrder: 2 },
        ],
      },
    ],
  },
  {
    name: 'Volunteer Sign-Up',
    icon: 'Heart',
    description: 'Collect volunteer availability and skills',
    category: 'people',
    pages: [
      {
        title: 'Your Information', sortOrder: 0,
        fields: [
          { key: 'name', label: 'Full Name', type: 'TEXT', required: true, sortOrder: 0 },
          { key: 'email', label: 'Email', type: 'EMAIL', required: true, sortOrder: 1 },
          { key: 'phone', label: 'Phone', type: 'PHONE', required: false, sortOrder: 2 },
          { key: 'availability', label: 'Availability', type: 'MULTI_SELECT', required: true, options: ['Weekday mornings', 'Weekday afternoons', 'Weekday evenings', 'Weekends'], sortOrder: 3 },
          { key: 'skills', label: 'Skills / Interests', type: 'TEXTAREA', required: false, placeholder: 'What can you help with?', sortOrder: 4 },
          { key: 'background_check', label: 'I consent to a background check', type: 'CHECKBOX', required: true, sortOrder: 5 },
        ],
      },
    ],
  },
  {
    name: 'Incident Report',
    icon: 'AlertTriangle',
    description: 'Document safety incidents and follow-ups',
    category: 'safety',
    pages: [
      {
        title: 'Incident Details', sortOrder: 0,
        fields: [
          { key: 'incident_date', label: 'Date of Incident', type: 'DATE', required: true, sortOrder: 0 },
          { key: 'incident_time', label: 'Time of Incident', type: 'TIME', required: true, sortOrder: 1 },
          { key: 'incident_type', label: 'Incident Type', type: 'DROPDOWN', required: true, options: ['Injury', 'Property damage', 'Behavioral', 'Medical emergency', 'Other'], sortOrder: 2 },
          { key: 'severity', label: 'Severity', type: 'SCALE', required: true, sortOrder: 3 },
          { key: 'description', label: 'Description', type: 'TEXTAREA', required: true, placeholder: 'What happened?', sortOrder: 4 },
          { key: 'action_taken', label: 'Immediate Action Taken', type: 'TEXTAREA', required: true, sortOrder: 5 },
          { key: 'follow_up', label: 'Follow-up Required', type: 'CHECKBOX', required: false, sortOrder: 6 },
        ],
      },
    ],
  },
  {
    name: 'Parent Survey',
    icon: 'BarChart',
    description: 'School climate and satisfaction survey',
    category: 'feedback',
    pages: [
      {
        title: 'Overall Satisfaction', sortOrder: 0,
        fields: [
          { key: 'overall', label: 'Overall satisfaction with the school', type: 'RATING', required: true, sortOrder: 0 },
          { key: 'academics', label: 'Quality of academics', type: 'RATING', required: true, sortOrder: 1 },
          { key: 'communication', label: 'School-to-parent communication', type: 'RATING', required: true, sortOrder: 2 },
          { key: 'safety', label: 'Feeling of safety', type: 'RATING', required: true, sortOrder: 3 },
          { key: 'recommend', label: 'How likely to recommend (1-10)', type: 'SCALE', required: true, sortOrder: 4 },
          { key: 'comments', label: 'Additional Comments', type: 'TEXTAREA', required: false, placeholder: 'Anything else you want to share?', sortOrder: 5 },
        ],
      },
    ],
  },
  {
    name: 'Equipment Checkout',
    icon: 'Laptop',
    description: 'Track device loans to staff members',
    category: 'it',
    pages: [
      {
        title: 'Checkout Details', sortOrder: 0,
        fields: [
          { key: 'staff_name', label: 'Staff Member Name', type: 'TEXT', required: true, sortOrder: 0 },
          { key: 'staff_email', label: 'Staff Email', type: 'EMAIL', required: true, sortOrder: 1 },
          { key: 'device_type', label: 'Device Type', type: 'DROPDOWN', required: true, options: ['Laptop', 'Chromebook', 'Tablet', 'Projector', 'Camera', 'Other'], sortOrder: 2 },
          { key: 'asset_tag', label: 'Asset Tag / Serial', type: 'TEXT', required: true, placeholder: 'e.g. DEV-0042', sortOrder: 3 },
          { key: 'checkout_date', label: 'Checkout Date', type: 'DATE', required: true, sortOrder: 4 },
          { key: 'return_date', label: 'Expected Return Date', type: 'DATE', required: true, sortOrder: 5 },
          { key: 'condition', label: 'Condition Notes', type: 'TEXTAREA', required: false, placeholder: 'Note any existing damage', sortOrder: 6 },
        ],
      },
    ],
  },
]

export async function seedSystemTemplates(orgId: string): Promise<void> {
  const existing = await rawPrisma.formTemplate.findFirst({
    where: { organizationId: orgId, isSystem: true },
    select: { id: true },
  })
  if (existing) return

  for (let i = 0; i < SYSTEM_TEMPLATES.length; i++) {
    const t = SYSTEM_TEMPLATES[i]
    await rawPrisma.formTemplate.create({
      data: {
        organizationId: orgId,
        name: t.name,
        icon: t.icon,
        description: t.description,
        category: t.category,
        fieldSnapshot: JSON.parse(JSON.stringify({ pages: t.pages })),
        isSystem: true,
        sortOrder: i,
      },
    })
  }
}
