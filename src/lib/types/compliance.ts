/**
 * Client-safe compliance types and constants.
 * Does NOT import from complianceService (which pulls in server-side deps).
 */

import type { ComplianceDomain, ComplianceStatus, ComplianceOutcome } from '@prisma/client'

export interface ComplianceDomainMeta {
  label: string
  description: string
  defaultMonth: number // 1-12
  defaultDay: number   // 1-31
  frequencyYears: number // 1 = annual, 3 = every 3 years, 5 = every 5 years
  category: string
}

export const COMPLIANCE_DOMAIN_DEFAULTS: Record<ComplianceDomain, ComplianceDomainMeta> = {
  AHERA: {
    label: 'AHERA Asbestos Inspection',
    description: 'Annual asbestos inspection required by the Asbestos Hazard Emergency Response Act.',
    defaultMonth: 9,
    defaultDay: 1,
    frequencyYears: 1,
    category: 'STRUCTURAL',
  },
  FIRE_SAFETY: {
    label: 'Fire Safety Inspection',
    description: 'Annual fire safety inspection including extinguisher checks and egress review.',
    defaultMonth: 9,
    defaultDay: 15,
    frequencyYears: 1,
    category: 'STRUCTURAL',
  },
  PLAYGROUND: {
    label: 'Playground Safety Inspection',
    description: 'Annual inspection of all playground equipment for hazards and compliance.',
    defaultMonth: 8,
    defaultDay: 15,
    frequencyYears: 1,
    category: 'GROUNDS',
  },
  LEAD_WATER: {
    label: 'Lead in Water Testing',
    description: 'Testing of water fixtures for lead contamination, required every 3 years.',
    defaultMonth: 6,
    defaultDay: 1,
    frequencyYears: 3,
    category: 'PLUMBING',
  },
  BOILER: {
    label: 'Boiler Inspection',
    description: 'Annual boiler safety inspection required by state regulations.',
    defaultMonth: 10,
    defaultDay: 1,
    frequencyYears: 1,
    category: 'HVAC',
  },
  ELEVATOR: {
    label: 'Elevator Inspection',
    description: 'Annual elevator safety inspection (if applicable).',
    defaultMonth: 10,
    defaultDay: 15,
    frequencyYears: 1,
    category: 'STRUCTURAL',
  },
  KITCHEN: {
    label: 'Kitchen Health & Sanitation Inspection',
    description: 'Annual health department inspection of food service facilities.',
    defaultMonth: 8,
    defaultDay: 1,
    frequencyYears: 1,
    category: 'CUSTODIAL_BIOHAZARD',
  },
  ADA: {
    label: 'ADA Self-Evaluation',
    description: 'Americans with Disabilities Act self-evaluation and transition plan review, required every 3 years.',
    defaultMonth: 3,
    defaultDay: 1,
    frequencyYears: 3,
    category: 'STRUCTURAL',
  },
  RADON: {
    label: 'Radon Testing',
    description: 'Radon gas testing in occupied spaces, required every 5 years.',
    defaultMonth: 11,
    defaultDay: 1,
    frequencyYears: 5,
    category: 'OTHER',
  },
  IPM: {
    label: 'Integrated Pest Management Review',
    description: 'Annual Integrated Pest Management program review and documentation.',
    defaultMonth: 8,
    defaultDay: 31,
    frequencyYears: 1,
    category: 'GROUNDS',
  },
}

export const COMPLIANCE_DOMAINS: ComplianceDomain[] = [
  'AHERA',
  'FIRE_SAFETY',
  'PLAYGROUND',
  'LEAD_WATER',
  'BOILER',
  'ELEVATOR',
  'KITCHEN',
  'ADA',
  'RADON',
  'IPM',
]
