import { z } from 'zod'

// ─── Field Type Enum ──────────────────────────────────────────────────────────

export const FORM_FIELD_TYPES = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'DATE',
  'TIME',
  'EMAIL',
  'PHONE',
  'URL',
  'DROPDOWN',
  'MULTI_SELECT',
  'RADIO',
  'CHECKBOX',
  'RATING',
  'SCALE',
  'FILE',
  'SIGNATURE',
  'ASSET_PICKER',
  'USER_PICKER',
  'LOCATION_PICKER',
  'GRADE_SELECTOR',
  'HEADER',
  'DIVIDER',
] as const

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number]

export const FormFieldTypeZ = z.enum(FORM_FIELD_TYPES)

// ─── Field Type Metadata (for Add Field picker UI) ───────────────────────────

export type FieldTypeCategory = 'text' | 'choices' | 'date_time' | 'uploads' | 'pickers' | 'layout'

export interface FieldTypeMeta {
  type: FormFieldType
  label: string
  icon: string // Lucide icon name
  description: string
  category: FieldTypeCategory
  /** True for types that don't collect data (Header, Divider) */
  isLayout?: boolean
}

export const FIELD_TYPE_META: FieldTypeMeta[] = [
  // Text
  { type: 'TEXT', label: 'Text', icon: 'Type', description: 'Single-line input', category: 'text' },
  { type: 'TEXTAREA', label: 'Long Text', icon: 'AlignLeft', description: 'Multi-line input', category: 'text' },
  { type: 'NUMBER', label: 'Number', icon: 'Hash', description: 'Numeric input', category: 'text' },
  { type: 'EMAIL', label: 'Email', icon: 'Mail', description: 'Email address', category: 'text' },
  { type: 'PHONE', label: 'Phone', icon: 'Phone', description: 'Phone number', category: 'text' },
  { type: 'URL', label: 'URL', icon: 'Link', description: 'Web address', category: 'text' },
  // Choices
  { type: 'DROPDOWN', label: 'Dropdown', icon: 'ChevronDown', description: 'Pick one from a list', category: 'choices' },
  { type: 'RADIO', label: 'Radio', icon: 'Circle', description: 'Pick one (visible options)', category: 'choices' },
  { type: 'MULTI_SELECT', label: 'Multi-select', icon: 'ListChecks', description: 'Pick multiple', category: 'choices' },
  { type: 'CHECKBOX', label: 'Checkbox', icon: 'CheckSquare', description: 'Yes/no toggle', category: 'choices' },
  { type: 'RATING', label: 'Rating', icon: 'Star', description: 'Star rating (1–5)', category: 'choices' },
  { type: 'SCALE', label: 'Scale', icon: 'SlidersHorizontal', description: 'Linear scale (1–10)', category: 'choices' },
  // Date & Time
  { type: 'DATE', label: 'Date', icon: 'Calendar', description: 'Date picker', category: 'date_time' },
  { type: 'TIME', label: 'Time', icon: 'Clock', description: 'Time picker', category: 'date_time' },
  // Uploads
  { type: 'FILE', label: 'File Upload', icon: 'Upload', description: 'File attachment', category: 'uploads' },
  { type: 'SIGNATURE', label: 'Signature', icon: 'PenTool', description: 'Signature pad', category: 'uploads' },
  // Pickers
  { type: 'USER_PICKER', label: 'Person', icon: 'User', description: 'Select a staff member', category: 'pickers' },
  { type: 'LOCATION_PICKER', label: 'Location', icon: 'MapPin', description: 'Building/room picker', category: 'pickers' },
  { type: 'ASSET_PICKER', label: 'Asset', icon: 'Monitor', description: 'Select a device/asset', category: 'pickers' },
  { type: 'GRADE_SELECTOR', label: 'Grade', icon: 'GraduationCap', description: 'Grade level selector', category: 'pickers' },
  // Layout
  { type: 'HEADER', label: 'Header', icon: 'Heading', description: 'Section heading text', category: 'layout', isLayout: true },
  { type: 'DIVIDER', label: 'Divider', icon: 'Minus', description: 'Visual separator', category: 'layout', isLayout: true },
]

/** Category labels for the field palette UI */
export const FIELD_CATEGORY_LABELS: Record<FieldTypeCategory, string> = {
  text: 'Text',
  choices: 'Choices',
  date_time: 'Date & Time',
  uploads: 'Uploads & Media',
  pickers: 'Pickers',
  layout: 'Layout',
}

export function getFieldTypeMeta(type: FormFieldType): FieldTypeMeta {
  return FIELD_TYPE_META.find((m) => m.type === type) ?? FIELD_TYPE_META[0]
}

// ─── Conditional Logic Schema ─────────────────────────────────────────────────

export const conditionalRuleSchema = z.object({
  fieldKey: z.string().min(1),
  equals: z.string(),
})

// ─── Form Field Schema ────────────────────────────────────────────────────────

export const FieldProtectionZ = z.enum(['LOCKED', 'DEFAULT', 'CUSTOM'])
export const FieldSensitivityZ = z.enum(['PUBLIC', 'INTERNAL', 'FERPA_PROTECTED'])
export const FormContextZ = z.enum(['TICKET_CATEGORY', 'EVENT_REGISTRATION', 'EVENT_CREATION', 'CUSTOM'])
export const FormActionTypeZ = z.enum(['CREATE_RECORD', 'NOTIFY', 'REQUIRE_APPROVAL', 'WEBHOOK', 'REDIRECT'])

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
  condOperator: z.string().nullable().optional(),
  condEquals: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0),
  sectionId: z.string().nullable().optional(),
  pageId: z.string().nullable().optional(),
  // Protection & visibility
  protection: FieldProtectionZ.optional().default('CUSTOM'),
  isIncluded: z.boolean().optional().default(true),
  sensitivityLevel: FieldSensitivityZ.optional().default('PUBLIC'),
  // Validation
  minValue: z.string().nullable().optional(),
  maxValue: z.string().nullable().optional(),
  pattern: z.string().nullable().optional(),
  errorMessage: z.string().max(500).nullable().optional(),
  // Defaults & pre-fill
  defaultValue: z.string().nullable().optional(),
  prefillSource: z.string().nullable().optional(),
  // File upload config
  fileTypes: z.array(z.string()).optional().default([]),
  maxFileSize: z.number().int().nullable().optional(),
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

// ─── Form Page Schema ────────────────────────────────────────────────────────

export const formPageSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0),
  isOptional: z.boolean().optional().default(false),
  condFieldKey: z.string().nullable().optional(),
  condOperator: z.string().nullable().optional(),
  condEquals: z.string().nullable().optional(),
})

export type FormPageInput = z.infer<typeof formPageSchema>

// ─── Form Action Schema ──────────────────────────────────────────────────────

export const formActionSchema = z.object({
  id: z.string().optional(),
  actionType: FormActionTypeZ,
  config: z.record(z.string(), z.unknown()),
  sortOrder: z.number().int().min(0).optional().default(0),
  isEnabled: z.boolean().optional().default(true),
})

export type FormActionInput = z.infer<typeof formActionSchema>

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

// eslint-disable-next-line
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
