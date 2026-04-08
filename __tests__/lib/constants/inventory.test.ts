import { describe, it, expect } from 'vitest'
import {
  INVENTORY_CATEGORIES,
  INVENTORY_DEPT_CATEGORIES,
  INVENTORY_DEPT_CONFIG,
  AV_EQUIPMENT_TAGS,
  DOC_LINK_TYPES,
} from '@/lib/constants/inventory'

describe('INVENTORY_CATEGORIES', () => {
  it('is a non-empty readonly array', () => {
    expect(INVENTORY_CATEGORIES.length).toBeGreaterThan(0)
  })

  it('includes expected categories', () => {
    expect(INVENTORY_CATEGORIES).toContain('AV Equipment')
    expect(INVENTORY_CATEGORIES).toContain('Computers')
    expect(INVENTORY_CATEGORIES).toContain('Maintenance Supplies')
    expect(INVENTORY_CATEGORIES).toContain('Other')
  })

  it('has no duplicate entries', () => {
    const unique = new Set(INVENTORY_CATEGORIES)
    expect(unique.size).toBe(INVENTORY_CATEGORIES.length)
  })
})

describe('INVENTORY_DEPT_CATEGORIES', () => {
  it('has entries for av, maintenance, and it', () => {
    expect(INVENTORY_DEPT_CATEGORIES.av).toBeDefined()
    expect(INVENTORY_DEPT_CATEGORIES.maintenance).toBeDefined()
    expect(INVENTORY_DEPT_CATEGORIES.it).toBeDefined()
  })

  it('av includes AV Equipment', () => {
    expect(INVENTORY_DEPT_CATEGORIES.av).toContain('AV Equipment')
  })

  it('maintenance includes Maintenance Supplies', () => {
    expect(INVENTORY_DEPT_CATEGORIES.maintenance).toContain('Maintenance Supplies')
  })

  it('it includes Computers', () => {
    expect(INVENTORY_DEPT_CATEGORIES.it).toContain('Computers')
  })

  it('all department categories exist in INVENTORY_CATEGORIES', () => {
    for (const dept of Object.values(INVENTORY_DEPT_CATEGORIES)) {
      for (const cat of dept) {
        expect(INVENTORY_CATEGORIES).toContain(cat)
      }
    }
  })
})

describe('INVENTORY_DEPT_CONFIG', () => {
  it('has title, subtitle, and addLabel for each department', () => {
    for (const dept of Object.values(INVENTORY_DEPT_CONFIG)) {
      expect(dept.title).toBeTruthy()
      expect(dept.subtitle).toBeTruthy()
      expect(dept.addLabel).toBeTruthy()
    }
  })
})

describe('AV_EQUIPMENT_TAGS', () => {
  it('is a non-empty array', () => {
    expect(AV_EQUIPMENT_TAGS.length).toBeGreaterThan(0)
  })

  it('is alphabetically sorted', () => {
    const sorted = [...AV_EQUIPMENT_TAGS].sort()
    expect(AV_EQUIPMENT_TAGS).toEqual(sorted)
  })

  it('has no duplicates', () => {
    const unique = new Set(AV_EQUIPMENT_TAGS)
    expect(unique.size).toBe(AV_EQUIPMENT_TAGS.length)
  })
})

describe('DOC_LINK_TYPES', () => {
  it('has value and label for each type', () => {
    for (const type of DOC_LINK_TYPES) {
      expect(type.value).toBeTruthy()
      expect(type.label).toBeTruthy()
    }
  })

  it('includes manual and warranty types', () => {
    const values = DOC_LINK_TYPES.map((t) => t.value)
    expect(values).toContain('manual')
    expect(values).toContain('warranty')
  })
})
