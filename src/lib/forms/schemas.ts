import { z } from 'zod'

// ─── Field Type Enum ──────────────────────────────────────────────────────────

export const FORM_FIELD_TYPES = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'DATE',
  'EMAIL',
  'PHONE',
  'DROPDOWN',
  'MULTI_SELECT',
  'CHECKBOX',
  'FILE',
  'SIGNATURE',
  'ASSET_PICKER',
  'USER_PICKER',
  'LOCATION_PICKER',
  'GRADE_SELECTOR',
] as const

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number]

export const FormFieldTypeZ = z.enum(FORM_FIELD_TYPES)

// ─── Field Type Metadata (for Add Field picker UI) ───────────────────────────

export interface FieldTypeMeta {
  type: FormFieldType
  label: string
  icon: string // Lucide icon name
  description: string
  category: 'basic' | 'choice' | 'special'
}

export const FIELD_TYPE_META: FieldTypeMeta[] = [
  // Basic
  { type: 'TEXT', label: 'Text', icon: 'Type', description: 'Single-line input', category: 'basic' },
  { type: 'TEXTAREA', label: 'Textarea', icon: 'AlignLeft', description: 'Multi-line input', category: 'basic' },
  { type: 'NUMBER', label: 'Number', icon: 'Hash', description: 'Numeric input', category: 'basic' },
  { type: 'DATE', label: 'Date', icon: 'Calendar', description: 'Date picker', category: 'basic' },
  { type: 'EMAIL', label: 'Email', icon: 'Mail', description: 'Email address', category: 'basic' },
  { type: 'PHONE', label: 'Phone', icon: 'Phone', description: 'Phone number', category: 'basic' },
  // Choice
  { type: 'DROPDOWN', label: 'Dropdown', icon: 'ChevronDown', description: 'Pick one from a list', category: 'choice' },
  { type: 'MULTI_SELECT', label: 'Multi-select', icon: 'ListChecks', description: 'Pick multiple', category: 'choice' },
  { type: 'CHECKBOX', label: 'Checkbox', icon: 'CheckSquare', description: 'Yes/no toggle', category: 'choice' },
  // Special
  { type: 'FILE', label: 'File Upload', icon: 'Upload', description: 'File attachment', category: 'special' },
  { type: 'SIGNATURE', label: 'Signature', icon: 'PenTool', description: 'Signature pad', category: 'special' },
  { type: 'ASSET_PICKER', label: 'Asset Picker', icon: 'Monitor', description: 'Select a device/asset', category: 'special' },
  { type: 'USER_PICKER', label: 'User Picker', icon: 'User', description: 'Select a staff member', category: 'special' },
  { type: 'LOCATION_PICKER', label: 'Location', icon: 'MapPin', description: 'Building/room picker', category: 'special' },
  { type: 'GRADE_SELECTOR', label: 'Grade', icon: 'GraduationCap', description: 'Grade level selector', category: 'special' },
]

export function getFieldTypeMeta(type: FormFieldType): FieldTypeMeta {
  return FIELD_TYPE_META.find((m) => m.type === type) ?? FIELD_TYPE_META[0]
}

// ─── Conditional Logic Schema ─────────────────────────────────────────────────

export const conditionalRuleSchema = z.object({
  fieldKey: z.string().min(1),
  equals: z.string(),
})

// ─── Form Field Schema ────────────────────────────────────────────────────────

export const formFieldSchema = z.object({
  id: z.string().optional(), // omitted on create
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  type: FormFieldTypeZ,
  required: z.boolean().default(false),
  placeholder: z.string().max(500).nullable().optional(),
  helpText: z.string().max(500).nullable().optional(),
  options: z.array(z.string()).default([]),
  autoEscalate: z.boolean().optional().default(false),
  condFieldKey: z.string().nullable().optional(),
  condEquals: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0),
  sectionId: z.string().nullable().optional(),
})

export type FormFieldInput = z.infer<typeof formFieldSchema>

// ─── Form Section Schema ──────────────────────────────────────────────────────

export const formSectionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(200),
  sortOrder: z.number().int().min(0),
  fields: z.array(formFieldSchema).default([]),
})

export type FormSectionInput = z.infer<typeof formSectionSchema>

// ─── Public Style Enums ───────────────────────────────────────────────────────

export const PublicFormStyleZ = z.enum(['MINIMAL', 'SPLIT', 'HERO'])
export type PublicFormStyleType = z.infer<typeof PublicFormStyleZ>

export const FormImageSideZ = z.enum(['LEFT', 'RIGHT'])
export type FormImageSideType = z.infer<typeof FormImageSideZ>

// ─── Form Definition Schema (for PUT updates) ────────────────────────────────

export const formDefinitionUpdateSchema = z.object({
  sections: z.array(formSectionSchema).optional(),
  fields: z.array(formFieldSchema).optional(),
  publicStyle: PublicFormStyleZ.optional(),
  publicCtaColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  publicBgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  publicImageUrl: z.string().url().nullable().optional(),
  publicImageSide: FormImageSideZ.optional(),
})

export type FormDefinitionUpdate = z.infer<typeof formDefinitionUpdateSchema>

