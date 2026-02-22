/**
 * Form builder: field types and default config.
 * Forms: { id, title, description?, fields[], approvalWorkflow?, submissionType?, createdBy, createdAt }
 * Field: { id, type, label, required, placeholder?, options?, validation?, conditional?, targetKey? }
 * Submission: { id, formId, data: {}, submittedAt, status?, approvals?, submittedBy?, eventId? }
 *
 * approvalWorkflow: { approverIds: string[], type: 'all' } - all approvers must approve
 * submissionType: 'general' | 'event-request' - event-request creates calendar event when approved
 * targetKey: for event-request forms, maps field to event prop (name, date, time, location, description, owner)
 */

// Component palette - categorized like reference (Layout, Text, Date, Multi, Media)
export const FIELD_CATEGORIES = [
  {
    id: 'layout',
    label: 'Layout',
    items: [
      { id: 'section', label: 'Section', icon: 'Layers' },
      { id: 'table', label: 'Table', icon: 'Table' },
    ],
  },
  {
    id: 'text',
    label: 'Text',
    items: [
      { id: 'text', label: 'Single line', icon: 'Type' },
      { id: 'textarea', label: 'Multiline', icon: 'AlignLeft' },
      { id: 'number', label: 'Number', icon: 'Hash' },
      { id: 'email', label: 'Email', icon: 'Mail' },
      { id: 'phone', label: 'Phone', icon: 'Phone' },
    ],
  },
  {
    id: 'date',
    label: 'Date',
    items: [
      { id: 'date', label: 'Date', icon: 'Calendar' },
      { id: 'datetime', label: 'Date & Time', icon: 'CalendarClock' },
    ],
  },
  {
    id: 'multi',
    label: 'Multi',
    items: [
      { id: 'yesno', label: 'Yes/No', icon: 'ToggleLeft' },
      { id: 'dropdown', label: 'Dropdown', icon: 'ChevronDown' },
      { id: 'checkbox', label: 'Checkbox', icon: 'CheckSquare' },
      { id: 'checklist', label: 'Checklist', icon: 'ListChecks' },
      { id: 'radio', label: 'Multiple choice', icon: 'Circle' },
      { id: 'profiles', label: 'Profiles', icon: 'Users' },
    ],
  },
  {
    id: 'media',
    label: 'Media',
    items: [
      { id: 'attachment', label: 'Attachments', icon: 'Paperclip' },
      { id: 'image', label: 'Image', icon: 'Image' },
      { id: 'slider', label: 'Slider', icon: 'SlidersHorizontal' },
    ],
  },
  {
    id: 'other',
    label: 'Other',
    items: [
      { id: 'signature', label: 'Signature', icon: 'PenTool' },
      { id: 'hidden', label: 'Hidden field', icon: 'EyeOff' },
    ],
  },
]

// Flat list for backwards compat
export const FIELD_TYPES = FIELD_CATEGORIES.flatMap((c) =>
  c.items.map((i) => ({ ...i, category: c.id }))
)

export function createField(type, overrides = {}) {
  const id = `f_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const base = {
    id,
    type,
    label: type === 'hidden' ? 'Hidden' : type === 'section' ? 'Section' : 'Untitled field',
    required: false,
    placeholder: '',
    ...overrides,
  }
  if (['dropdown', 'radio', 'yesno', 'checklist'].includes(type)) {
    base.options = base.options || (type === 'yesno' ? ['Yes', 'No'] : ['Option 1', 'Option 2'])
  }
  if (type === 'email') {
    base.validation = { ...base.validation, email: true }
  }
  if (type === 'phone') {
    base.validation = { ...base.validation, phone: true }
  }
  if (['text', 'textarea'].includes(type)) {
    base.validation = { ...base.validation, maxLength: base.validation?.maxLength ?? null }
  }
  if (type === 'slider') {
    base.validation = { ...base.validation, min: 0, max: 100, step: 1 }
  }
  if (type === 'section') {
    base.description = ''
    base.colSpan = 2
    base.sectionBackgroundColor = ''
    base.sectionBackgroundImage = ''
    base.useAsStep = true
  } else {
    base.colSpan = 1
  }
  return base
}

export function createForm(createdBy = '') {
  return {
    id: `form_${Date.now()}`,
    title: 'Untitled form',
    description: '',
    showTitle: true,
    fields: [],
    layout: 'default', // 'default' | 'header-cover' | 'split'
    formWidth: 'standard', // 'narrow' (480px) | 'standard' (768px) | 'wide' (1200px)
    headerImage: '', // base64 data URL or ''
    sideImage: '', // base64 for split layout
    steps: [], // [{ id, title, fieldIds: [] }] - multi-step; empty = single page
    approvalWorkflow: null, // { approverIds: string[], type: 'all' } - null = no approval
    submissionType: 'general', // 'general' | 'event-request'
    createdBy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export const INITIAL_FORMS = []
export const INITIAL_SUBMISSIONS = []

/** Map event-request form submission data to calendar event. */
export function submissionToEvent(form, submission) {
  if (form.submissionType !== 'event-request') return null
  const data = submission.data || {}
  const getVal = (key) => {
    const field = (form.fields || []).find((f) => f.targetKey === key)
    return field ? data[field.id] : null
  }
  const name = getVal('name') || 'Untitled event'
  const date = getVal('date') || new Date().toISOString().slice(0, 10)
  const time = getVal('time') || ''
  const location = getVal('location') || 'TBD'
  const description = getVal('description') || ''
  const owner = getVal('owner') || submission.submittedBy || 'TBD'
  return {
    id: `ev_${submission.id}`,
    name,
    description,
    date,
    time,
    endTime: '',
    location,
    owner,
    creator: submission.submittedBy,
    watchers: [],
  }
}
