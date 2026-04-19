/**
 * Category Field Library
 *
 * Defines the fixed set of field types that admins can toggle on/off per
 * ticket category. This is NOT a full form builder — it's a curated library
 * of predefined fields with known rendering behavior.
 */

import type { CategoryFieldType, TicketModule } from '@prisma/client'

export interface FieldDefinition {
  type: CategoryFieldType
  label: string
  description: string
  modules: TicketModule[]
  renderType: 'asset-picker' | 'user-picker' | 'textarea' | 'checkbox' | 'dropdown' | 'number'
  options?: string[]
  showIf?: { field: string; value: string }
}

export const FIELD_LIBRARY: Record<CategoryFieldType, FieldDefinition> = {
  ASSET_PICKER: {
    type: 'ASSET_PICKER',
    label: 'Asset / Equipment',
    description: 'Link a specific asset from the inventory',
    modules: ['MAINTENANCE', 'IT'],
    renderType: 'asset-picker',
  },
  AFFECTED_USER: {
    type: 'AFFECTED_USER',
    label: 'Affected Person',
    description: 'Who is this ticket on behalf of?',
    modules: ['MAINTENANCE', 'IT'],
    renderType: 'user-picker',
  },
  URGENCY_JUSTIFICATION: {
    type: 'URGENCY_JUSTIFICATION',
    label: 'Urgency Justification',
    description: 'Explain why this is urgent (shown only when priority is Urgent)',
    modules: ['MAINTENANCE', 'IT'],
    renderType: 'textarea',
    showIf: { field: 'priority', value: 'URGENT' },
  },
  SAFETY_HAZARD: {
    type: 'SAFETY_HAZARD',
    label: 'Safety Hazard',
    description: 'Flag as a safety hazard — auto-escalates priority to Urgent',
    modules: ['MAINTENANCE'],
    renderType: 'checkbox',
  },
  DEVICE_TYPE: {
    type: 'DEVICE_TYPE',
    label: 'Device Type',
    description: 'What type of device is affected?',
    modules: ['IT'],
    renderType: 'dropdown',
    options: ['Chromebook', 'Laptop', 'Desktop', 'Tablet', 'Printer', 'Projector', 'Phone', 'Other'],
  },
  PEOPLE_AFFECTED: {
    type: 'PEOPLE_AFFECTED',
    label: 'People Affected',
    description: 'How many people are affected by this issue?',
    modules: ['IT'],
    renderType: 'number',
  },
}

/** Get field definitions available for a specific module */
export function getFieldsForModule(module: TicketModule): FieldDefinition[] {
  return Object.values(FIELD_LIBRARY).filter((f) => f.modules.includes(module))
}

/** Get a single field definition by type */
export function getFieldDefinition(fieldType: CategoryFieldType): FieldDefinition {
  return FIELD_LIBRARY[fieldType]
}