// ─── Reorder Schema ───────────────────────────────────────────────────────────

export const reorderSchema = z.object({
  fieldIds: z.array(z.string().min(1)).min(1),
})

// ─── QR Code Schemas ──────────────────────────────────────────────────────────

export const formQrCodeCreateSchema = z.object({
  categoryKey: z.string().nullable().optional(),
  buildingId: z.string().nullable().optional(),
  areaId: z.string().nullable().optional(),
  roomId: z.string().nullable().optional(),
  label: z.string().min(1).max(200),
})

export type FormQrCodeCreate = z.infer<typeof formQrCodeCreateSchema>

export const formQrCodeUpdateSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  active: z.boolean().optional(),
})

// ─── Standard Ticket Fields (always present, not stored in FormDefinition) ───

export interface StandardField {
  key: string
  label: string
  type: FormFieldType
  required: boolean
  placeholder?: string
  options?: string[]
}

export const STANDARD_TICKET_FIELDS: StandardField[] = [
  { key: 'title', label: 'Title', type: 'TEXT', required: true, placeholder: 'Brief summary of the issue' },
  { key: 'description', label: 'Description', type: 'TEXTAREA', required: true, placeholder: 'What happened?' },
  { key: 'location', label: 'Location', type: 'LOCATION_PICKER', required: false, placeholder: 'Building / Room' },
  { key: 'priority', label: 'Priority', type: 'DROPDOWN', required: true, options: ['Low', 'Normal', 'High', 'Urgent'] },
]

// ─── Default Category Forms (seed data) ──────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DEFAULT_CATEGORY_FIELDS: Record<string, any[]> = {
  hardware: [
    { key: 'device_type', label: 'Device Type', type: 'DROPDOWN', required: true,
      options: ['Chromebook', 'Laptop', 'Desktop', 'Tablet', 'Printer', 'Other'],
      helpText: 'Choose the type of device that has issues' },
    { key: 'asset_tag', label: 'Asset Tag', type: 'TEXT', required: false,
      placeholder: 'e.g., DEV-0042' },
    { key: 'people_affected', label: 'Number of people affected', type: 'NUMBER', required: false,
      condFieldKey: 'priority', condEquals: 'Urgent',
      helpText: 'Only shown when priority is Urgent' },
  ],
  software: [
    { key: 'application_name', label: 'Application Name', type: 'TEXT', required: true,
      placeholder: 'e.g., Google Classroom' },
    { key: 'error_message', label: 'Error Message', type: 'TEXTAREA', required: false,
      placeholder: 'Paste any error text you saw' },
  ],
  account_password: [
    { key: 'username', label: 'Username or email', type: 'TEXT', required: true,
      placeholder: 'The account that needs help' },
    { key: 'account_type', label: 'Account Type', type: 'DROPDOWN', required: true,
      options: ['Google Workspace', 'Student Portal', 'Staff Portal', 'Other'] },
  ],
  network: [
    { key: 'connection_type', label: 'Connection Type', type: 'DROPDOWN', required: true,
      options: ['Wi-Fi', 'Wired', 'Both'] },
    { key: 'devices_affected', label: 'How many devices affected?', type: 'DROPDOWN', required: false,
      options: ['Just mine', 'A few in the area', 'Whole room/floor', 'Entire building'] },
  ],
  plumbing: [
    { key: 'active_leak', label: 'Active leak right now?', type: 'CHECKBOX', required: false,
      autoEscalate: true, helpText: 'Auto-escalates the ticket to Urgent priority' },
    { key: 'shutoff_accessible', label: 'Water shutoff accessible?', type: 'CHECKBOX', required: false },
    { key: 'affected_area', label: 'Affected area description', type: 'TEXT', required: false,
      placeholder: 'Where is the water?' },
  ],
  electrical: [
    { key: 'safety_hazard', label: 'Safety hazard?', type: 'CHECKBOX', required: false,
      autoEscalate: true, helpText: 'Auto-escalates the ticket to Urgent priority' },
    { key: 'affected_area', label: 'Affected area', type: 'TEXT', required: false },
  ],
  hvac: [
    { key: 'issue_type', label: 'Issue Type', type: 'DROPDOWN', required: true,
      options: ['Too hot', 'Too cold', 'No airflow', 'Strange smell', 'Noise', 'Other'] },
    { key: 'thermostat_setting', label: 'Current thermostat setting', type: 'NUMBER', required: false,
      placeholder: 'Temperature in degrees' },
  ],
  custodial: [
    { key: 'hazard_type', label: 'Hazard Type', type: 'DROPDOWN', required: true,
      options: ['Spill', 'Broken glass', 'Biohazard', 'Odor', 'Pest', 'Other'] },
    { key: 'immediate_danger', label: 'Immediate danger to students/staff?', type: 'CHECKBOX', required: false,
      autoEscalate: true, helpText: 'Auto-escalates to Urgent' },
  ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a stable slug from a label */
export function slugifyFieldKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

/** Pick readable text color (white or dark) for a given background hex */
export function readableTextColor(hex: string): string {
  const h = (hex || '').replace('#', '')
  if (h.length !== 6) return '#ffffff'
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.58 ? '#1a1915' : '#ffffff'
}
