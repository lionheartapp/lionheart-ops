/**
 * Shared inventory constants — safe to import from both client and server code.
 */
export const INVENTORY_CATEGORIES = [
  'Office Supplies',
  'AV Equipment',
  'Custodial',
  'Sports Equipment',
  'Classroom Materials',
  'Technology',
  'Medical/First Aid',
  'Other',
] as const

export const AV_EQUIPMENT_TAGS = [
  'audio',
  'blackbox',
  'elementary school',
  'global',
  'gym',
  'high school',
  'lighting',
  'middle school',
  'theater',
  'video',
] as const

export const DOC_LINK_TYPES = [
  { value: 'manual', label: 'Manual' },
  { value: 'spec_sheet', label: 'Specification Sheet' },
  { value: 'warranty', label: 'Warranty' },
  { value: 'other', label: 'Other' },
] as const
