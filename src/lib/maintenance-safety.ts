export type MaintenanceSafetyGuidance = {
  label: string
  ppe: string[]
  steps: string[]
  stopConditions: string[]
  note: string
}

const BASE_PPE = [
  'Closed-toe non-slip footwear',
  'Work gloves matched to the task',
  'Safety glasses when debris, splash, or dust is possible',
]

export const MAINTENANCE_SAFETY_GUIDANCE: Record<string, MaintenanceSafetyGuidance> = {
  ELECTRICAL: {
    label: 'Electrical safety',
    ppe: [
      'Safety glasses',
      'Insulated gloves rated for the task',
      'Non-conductive footwear',
      'Arc-rated PPE when panel work or energized equipment is involved',
    ],
    steps: [
      'De-energize the circuit before work begins',
      'Use lockout/tagout when required by site policy',
      'Verify absence of voltage with a properly rated meter',
      'Keep the area dry and clear before touching equipment',
    ],
    stopConditions: [
      'Energized panel work is required',
      'Burning smell, scorch marks, or damaged wiring are present',
      'The circuit cannot be positively identified or de-energized',
    ],
    note: 'Escalate electrical work that requires licensing, energized work, or panel modification.',
  },
  PLUMBING: {
    label: 'Plumbing safety',
    ppe: [...BASE_PPE, 'Nitrile or waterproof gloves', 'Splash goggles'],
    steps: [
      'Shut off water before opening a line',
      'Relieve pressure before disconnecting fittings',
      'Protect floors and nearby electrical equipment from water',
      'Disinfect surfaces touched by wastewater or sewage',
    ],
    stopConditions: [
      'Sewage backup or possible contaminated water is present',
      'Water is near electrical equipment',
      'Wall, ceiling, or floor damage suggests hidden mold or structural damage',
    ],
    note: 'Treat wastewater and unknown standing water as contaminated until confirmed otherwise.',
  },
  HVAC: {
    label: 'HVAC safety',
    ppe: [...BASE_PPE, 'Cut-resistant gloves', 'Dust mask or respirator when filters, dust, or insulation are disturbed'],
    steps: [
      'Disconnect power before opening equipment panels',
      'Let hot components cool before service',
      'Avoid disturbing refrigerant lines unless qualified',
      'Document filter, belt, and drain pan condition',
    ],
    stopConditions: [
      'Refrigerant leak is suspected',
      'Combustion gas, electrical burn, or overheating signs are present',
      'Work requires refrigerant handling or sealed-system repair',
    ],
    note: 'Refrigerant and combustion-related work should go to qualified personnel.',
  },
  STRUCTURAL: {
    label: 'Structural safety',
    ppe: [...BASE_PPE, 'Hard hat when overhead work is possible', 'Dust mask or respirator for demolition dust'],
    steps: [
      'Block off the affected area if collapse, falling material, or trip risk exists',
      'Check for hidden electrical, plumbing, or fire systems before cutting',
      'Use ladder and lift safety rules for overhead access',
      'Photograph damage before and after work',
    ],
    stopConditions: [
      'Load-bearing damage is possible',
      'Ceiling, wall, or floor movement is visible',
      'Asbestos, lead paint, or mold may be disturbed',
    ],
    note: 'Do not disturb suspect hazardous materials without the proper assessment and controls.',
  },
  CUSTODIAL_BIOHAZARD: {
    label: 'Biohazard cleanup',
    ppe: [
      'Disposable nitrile gloves',
      'Safety goggles or face shield',
      'N95 or site-approved respirator when aerosols or odor are present',
      'Disposable coveralls or apron',
      'Biohazard waste bags',
      'Closed-toe non-slip footwear',
    ],
    steps: [
      'Restrict access to the affected area',
      'Ventilate when safe to do so',
      'Remove visible soil before disinfecting',
      'Use an approved disinfectant with the required dwell time',
      'Bag and dispose of contaminated materials per site policy',
    ],
    stopConditions: [
      'Needles, sharps, or large blood/body-fluid exposure are present',
      'Cleanup involves vomit, feces, sewage, or unknown biological material beyond routine scope',
      'Staff do not have required training or PPE',
    ],
    note: 'Follow the school safety plan and bloodborne pathogen procedures for exposure risk.',
  },
  IT_AV: {
    label: 'IT/AV safety',
    ppe: [...BASE_PPE, 'Safety glasses when mounting or drilling'],
    steps: [
      'Disconnect power before opening equipment',
      'Use two-person lifts for heavy displays or mounted devices',
      'Verify wall anchors and mounting surface before reinstalling equipment',
      'Keep cables managed to prevent trip hazards',
    ],
    stopConditions: [
      'Ceiling or wall mounting looks unstable',
      'Electrical supply or outlet damage is present',
      'Work requires lift equipment without trained staff',
    ],
    note: 'Treat mounted displays, projectors, and ceiling work as fall/object hazards.',
  },
  GROUNDS: {
    label: 'Grounds and chemical safety',
    ppe: [...BASE_PPE, 'Weather-appropriate skin protection', 'Chemical gloves and eye protection when applying products'],
    steps: [
      'Check the product label before any chemical application',
      'Confirm weather, runoff, and student access conditions',
      'Mark or restrict treated areas when required',
      'Record product, amount, location, and applicator notes',
    ],
    stopConditions: [
      'The product label is missing or unclear',
      'Wildlife, fish, storm drains, or runoff may be affected',
      'Application requires a licensed applicator',
    ],
    note: 'Chemical labels and local rules control application. Do not rely on AI alone for dosage.',
  },
  OTHER: {
    label: 'General task safety',
    ppe: BASE_PPE,
    steps: [
      'Identify the hazard before starting',
      'Use the right tool for the task',
      'Block off unsafe work areas',
      'Document before and after photos when condition matters',
    ],
    stopConditions: [
      'The hazard is unclear',
      'Specialized training, PPE, or licensing may be required',
      'The work could affect students, staff, utilities, or building systems',
    ],
    note: 'When the hazard is unclear, pause and escalate before starting work.',
  },
}

export function getMaintenanceSafetyGuidance(category?: string | null): MaintenanceSafetyGuidance {
  return MAINTENANCE_SAFETY_GUIDANCE[category ?? ''] ?? MAINTENANCE_SAFETY_GUIDANCE.OTHER
}
