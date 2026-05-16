/**
 * System form seed definitions.
 *
 * Each system form is seeded per org on first visit to the Forms Hub.
 * Fields marked LOCKED cannot be removed. Fields marked DEFAULT can be toggled off.
 */

import type { FormFieldType } from '@prisma/client'

interface SeedField {
  key: string
  label: string
  type: FormFieldType
  required: boolean
  protection: 'LOCKED' | 'DEFAULT' | 'CUSTOM'
  placeholder?: string
  helpText?: string
  options?: string[]
}

interface SeedPage {
  title: string
  fields: SeedField[]
}

export interface SystemFormSeed {
  systemKey: string
  description: string
  context: 'EVENT_CREATION' | 'EVENT_REGISTRATION'
  pages: SeedPage[]
}

export const SYSTEM_FORM_SEEDS: SystemFormSeed[] = [
  // ─── School Events ──────────────────────────────────────────────────────
  {
    systemKey: 'single_event',
    description: 'Single Event',
    context: 'EVENT_CREATION',
    pages: [
      {
        title: 'Details',
        fields: [
          { key: 'title', label: 'Title', type: 'TEXT', required: true, protection: 'LOCKED', placeholder: 'Event title' },
          { key: 'description', label: 'Description', type: 'TEXTAREA', required: false, protection: 'DEFAULT', placeholder: 'Describe the event...' },
          { key: 'starts_at', label: 'Start Date & Time', type: 'DATE', required: true, protection: 'LOCKED' },
          { key: 'ends_at', label: 'End Date & Time', type: 'DATE', required: true, protection: 'LOCKED' },
          { key: 'expected_attendance', label: 'Expected Attendance', type: 'NUMBER', required: false, protection: 'DEFAULT', placeholder: 'Estimated headcount' },
        ],
      },
      {
        title: 'Location',
        fields: [
          { key: 'location', label: 'Location', type: 'LOCATION_PICKER', required: true, protection: 'LOCKED' },
        ],
      },
      {
        title: 'Team & People',
        fields: [
          { key: 'team', label: 'Team', type: 'USER_PICKER', required: false, protection: 'LOCKED' },
          { key: 'av_needs', label: 'AV Equipment', type: 'MULTI_SELECT', required: false, protection: 'DEFAULT', options: ['Projector & Screen', 'Wireless Microphone(s)', 'Podium Mic', 'Livestream / Recording', 'Sound System / Speakers', 'Stage Lighting', 'Laptop / Clicker'] },
          { key: 'facility_needs', label: 'Facilities Setup', type: 'MULTI_SELECT', required: false, protection: 'DEFAULT', options: ['Extra Seating / Chairs', 'Table Arrangement', 'Stage or Podium Setup', 'Outdoor Setup', 'Cleaning Before Event', 'Cleaning After Event', 'Signage / Wayfinding'] },
          { key: 'requires_custodial', label: 'Custodial Required', type: 'CHECKBOX', required: false, protection: 'DEFAULT' },
          { key: 'requires_security', label: 'Security Required', type: 'CHECKBOX', required: false, protection: 'DEFAULT' },
        ],
      },
    ],
  },
  {
    systemKey: 'recurring_event',
    description: 'Recurring Event',
    context: 'EVENT_CREATION',
    pages: [
      {
        title: 'Details',
        fields: [
          { key: 'title', label: 'Title', type: 'TEXT', required: true, protection: 'LOCKED', placeholder: 'Event title' },
          { key: 'description', label: 'Description', type: 'TEXTAREA', required: false, protection: 'DEFAULT', placeholder: 'Describe the event...' },
          { key: 'recurrence', label: 'Recurrence Pattern', type: 'DROPDOWN', required: true, protection: 'LOCKED', options: ['Daily', 'Weekly', 'Bi-weekly', 'Monthly'] },
          { key: 'starts_at', label: 'Start Date & Time', type: 'DATE', required: true, protection: 'LOCKED' },
          { key: 'ends_at', label: 'End Date & Time', type: 'DATE', required: true, protection: 'LOCKED' },
          { key: 'expected_attendance', label: 'Expected Attendance', type: 'NUMBER', required: false, protection: 'DEFAULT' },
        ],
      },
      {
        title: 'Location',
        fields: [
          { key: 'location', label: 'Location', type: 'LOCATION_PICKER', required: true, protection: 'LOCKED' },
        ],
      },
      {
        title: 'Team & People',
        fields: [
          { key: 'team', label: 'Team', type: 'USER_PICKER', required: false, protection: 'LOCKED' },
          { key: 'av_needs', label: 'AV Equipment', type: 'MULTI_SELECT', required: false, protection: 'DEFAULT', options: ['Projector & Screen', 'Wireless Microphone(s)', 'Podium Mic', 'Livestream / Recording', 'Sound System / Speakers', 'Stage Lighting', 'Laptop / Clicker'] },
          { key: 'facility_needs', label: 'Facilities Setup', type: 'MULTI_SELECT', required: false, protection: 'DEFAULT', options: ['Extra Seating / Chairs', 'Table Arrangement', 'Stage or Podium Setup', 'Outdoor Setup', 'Cleaning Before Event', 'Cleaning After Event', 'Signage / Wayfinding'] },
          { key: 'requires_custodial', label: 'Custodial Required', type: 'CHECKBOX', required: false, protection: 'DEFAULT' },
          { key: 'requires_security', label: 'Security Required', type: 'CHECKBOX', required: false, protection: 'DEFAULT' },
        ],
      },
    ],
  },
  {
    systemKey: 'multiday_event',
    description: 'Multi-day Event',
    context: 'EVENT_CREATION',
    pages: [
      {
        title: 'Details',
        fields: [
          { key: 'title', label: 'Title', type: 'TEXT', required: true, protection: 'LOCKED', placeholder: 'Event title' },
          { key: 'description', label: 'Description', type: 'TEXTAREA', required: false, protection: 'DEFAULT' },
          { key: 'starts_at', label: 'Start Date', type: 'DATE', required: true, protection: 'LOCKED' },
          { key: 'ends_at', label: 'End Date', type: 'DATE', required: true, protection: 'LOCKED' },
          { key: 'expected_attendance', label: 'Expected Attendance', type: 'NUMBER', required: false, protection: 'DEFAULT' },
        ],
      },
      {
        title: 'Location',
        fields: [
          { key: 'location', label: 'Location', type: 'LOCATION_PICKER', required: true, protection: 'LOCKED' },
        ],
      },
      {
        title: 'Team & People',
        fields: [
          { key: 'team', label: 'Team', type: 'USER_PICKER', required: false, protection: 'LOCKED' },
          { key: 'av_needs', label: 'AV Equipment', type: 'MULTI_SELECT', required: false, protection: 'DEFAULT', options: ['Projector & Screen', 'Wireless Microphone(s)', 'Podium Mic', 'Livestream / Recording', 'Sound System / Speakers', 'Stage Lighting'] },
          { key: 'facility_needs', label: 'Facilities Setup', type: 'MULTI_SELECT', required: false, protection: 'DEFAULT', options: ['Extra Seating / Chairs', 'Table Arrangement', 'Stage or Podium Setup', 'Outdoor Setup', 'Cleaning Before Event', 'Cleaning After Event', 'Signage / Wayfinding'] },
          { key: 'requires_custodial', label: 'Custodial Required', type: 'CHECKBOX', required: false, protection: 'DEFAULT' },
          { key: 'requires_security', label: 'Security Required', type: 'CHECKBOX', required: false, protection: 'DEFAULT' },
        ],
      },
    ],
  },

  // ─── Support ────────────────────────────────────────────────────────────
  {
    systemKey: 'facilities_request',
    description: 'Facilities Request',
    context: 'EVENT_CREATION',
    pages: [
      {
        title: 'Request Details',
        fields: [
          { key: 'title', label: 'Title', type: 'TEXT', required: true, protection: 'LOCKED', placeholder: 'Brief summary' },
          { key: 'description', label: 'Description', type: 'TEXTAREA', required: true, protection: 'LOCKED', placeholder: 'What do you need?' },
          { key: 'priority', label: 'Priority', type: 'DROPDOWN', required: false, protection: 'DEFAULT', options: ['Low', 'Normal', 'High', 'Urgent'] },
          { key: 'requested_date', label: 'Requested Date', type: 'DATE', required: false, protection: 'DEFAULT' },
          { key: 'photo', label: 'Photo', type: 'FILE', required: false, protection: 'DEFAULT', helpText: 'Attach a photo if helpful' },
        ],
      },
      {
        title: 'Location & Setup',
        fields: [
          { key: 'location', label: 'Location', type: 'LOCATION_PICKER', required: true, protection: 'LOCKED' },
          { key: 'requires_custodial', label: 'Custodial Needed', type: 'CHECKBOX', required: false, protection: 'DEFAULT' },
          { key: 'requires_security', label: 'Security Needed', type: 'CHECKBOX', required: false, protection: 'DEFAULT' },
        ],
      },
    ],
  },
  {
    systemKey: 'it_request',
    description: 'IT Request',
    context: 'EVENT_CREATION',
    pages: [
      {
        title: 'Issue Details',
        fields: [
          { key: 'title', label: 'Title', type: 'TEXT', required: true, protection: 'LOCKED', placeholder: 'Brief summary of the issue' },
          { key: 'description', label: 'Description', type: 'TEXTAREA', required: true, protection: 'LOCKED', placeholder: 'What happened?' },
          { key: 'category', label: 'Category', type: 'DROPDOWN', required: false, protection: 'DEFAULT', options: ['Hardware', 'Software', 'Network', 'Account / Password', 'Other'] },
          { key: 'urgency', label: 'Urgency', type: 'DROPDOWN', required: false, protection: 'DEFAULT', options: ['Low', 'Normal', 'High', 'Urgent'] },
        ],
      },
      {
        title: 'Device Info',
        fields: [
          { key: 'device', label: 'Device / Asset', type: 'ASSET_PICKER', required: false, protection: 'DEFAULT' },
          { key: 'screenshot', label: 'Screenshot', type: 'FILE', required: false, protection: 'DEFAULT', helpText: 'Attach a screenshot of the error' },
        ],
      },
    ],
  },

  // ─── Registration ───────────────────────────────────────────────────────
  {
    systemKey: 'event_registration',
    description: 'Event Registration',
    context: 'EVENT_REGISTRATION',
    pages: [
      {
        title: 'Your Information',
        fields: [
          { key: 'first_name', label: 'First Name', type: 'TEXT', required: true, protection: 'LOCKED' },
          { key: 'last_name', label: 'Last Name', type: 'TEXT', required: true, protection: 'LOCKED' },
          { key: 'email', label: 'Email', type: 'EMAIL', required: true, protection: 'LOCKED' },
          { key: 'phone', label: 'Phone', type: 'PHONE', required: false, protection: 'DEFAULT' },
          { key: 'grade', label: 'Grade', type: 'GRADE_SELECTOR', required: false, protection: 'DEFAULT' },
        ],
      },
      {
        title: 'Additional Info',
        fields: [
          { key: 'emergency_contact', label: 'Emergency Contact Name', type: 'TEXT', required: false, protection: 'DEFAULT' },
          { key: 'emergency_phone', label: 'Emergency Contact Phone', type: 'PHONE', required: false, protection: 'DEFAULT' },
          { key: 'dietary_needs', label: 'Dietary Needs', type: 'TEXT', required: false, protection: 'DEFAULT' },
          { key: 'tshirt_size', label: 'T-Shirt Size', type: 'DROPDOWN', required: false, protection: 'DEFAULT', options: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'] },
        ],
      },
    ],
  },
]
