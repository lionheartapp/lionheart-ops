/**
 * System form templates for Settings → Workspace → Forms.
 * Each template is used when the org has no form assigned for that slot; user can edit after creating.
 */

import { createField, createForm } from './formsData'

const SLOT_IDS = ['event', 'tech', 'facilities', 'it']

export const SYSTEM_FORM_SLOTS = [
  { id: 'event', label: 'Event form', description: 'Form used when creating calendar events. Customize fields and steps to match your process.' },
  { id: 'tech', label: 'Tech form', description: 'Form for A/V and tech requests. Used from Dashboard and support flows.' },
  { id: 'facilities', label: 'Facilities form', description: 'Form for facilities and setup requests (tables, chairs, rooms).' },
  { id: 'it', label: 'IT form', description: 'Form for IT support requests (equipment, access, issues).' },
]

/**
 * Returns a new form config (with unique field ids) for the given system slot.
 * Used when "Set up from template" is clicked; the result is POSTed to create the form.
 * @param {string} slotId - 'event' | 'tech' | 'facilities' | 'it'
 * @param {string} createdBy - Creator name for the form
 * @returns {object} Form object suitable for POST /api/forms or form builder state
 */
export function getSystemFormTemplate(slotId, createdBy = '') {
  const base = createForm(createdBy)
  const now = Date.now()

  if (slotId === 'event') {
    const section1 = createField('section', { label: 'Event details', description: 'Basic information', useAsStep: true })
    const name = createField('text', { label: 'Event name', required: true, targetKey: 'name' })
    const date = createField('date', { label: 'Date', required: true, targetKey: 'date' })
    const startTime = createField('text', { label: 'Start time', placeholder: 'e.g. 2:00 PM', required: true, targetKey: 'startTime' })
    const endTime = createField('text', { label: 'End time', placeholder: 'e.g. 4:00 PM', targetKey: 'endTime' })
    const location = createField('text', { label: 'Location / room', placeholder: 'e.g. Main Hall', targetKey: 'location' })
    const description = createField('textarea', { label: 'Description', placeholder: 'What is this event about?', targetKey: 'description' })
    const owner = createField('text', { label: 'Requested by / contact', placeholder: 'Your name or contact', targetKey: 'owner' })
    const fields = [section1, name, date, startTime, endTime, location, description, owner]
    const steps = [
      { id: `step_${now}_1`, title: 'Event details', fieldIds: fields.slice(0, 8).map((f) => f.id) },
    ]
    return {
      ...base,
      title: 'Create event',
      description: 'Request a new event for the calendar.',
      submissionType: 'event-request',
      fields,
      steps,
    }
  }

  if (slotId === 'tech') {
    const section1 = createField('section', { label: 'Tech request', description: 'A/V and tech needs', useAsStep: true })
    const summary = createField('text', { label: 'Summary', required: true, placeholder: 'e.g. Projector and mic for assembly' })
    const details = createField('textarea', { label: 'Details', placeholder: 'Describe what you need...' })
    const priority = createField('dropdown', {
      label: 'Priority',
      options: ['Normal', 'High', 'Critical'],
      required: false,
    })
    const date = createField('date', { label: 'Date needed' })
    const contact = createField('text', { label: 'Your name', required: true })
    const fields = [section1, summary, details, priority, date, contact]
    const steps = [{ id: `step_${now}_1`, title: 'Tech request', fieldIds: fields.map((f) => f.id) }]
    return {
      ...base,
      title: 'Tech request',
      description: 'Request A/V equipment or tech support.',
      submissionType: 'general',
      fields,
      steps,
    }
  }

  if (slotId === 'facilities') {
    const section1 = createField('section', { label: 'Facilities request', description: 'Setup and equipment', useAsStep: true })
    const location = createField('dropdown', {
      label: 'Location',
      options: ['Gym', 'Auditorium', 'Cafeteria', 'Library', 'Classroom', 'Other'],
      required: true,
    })
    const details = createField('textarea', { label: 'Details', placeholder: 'What do you need? Tables, chairs, setup...' })
    const priority = createField('dropdown', {
      label: 'Priority',
      options: ['Normal', 'High', 'Critical'],
    })
    const date = createField('date', { label: 'Date needed' })
    const contact = createField('text', { label: 'Your name', required: true })
    const fields = [section1, location, details, priority, date, contact]
    const steps = [{ id: `step_${now}_1`, title: 'Facilities request', fieldIds: fields.map((f) => f.id) }]
    return {
      ...base,
      title: 'Facilities request',
      description: 'Request tables, chairs, or room setup.',
      submissionType: 'general',
      fields,
      steps,
    }
  }

  if (slotId === 'it') {
    const section1 = createField('section', { label: 'IT support request', description: 'Equipment, access, or issues', useAsStep: true })
    const summary = createField('text', {
      label: 'Summary',
      required: true,
      placeholder: 'e.g. Projector not working in Room 204',
    })
    const details = createField('textarea', { label: 'Details', placeholder: 'Any additional details...' })
    const priority = createField('dropdown', {
      label: 'Priority',
      options: ['Normal', 'Critical'],
    })
    const contact = createField('text', { label: 'Your name', required: true })
    const fields = [section1, summary, details, priority, contact]
    const steps = [{ id: `step_${now}_1`, title: 'IT request', fieldIds: fields.map((f) => f.id) }]
    return {
      ...base,
      title: 'IT support request',
      description: 'Submit an IT support or equipment request.',
      submissionType: 'general',
      fields,
      steps,
    }
  }

  return { ...base, title: 'Untitled form', fields: [], steps: [] }
}

export function isSystemFormSlot(slotId) {
  return SLOT_IDS.includes(slotId)
}
