/**
 * Shared inventory constants — safe to import from both client and server code.
 */
export const INVENTORY_CATEGORIES = [
  'Office Supplies',
  'AV Equipment',
  'Cables & Adapters',
  'Custodial',
  'Furniture',
  'Maintenance Supplies',
  'Sports Equipment',
  'Classroom Materials',
  'Computers',
  'Technology',
  'Peripherals',
  'Networking',
  'Medical/First Aid',
  'Other',
] as const

export type InventoryDept = 'av' | 'maintenance' | 'it'

/** Categories that belong to each department — used to pre-filter by sidebar context */
export const INVENTORY_DEPT_CATEGORIES: Record<InventoryDept, readonly string[]> = {
  av: ['AV Equipment', 'Cables & Adapters', 'Office Supplies'],
  maintenance: ['Maintenance Supplies', 'Custodial', 'Furniture', 'Other'],
  it: ['Computers', 'Technology', 'Peripherals', 'Networking'],
}

/** Display config per department */
export const INVENTORY_DEPT_CONFIG: Record<InventoryDept, { title: string; subtitle: string; addLabel: string }> = {
  av: {
    title: 'AV Inventory',
    subtitle: 'Track and manage your A/V equipment and supplies',
    addLabel: 'Add Item',
  },
  maintenance: {
    title: 'Maintenance Inventory',
    subtitle: 'Track and manage maintenance supplies and materials',
    addLabel: 'Add Item',
  },
  it: {
    title: 'IT Inventory',
    subtitle: 'Track and manage IT equipment and accessories',
    addLabel: 'Add Item',
  },
}

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
